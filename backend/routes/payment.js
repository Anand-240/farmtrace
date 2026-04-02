const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const auth = require('../middleware/authMiddleware');
const Transfer = require('../models/Transfer');
const Produce = require('../models/Produce');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Escrow = require('../models/Escrow');
const { transferOnChain } = require('../blockchain/blockchainService');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

function statusLabel(status) {
  if (status === 'PENDING_DISPATCH') return 'Pending Dispatch';
  if (status === 'PICKUP_DISPATCHED') return 'Pickup Dispatched';
  if (status === 'IN_TRANSIT') return 'In Transit';
  if (status === 'DELIVERED') return 'Delivered';
  return status;
}

// Milestone payment release logic
async function releaseMilestonePayment({ escrow, transferId, milestone, transfer }) {
  if (milestone === 'DISPATCH' && !escrow.dispatchReleased) {
    escrow.dispatchReleased = true;
    escrow.dispatchReleasedAt = new Date();
    
    // Notify farmer that dispatch payment released
    await Notification.create({
      userPhone: transfer.fromPhone,
      title: 'Dispatch Payment Released!',
      message: `${transfer.toPhone} ne pickup dispatch kiya. \u20b9${escrow.dispatchAmount.toLocaleString()} payment release ho gayi!`,
      type: 'PAYMENT_RECEIVED',
      data: { transferId, amount: escrow.dispatchAmount, milestone: 'DISPATCH' }
    });
  }
  
  if (milestone === 'DELIVERY' && !escrow.deliveryReleased) {
    escrow.deliveryReleased = true;
    escrow.deliveryReleasedAt = new Date();
    escrow.status = 'COMPLETED';
    
    // Notify farmer that final payment released
    await Notification.create({
      userPhone: transfer.fromPhone,
      title: 'Final Settlement!',
      message: `Lot delivery confirm ho gayi! Final payment \u20b9${escrow.deliveryAmount.toLocaleString()} release ho gayi.`,
      type: 'PAYMENT_RECEIVED',
      data: { transferId, amount: escrow.deliveryAmount, milestone: 'DELIVERY' }
    });
  }
  
  await escrow.save();
}

async function notifyDeliveryParticipants({ transfer, actorPhone, title, message, type, data = {} }) {
  const targets = [transfer.fromPhone, transfer.toPhone].filter(Boolean);
  await Promise.all(targets.map((phone) => Notification.create({
    userPhone: phone,
    title,
    message,
    type,
    data: {
      transferId: transfer._id,
      produceId: transfer.produceId,
      actorPhone,
      ...data
    }
  })));
}

