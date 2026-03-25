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
const { transferOnChain } = require('../blockchain/blockchainService');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

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
      transferType,
      blockchainStatus: 'PENDING',
      paymentStatus: 'PENDING'
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

    const order = await razorpay.orders.create({
      amount: totalAmount,
      currency: 'INR',
      receipt: `transfer_${transferId}`,
      notes: {
        transferId: transferId.toString(),
        produceId: transfer.produceId.toString(),
        fromPhone: transfer.fromPhone,
        toPhone: transfer.toPhone
      }
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: totalAmount,
      currency: 'INR',
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

    // Payment status update
    transfer.paymentStatus = 'PAID';
    transfer.razorpayPaymentId = razorpay_payment_id;
    transfer.razorpayOrderId = razorpay_order_id;

    // Blockchain pe transfer
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

    // Farmer ko payment notification
    await Notification.create({
      userPhone: transfer.fromPhone,
      title: 'Payment Mil Gayi!',
      message: `${toUser?.name} ne ${produce.cropType} ke liye ₹${totalAmount.toLocaleString()} payment ki!`,
      type: 'PAYMENT_RECEIVED',
      data: { transferId, amount: totalAmount, txHash }
    });

    // Distributor ko confirmation notification
    await Notification.create({
      userPhone: transfer.toPhone,
      title: 'Transfer Complete!',
      message: `${produce.cropType} blockchain pe transfer ho gaya. TX: ${txHash?.slice(0,20)}...`,
      type: 'TRANSFER_COMPLETE',
      data: { transferId, txHash }
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