// Transfer request banao
router.post('/request', auth, async (req, res) => {
  try {
    const { produceMongoId, toPhone, toEmail, pricePerKg, location, transferType } = req.body;

    const produce = await Produce.findById(produceMongoId);
    if (!produce) return res.status(404).json({ message: 'Produce nahi mila' });

    const normalizedEmail = toEmail?.trim().toLowerCase();
    const toUser = await User.findOne(
      normalizedEmail ? { email: normalizedEmail } : { phone: toPhone?.trim() }
    );
    if (!toUser) {
      return res.status(404).json({ message: normalizedEmail ? 'Receiver nahi mila — email check karo' : 'Receiver nahi mila — phone check karo' });
    }

    const transfer = await Transfer.create({
      produceId: produceMongoId,
      fromPhone: req.user.phone,
      toPhone: toUser.phone,
      price: pricePerKg,
      location,
      currentLocation: location,
      transferType,
      blockchainStatus: 'PENDING',
      paymentStatus: 'PENDING',
      deliveryStatus: 'PENDING_DISPATCH'
    });

    // Receiver ko notification bhejo
    await Notification.create({
      userPhone: toUser.phone,
      title: 'Naya Transfer Request',
      message: `${req.user.name} ne ${produce.cropType} transfer karne ki request bheji hai — ₹${pricePerKg}/kg`,
      type: 'REQUEST_RECEIVED',
      data: { transferId: transfer._id, produceId: produceMongoId }
    });

    res.json({ success: true, transfer, message: 'Transfer request bheji gayi!' });

  } catch (err) {
    console.error('Request error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Pending requests
router.get('/pending', auth, async (req, res) => {
  try {
    const transfers = await Transfer.find({
      toPhone: req.user.phone,
      paymentStatus: 'PENDING'
    }).sort({ createdAt: -1 });

    const results = [];
    for (const t of transfers) {
      const produce = await Produce.findById(t.produceId);
      if (produce) {
        results.push({ ...t.toObject(), produce: produce.toObject() });
      }
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Razorpay order create
router.post('/create-order', auth, async (req, res) => {
  try {
    const { transferId } = req.body;

    const transfer = await Transfer.findById(transferId);
    if (!transfer) return res.status(404).json({ message: 'Transfer nahi mila' });

    const produce = await Produce.findById(transfer.produceId);
    if (!produce) return res.status(404).json({ message: 'Produce nahi mila' });

    const totalAmount = transfer.price * produce.quantity * 100;
    
    // Milestone payment breakdown: 40% booking, 30% dispatch, 30% delivery
    const bookingAmount = Math.round(totalAmount * 0.40);
    const dispatchAmount = Math.round(totalAmount * 0.30);
    const deliveryAmount = totalAmount - bookingAmount - dispatchAmount;

    // Razorpay order ke liye sirf BOOKING amount charge karo
    const order = await razorpay.orders.create({
      amount: bookingAmount,
      currency: 'INR',
      receipt: `transfer_${transferId}`,
      notes: {
        transferId: transferId.toString(),
        produceId: transfer.produceId.toString(),
        fromPhone: transfer.fromPhone,
        toPhone: transfer.toPhone,
        paymentType: 'BOOKING_MILESTONE'
      }
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: bookingAmount,
      currency: 'INR',
      totalAmount: totalAmount / 100,
      milestones: {
        booking: bookingAmount / 100,
        dispatch: dispatchAmount / 100,
        delivery: deliveryAmount / 100
      },
      transfer,
      produce
    });

  } catch (err) {
    console.error('Order error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Payment verify + blockchain transfer
router.post('/verify', auth, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      transferId
    } = req.body;

    // Signature verify
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment invalid hai' });
    }

    const transfer = await Transfer.findById(transferId);
    const produce = await Produce.findById(transfer.produceId);
    const fromUser = await User.findOne({ phone: transfer.fromPhone });
    const toUser = await User.findOne({ phone: transfer.toPhone });

    const totalAmount = transfer.price * produce.quantity;
    const bookingAmount = Math.round(totalAmount * 0.40);
    const dispatchAmount = Math.round(totalAmount * 0.30);
    const deliveryAmount = totalAmount - bookingAmount - dispatchAmount;

    // Payment status update - sirf booking stage clear hua
    transfer.paymentStatus = 'PAID';
    transfer.razorpayPaymentId = razorpay_payment_id;
    transfer.razorpayOrderId = razorpay_order_id;

    // Blockchain pe transfer (immediate booking ke baad)
    let txHash = null;
    if (produce.produceId) {
      const toAddress = new (require('ethers').Wallet)(
        process.env.PLATFORM_PRIVATE_KEY
      ).address;

      const result = await transferOnChain(
        produce.produceId, toAddress, transfer.price, transfer.location
      );

      if (result.success) {
        transfer.txHash = result.txHash;
        transfer.blockchainStatus = 'CONFIRMED';
        txHash = result.txHash;
      }
    }

    await transfer.save();

    // Produce owner update
    produce.currentOwner = transfer.toPhone;
    await produce.save();

    // Escrow record banao for milestone tracking
    await Escrow.create({
      transferId: transfer._id,
      totalAmount,
      bookingAmount,
      dispatchAmount,
      deliveryAmount,
      bookingPaid: true,
      bookingPaidAt: new Date(),
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      status: 'ACTIVE'
    });

    // Transaction history — sender ke liye (SENT)
    await Transaction.create({
      produceId: transfer.produceId,
      cropType: produce.cropType,
      fromPhone: transfer.toPhone,
      fromName: toUser?.name,
      toPhone: transfer.fromPhone,
      toName: fromUser?.name,
      amount: totalAmount,
      pricePerKg: transfer.price,
      quantity: produce.quantity,
      transferType: transfer.transferType,
      paymentId: razorpay_payment_id,
      txHash,
      status: 'COMPLETED',
      type: 'SENT'
    });

    // Transaction history — receiver ke liye (RECEIVED)
    await Transaction.create({
      produceId: transfer.produceId,
      cropType: produce.cropType,
      fromPhone: transfer.toPhone,
      fromName: toUser?.name,
      toPhone: transfer.fromPhone,
      toName: fromUser?.name,
      amount: totalAmount,
      pricePerKg: transfer.price,
      quantity: produce.quantity,
      transferType: transfer.transferType,
      paymentId: razorpay_payment_id,
      txHash,
      status: 'COMPLETED',
      type: 'RECEIVED'
    });

    // Farmer ko booking confirmation notification
    await Notification.create({
      userPhone: transfer.fromPhone,
      title: 'Booking Amount Received!',
      message: `${toUser?.name} ne ₹${bookingAmount.toLocaleString()} booking fee paid. Dispatch ke baad ₹${dispatchAmount.toLocaleString()} aur milega.`,
      type: 'PAYMENT_RECEIVED',
      data: { transferId, amount: bookingAmount, milestone: 'BOOKING', txHash }
    });

    // Distributor ko confirmation notification
    await Notification.create({
      userPhone: transfer.toPhone,
      title: 'Order Confirmed!',
      message: `${produce.cropType} blockchain pe transfer ho gaya. Ab dispatch ke baad next payment mile.`,
      type: 'TRANSFER_COMPLETE',
      data: { transferId, txHash, milestone: 'BOOKING' }
    });

    res.json({
      success: true,
      transfer,
      txHash,
      etherscanUrl: txHash ? `https://sepolia.etherscan.io/tx/${txHash}` : null,
      message: 'Payment ho gayi aur blockchain pe transfer ho gaya!'
    });

  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Transaction history
router.get('/transactions', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      $or: [
        { fromPhone: req.user.phone },
        { toPhone: req.user.phone }
      ]
    }).sort({ createdAt: -1 });

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delivery logistics list (sender + receiver dono dekh sakte hain)
router.get('/deliveries/my', auth, async (req, res) => {
  try {
    const transfers = await Transfer.find({
      $or: [
        { fromPhone: req.user.phone },
        { toPhone: req.user.phone }
      ],
      paymentStatus: 'PAID'
    }).sort({ createdAt: -1 });

    const list = [];
    for (const t of transfers) {
      const produce = await Produce.findById(t.produceId);
      list.push({
        ...t.toObject(),
        produce: produce ? produce.toObject() : null,
        canUpdate: t.fromPhone === req.user.phone
      });
    }

    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delivery logistics update (important status/location updates only)
router.put('/deliveries/:transferId', auth, async (req, res) => {
  try {
    const {
      deliveryStatus,
      driverName,
      driverPhone,
      vehicleNumber,
      vehicleType,
      expectedDeliveryTime,
      currentLocation
    } = req.body;

    const transfer = await Transfer.findById(req.params.transferId);
    if (!transfer) return res.status(404).json({ message: 'Transfer nahi mila' });

    if (transfer.fromPhone !== req.user.phone) {
      return res.status(403).json({ message: 'Sirf sender logistics update kar sakta hai' });
    }

    const oldStatus = transfer.deliveryStatus;
    const oldLocation = transfer.currentLocation;

    if (deliveryStatus) {
      const allowed = ['PENDING_DISPATCH', 'PICKUP_DISPATCHED', 'IN_TRANSIT', 'DELIVERED'];
      if (!allowed.includes(deliveryStatus)) {
        return res.status(400).json({ message: 'Invalid delivery status' });
      }
      transfer.deliveryStatus = deliveryStatus;

      if (deliveryStatus === 'PICKUP_DISPATCHED' && !transfer.pickupDispatchedAt) {
        transfer.pickupDispatchedAt = new Date();
      }
      if (deliveryStatus === 'IN_TRANSIT' && !transfer.inTransitAt) {
        transfer.inTransitAt = new Date();
      }
      if (deliveryStatus === 'DELIVERED' && !transfer.deliveredAt) {
        transfer.deliveredAt = new Date();
      }
    }

    if (driverName !== undefined) transfer.driverName = driverName;
    if (driverPhone !== undefined) transfer.driverPhone = driverPhone;
    if (vehicleNumber !== undefined) transfer.vehicleNumber = vehicleNumber;
    if (vehicleType !== undefined) transfer.vehicleType = vehicleType;
    if (currentLocation !== undefined) transfer.currentLocation = currentLocation;
    if (expectedDeliveryTime !== undefined) {
      transfer.expectedDeliveryTime = expectedDeliveryTime ? new Date(expectedDeliveryTime) : null;
    }

    await transfer.save();

    const produce = await Produce.findById(transfer.produceId);
    const crop = produce?.cropType || 'Lot';

    if (deliveryStatus && oldStatus !== transfer.deliveryStatus) {
      // Auto-release milestone payments
      const escrow = await Escrow.findOne({ transferId: req.params.transferId });
      if (escrow) {
        if (deliveryStatus === 'PICKUP_DISPATCHED') {
          await releaseMilestonePayment({ escrow, transferId: req.params.transferId, milestone: 'DISPATCH', transfer });
        }
        if (deliveryStatus === 'DELIVERED') {
          await releaseMilestonePayment({ escrow, transferId: req.params.transferId, milestone: 'DELIVERY', transfer });
        }
      }

      await notifyDeliveryParticipants({
        transfer,
        actorPhone: req.user.phone,
        title: 'Delivery Status Update',
        message: `${crop} delivery status: ${statusLabel(transfer.deliveryStatus)}`,
        type: 'DELIVERY_UPDATE',
        data: { deliveryStatus: transfer.deliveryStatus }
      });
    }

    if (currentLocation && oldLocation !== currentLocation) {
      await notifyDeliveryParticipants({
        transfer,
        actorPhone: req.user.phone,
        title: 'Location Shift Update',
        message: `${crop} shipment ab ${currentLocation} par hai`,
        type: 'LOCATION_SHIFT',
        data: { currentLocation }
      });
    }

    res.json({ success: true, transfer, message: 'Logistics update ho gaya' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Escrow - View milestone payment details
router.get('/escrow/:transferId', auth, async (req, res) => {
  try {
    const escrow = await Escrow.findOne({ transferId: req.params.transferId });
    if (!escrow) return res.status(404).json({ message: 'Escrow record nahi mila' });

    const transfer = await Transfer.findById(req.params.transferId);
    if (!transfer || (transfer.fromPhone !== req.user.phone && transfer.toPhone !== req.user.phone)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const produce = await Produce.findById(transfer.produceId);
    
    res.json({
      escrow: escrow.toObject(),
      transfer: transfer.toObject(),
      produce: produce ? produce.toObject() : null,
      progressPercentage: calculateEscrowProgress(escrow)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Escrow - View all my escrow records
router.get('/escrow/my/all', auth, async (req, res) => {
  try {
    const transfers = await Transfer.find({
      $or: [
        { fromPhone: req.user.phone },
        { toPhone: req.user.phone }
      ],
      paymentStatus: 'PAID'
    }).sort({ createdAt: -1 });

    const results = [];
    for (const t of transfers) {
      const escrow = await Escrow.findOne({ transferId: t._id });
      const produce = await Produce.findById(t.produceId);
      if (escrow) {
        results.push({
          transfer: t.toObject(),
          escrow: escrow.toObject(),
          produce: produce ? produce.toObject() : null,
          progressPercentage: calculateEscrowProgress(escrow)
        });
      }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Helper: Calculate escrow progress percentage
function calculateEscrowProgress(escrow) {
  let released = 0;
  if (escrow.bookingPaid) released += 40;
  if (escrow.dispatchReleased) released += 30;
  if (escrow.deliveryReleased) released += 30;
  return released;
}

// Escrow - Request refund for failed/rejected delivery
router.post('/escrow/:transferId/request-refund', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const escrow = await Escrow.findOne({ transferId: req.params.transferId });
    if (!escrow) return res.status(404).json({ message: 'Escrow record nahi mila' });

    const transfer = await Transfer.findById(req.params.transferId);
    if (!transfer) return res.status(404).json({ message: 'Transfer nahi mila' });

    // Only receiver can request refund
    if (transfer.toPhone !== req.user.phone) {
      return res.status(403).json({ message: 'Sirf receiver refund request kar sakta hai' });
    }

    if (escrow.status === 'REFUNDED') {
      return res.status(400).json({ message: 'Refund already processed' });
    }

    // Calculate refund amount based on what's already released
    let refundAmount = escrow.totalAmount;
    if (escrow.bookingPaid) refundAmount -= escrow.bookingAmount;
    if (escrow.dispatchReleased) refundAmount -= escrow.dispatchAmount;
    if (escrow.deliveryReleased) refundAmount -= escrow.deliveryAmount;

    escrow.refundReason = reason;
    escrow.refundAmount = refundAmount;
    escrow.refundRequestedAt = new Date();
    escrow.status = 'REFUNDED';
    escrow.refundCompletedAt = new Date();
    await escrow.save();

    // Update delivery status to show rejection
    transfer.deliveryStatus = 'DELIVERED'; // Mark as attempted delivery
    await transfer.save();

    // Notify farmer about refund request
    await Notification.create({
      userPhone: transfer.fromPhone,
      title: 'Refund Requested!',
      message: `${transfer.toPhone} ne delivery reject kiya. Reason: ${reason}. \u20b9${refundAmount.toLocaleString()} refund process mein.`,
      type: 'PAYMENT_RECEIVED',
      data: { transferId: req.params.transferId, refundAmount, reason }
    });

    res.json({
      success: true,
      message: 'Refund request submitted',
      refundAmount,
      refundReason: reason
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Notifications
router.get('/notifications', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({
      userPhone: req.user.phone
    }).sort({ createdAt: -1 }).limit(20);

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Notification read mark karo
router.put('/notifications/:id/read', auth, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
