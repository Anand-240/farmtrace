const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const auth = require('../../middleware/authMiddleware');
const Transfer = require('../../models/Transfer');
const Produce = require('../../models/Produce');
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const { prisma } = require('../../prisma/client');
const { getHistoryFromChain } = require('../../blockchain/blockchainService');
const { blockchainQueue } = require('../../utils/queue');
const { validateSellPrice } = require('../../utils/marketPricing');
const {
  buildInvoicePayload,
  buildChallanPayload,
  buildSettlementPayload,
  buildInvoicePdf,
  buildChallanPdf,
  buildSettlementPdf,
  toAuditRows,
  toAuditCsv,
  createChecksum
} = require('../../utils/complianceDocs');
const {
  TRANSPORTERS,
  buildLogisticsPlan,
  parseSlotDateTime
} = require('../../utils/logisticsPlanner');
const { sendSms, smsTemplates } = require('../../utils/sms');
const { normalizePhone } = require('../../utils/phoneUtils');
const { pushToUser } = require('../../utils/socket');
const { sendMail, emailTemplates } = require('../../utils/email');
const logger = require('../../utils/logger').child({ module: 'payment' });

let razorpay = null;

function ensureRazorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function getRazorpayClient() {
  if (!ensureRazorpayConfigured()) return null;
  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
  return razorpay;
}

function statusLabel(status) {
  if (status === 'PENDING_DISPATCH') return 'Pending Dispatch';
  if (status === 'PICKUP_DISPATCHED') return 'Pickup Dispatched';
  if (status === 'IN_TRANSIT') return 'In Transit';
  if (status === 'DELIVERED') return 'Delivered';
  return status;
}

function getMilestoneBreakdown(totalAmount, transferType) {
  if (transferType === 'DISTRIBUTOR_TO_RETAILER') {
    // Retailer Strategy: Low booking, high delivery incentive (20/0/80)
    const booking = Math.round(totalAmount * 0.20);
    const dispatch = 0;
    const delivery = totalAmount - booking;
    return { booking, dispatch, delivery };
  } else if (transferType === 'RETAILER_TO_CONSUMER') {
    // Consumer Strategy: Full payment at booking (100/0/0)
    return { booking: totalAmount, dispatch: 0, delivery: 0 };
  } else {
    // Farmer strategy: Three-step security (40/30/30)
    const booking = Math.round(totalAmount * 0.40);
    const dispatch = Math.round(totalAmount * 0.30);
    const delivery = totalAmount - booking - dispatch;
    return { booking, dispatch, delivery };
  }
}

// Milestone payment release logic
async function releaseMilestonePayment({ escrow, transferId, milestone, transfer }) {
  if (milestone === 'DISPATCH' && !escrow.dispatchReleased) {
    escrow.dispatchReleased = true;
    escrow.dispatchReleasedAt = new Date();

    if (escrow.dispatchAmount > 0) {
      const n = await Notification.create({
        userPhone: transfer.fromPhone,
        title: 'Dispatch Payment Released!',
        message: `${transfer.toPhone} ne pickup dispatch kiya. \u20b9${escrow.dispatchAmount.toLocaleString()} payment release ho gayi!`,
        type: 'PAYMENT_RECEIVED',
        data: { transferId, amount: escrow.dispatchAmount, milestone: 'DISPATCH' }
      });
      pushToUser(transfer.fromPhone, 'notification', n.toObject());
    }
  }

  if (milestone === 'DELIVERY' && !escrow.deliveryReleased) {
    escrow.deliveryReleased = true;
    escrow.deliveryReleasedAt = new Date();
    escrow.status = 'COMPLETED';

    const n = await Notification.create({
      userPhone: transfer.fromPhone,
      title: 'Final Settlement!',
      message: `Lot delivery confirm ho gayi! Final payment \u20b9${escrow.deliveryAmount.toLocaleString()} release ho gayi.`,
      type: 'PAYMENT_RECEIVED',
      data: { transferId, amount: escrow.deliveryAmount, milestone: 'DELIVERY' }
    });
    pushToUser(transfer.fromPhone, 'notification', n.toObject());
  }
  
  await prisma.escrow.update({
    where: { id: escrow.id },
    data: {
      dispatchReleased: escrow.dispatchReleased,
      dispatchReleasedAt: escrow.dispatchReleasedAt,
      deliveryReleased: escrow.deliveryReleased,
      deliveryReleasedAt: escrow.deliveryReleasedAt,
      status: escrow.status
    }
  });
}

async function notifyDeliveryParticipants({ transfer, actorPhone, title, message, type, data = {} }) {
  const targets = [transfer.fromPhone, transfer.toPhone].filter(Boolean);
  const notifs = await Promise.all(targets.map((phone) => Notification.create({
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
  notifs.forEach((n) => pushToUser(n.userPhone, 'notification', n.toObject()));
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '';
}

function getFinancialYearTag(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  const endYear = (startYear + 1).toString().slice(-2);
  return `${startYear}-${endYear}`;
}

function toDocPrefix(documentType) {
  if (documentType === 'INVOICE') return 'INV';
  if (documentType === 'CHALLAN') return 'CHL';
  if (documentType === 'SETTLEMENT') return 'SET';
  return 'DOC';
}

async function nextDocumentNumber(documentType, createdAt = new Date()) {
  const prefix = toDocPrefix(documentType);
  const fy = getFinancialYearTag(createdAt);
  const sequenceKey = `${prefix}:${fy}`;

  const sequence = await prisma.complianceSequence.upsert({
    where: { key: sequenceKey },
    update: { value: { increment: 1 } },
    create: { key: sequenceKey, value: 1 }
  });

  return `${prefix}/${fy}/${String(sequence.value).padStart(6, '0')}`;
}

async function getOrCreateComplianceDocument({ transferId, documentType, metadata = {}, createdAt }) {
  const existing = await prisma.complianceDocument.findUnique({
    where: {
      transferId_documentType: {
        transferId: transferId.toString(),
        documentType
      }
    }
  });
  if (existing) return existing;

  const documentNumber = await nextDocumentNumber(documentType, createdAt || new Date());
  return prisma.complianceDocument.create({
    data: {
      transferId: transferId.toString(),
      documentType,
      documentNumber,
      metadata: metadata || {}
    }
  });
}

async function createComplianceAudit({ req, transferId, documentType, action, checksum, metadata = {} }) {
  try {
    await prisma.complianceAudit.create({
      data: {
        transferId: transferId ? transferId.toString() : null,
        documentType,
        action,
        requestedByPhone: req.user.phone,
        requestedByRole: req.user.role || 'USER',
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') || '',
        checksum,
        metadata: metadata || {}
      }
    });
  } catch (err) {
    console.error('Compliance audit log error:', err.message);
  }
}

async function fetchDocumentContext(transferId, actorPhone) {
  const transfer = await Transfer.findById(transferId);
  if (!transfer) {
    return { status: 404, error: 'Transfer nahi mila' };
  }

  if (transfer.fromPhone !== actorPhone && transfer.toPhone !== actorPhone) {
    return { status: 403, error: 'Access denied: aap is transfer ka hissa nahi ho' };
  }

  let produce = null;
  if (transfer.produceId) {
    produce = await Produce.findById(transfer.produceId);
    if (!produce) {
      produce = await Produce.findOne({ produceId: transfer.produceId });
    }
  }

  const [fromUser, toUser, escrow] = await Promise.all([
    User.findOne({ phone: transfer.fromPhone }).select('name phone village city district state pincode businessName gstin pan'),
    User.findOne({ phone: transfer.toPhone }).select('name phone village city district state pincode businessName gstin pan'),
    prisma.escrow.findUnique({ where: { transferId: transfer._id.toString() } })
  ]);

  return {
    transfer,
    produce,
    fromUser,
    toUser,
    escrow
  };
}

// Helper: resolve transfer produce from multiple ID fields
async function resolveTransferProduce(transfer) {
  const mongoose = require('mongoose');
  if (!transfer) return null;
  
  // Try mongoId first
  if (transfer.produceMongoId) {
    const p = await Produce.findById(transfer.produceMongoId);
    if (p) return p;
  }
  
  // Try chainId
  if (transfer.produceChainId) {
    const p = await Produce.findOne({ produceId: transfer.produceChainId });
    if (p) return p;
  }
  
  // Try legacy produceId as ObjectId
  if (transfer.produceId && mongoose.Types.ObjectId.isValid(transfer.produceId)) {
    const p = await Produce.findById(transfer.produceId);
    if (p) return p;
  }
  
  // Try legacy produceId as chain id
  if (transfer.produceId) {
    const p = await Produce.findOne({ produceId: transfer.produceId });
    if (p) return p;
  }
  
  return null;
}

function streamPdf(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', String(buffer.length));
  return res.send(buffer);
}

function streamJson(res, payload, filename) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(JSON.stringify(payload, null, 2));
}

function streamCsv(res, csv, filename) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
}

// Transfer request banao
router.post('/request', auth, async (req, res) => {
  try {
    if (req.user.kycStatus !== 'VERIFIED') {
      return res.status(403).json({
        message: 'KYC verification zaroori hai transfer karne ke liye',
        kycRequired: true
      });
    }

    const { produceMongoId, toPhone, toEmail, pricePerKg, location, transferType } = req.body;

    const produce = await Produce.findById(produceMongoId);
    if (!produce) return res.status(404).json({ message: 'Produce nahi mila' });

    const sellValidation = await validateSellPrice({
      produce,
      requestedPrice: pricePerKg,
      transferType
    });

    if (!sellValidation.allowed) {
      return res.status(400).json({
        message: sellValidation.reason,
        floorPrice: sellValidation.floorPrice || null,
        mandiPrice: sellValidation.mandiPrice || null,
        mspPrice: sellValidation.mspPrice || null,
        floorSource: sellValidation.floorSource || null,
        floorLabel: sellValidation.floorLabel || null,
        commodity: sellValidation.commodity || null,
        state: sellValidation.state || null
      });
    }

    const normalizedEmail = toEmail?.trim().toLowerCase();
    const toUser = await User.findOne(
      normalizedEmail ? { email: normalizedEmail } : { phone: normalizePhone(toPhone) }
    );
    if (!toUser) {
      return res.status(404).json({ message: normalizedEmail ? 'Receiver nahi mila — email check karo' : 'Receiver nahi mila — phone check karo' });
    }

    const transfer = await Transfer.create({
      produceMongoId: produce._id,
      produceChainId: produce.produceId || null,
      produceId: String(produce._id),
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
    const requestNotif = await Notification.create({
      userPhone: toUser.phone,
      title: 'Naya Transfer Request',
      message: `${req.user.name} ne ${produce.cropType} transfer karne ki request bheji hai — ₹${pricePerKg}/kg`,
      type: 'REQUEST_RECEIVED',
      data: { transferId: transfer._id, produceId: produceMongoId }
    });
    pushToUser(toUser.phone, 'notification', requestNotif.toObject());

    if (toUser.email) {
      sendMail({
        to: toUser.email,
        ...emailTemplates.transferRequest({
          recipientName: toUser.name,
          senderName: req.user.name,
          cropType: produce.cropType,
          pricePerKg,
          location
        })
      }).catch(() => {});
    }

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
      const produce = await resolveTransferProduce(t);
      if (produce) {
        results.push({ ...t.toObject(), produce: produce.toObject() });
      }
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn('RAZORPAY_WEBHOOK_SECRET is not set, skipping webhook validation');
      return res.status(200).send('OK');
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).send('No signature found');
    }

    // req.body should be a Buffer because of express.raw() in index.js
    const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('Invalid Razorpay webhook signature');
      return res.status(400).send('Invalid signature');
    }

    // Verify event type
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : (Buffer.isBuffer(req.body) ? JSON.parse(payload) : req.body);
    
    // Example: Handle payment completion or other events
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      console.log('Razorpay webhook event:', event.event);
    }
    
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Razorpay Webhook Error:', err);
    res.status(500).send('Webhook Processing Error');
  }
});

// Razorpay order create
router.post('/create-order', auth, async (req, res) => {
  try {
    if (req.user.kycStatus !== 'VERIFIED') {
      return res.status(403).json({
        message: 'KYC verification zaroori hai payment karne ke liye',
        kycRequired: true
      });
    }

    if (!ensureRazorpayConfigured()) {
      return res.status(500).json({ message: 'Razorpay config missing on server' });
    }
    const razorpayClient = getRazorpayClient();

    const { transferId } = req.body;

    const transfer = await Transfer.findById(transferId);
    if (!transfer) return res.status(404).json({ message: 'Transfer nahi mila' });

    const produce = await resolveTransferProduce(transfer);
    if (!produce) return res.status(404).json({ message: 'Produce nahi mila' });

    const totalAmountRaw = transfer.price * produce.quantity * 100;
    
    // Differentiated milestone breakdown
    const { booking: bookingAmount, dispatch: dispatchAmount, delivery: deliveryAmount } = 
      getMilestoneBreakdown(totalAmountRaw, transfer.transferType);

    // Razorpay Test Mode Cap: prevent "Amount exceeds maximum amount allowed" (usually ₹50,000)
    let finalBookingAmount = bookingAmount;
    const isTestMode = process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_');
    if (isTestMode && finalBookingAmount > 5000000) {
      logger.warn({ originalAmount: bookingAmount, cappedAmount: 5000000 }, 'Capping test payment to ₹50,000');
      finalBookingAmount = 5000000;
    }

    const order = await razorpayClient.orders.create({
      amount: finalBookingAmount,
      currency: 'INR',
      receipt: `transfer_${transferId}`,
      notes: {
        transferId: transferId.toString(),
        produceId: transfer.produceId.toString(),
        fromPhone: transfer.fromPhone,
        toPhone: transfer.toPhone,
        paymentType: 'MILESTONE_BOOKING',
        booking: (bookingAmount / 100).toString(),
        dispatch: (dispatchAmount / 100).toString(),
        delivery: (deliveryAmount / 100).toString(),
        totalAmount: (totalAmountRaw / 100).toString(),
        isCapped: (finalBookingAmount !== bookingAmount).toString()
      }
    });

    logger.info({ orderId: order.id, amount: finalBookingAmount, transferId }, 'Razorpay order created on server');

    res.json({
      success: true,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: finalBookingAmount,
      currency: 'INR',
      totalAmount: totalAmountRaw / 100,
      payableNow: bookingAmount / 100,
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
    if (!ensureRazorpayConfigured()) {
      return res.status(500).json({ message: 'Razorpay config missing on server' });
    }
    getRazorpayClient();

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
    const produce = await resolveTransferProduce(transfer);
    const fromUser = await User.findOne({ phone: transfer.fromPhone });
    const toUser = await User.findOne({ phone: transfer.toPhone });

    const totalAmount = transfer.price * produce.quantity;
    const { booking: bookingAmount, dispatch: dispatchAmount, delivery: deliveryAmount } = 
      getMilestoneBreakdown(totalAmount, transfer.transferType);

    // Payment status update - sirf booking stage clear hua
    transfer.paymentStatus = 'PAID';
    transfer.razorpayPaymentId = razorpay_payment_id;
    transfer.razorpayOrderId = razorpay_order_id;

    // Blockchain pe transfer (immediate booking ke baad)
    let jobId = null;
    const chainProduceId = transfer.produceChainId || produce?.produceId || transfer.produceId;
    if (chainProduceId) { // Removed strict produce?.produceId check to allow worker to try fallback
      const toAddress = new (require('ethers').Wallet)(
        process.env.PLATFORM_PRIVATE_KEY
      ).address;

      if (blockchainQueue) {
        const job = await blockchainQueue.add('transfer', {
          type: 'TRANSFER',
          data: { produceId: chainProduceId, toAddress, price: transfer.price, location: transfer.location },
          transferMongoId: transfer._id
        });
        jobId = job.id;
      }
    }

    await transfer.save();

    // Produce owner update
    if (produce) {
      produce.currentOwner = transfer.toPhone;
      await produce.save();
    }

    // Escrow record banao for milestone tracking
    await prisma.escrow.create({
      data: {
        transferId: transfer._id.toString(),
        totalAmount,
        bookingAmount,
        dispatchAmount,
        deliveryAmount,
        bookingPaid: true,
        bookingPaidAt: new Date(),
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        status: 'ACTIVE'
      }
    });

    // Transaction history — sender ke liye (SENT)
    await prisma.transaction.create({
      data: {
        produceId: String(transfer.produceMongoId || transfer.produceId),
        cropType: produce?.cropType,
        fromPhone: transfer.toPhone,
        fromName: toUser?.name,
        toPhone: transfer.fromPhone,
        toName: fromUser?.name,
        amount: bookingAmount,
        pricePerKg: transfer.price,
        quantity: produce?.quantity,
        transferType: transfer.transferType,
        paymentId: razorpay_payment_id,
        txHash: null,
        status: 'BOOKING_PAID',
        type: 'SENT'
      }
    });

    // Transaction history — receiver ke liye (RECEIVED)
    await prisma.transaction.create({
      data: {
        produceId: String(transfer.produceMongoId || transfer.produceId),
        cropType: produce?.cropType,
        fromPhone: transfer.toPhone,
        fromName: toUser?.name,
        toPhone: transfer.fromPhone,
        toName: fromUser?.name,
        amount: bookingAmount,
        pricePerKg: transfer.price,
        quantity: produce?.quantity,
        transferType: transfer.transferType,
        paymentId: razorpay_payment_id,
        txHash: null,
        status: 'BOOKING_PAID',
        type: 'RECEIVED'
      }
    });

    // Farmer ko booking confirmation notification
    const farmerNotif = await Notification.create({
      userPhone: transfer.fromPhone,
      title: 'Booking Amount Received!',
      message: `${toUser?.name} ne ₹${bookingAmount.toLocaleString()} booking fee paid. Dispatch ke baad ₹${dispatchAmount.toLocaleString()} aur milega.`,
      type: 'PAYMENT_RECEIVED',
      data: { transferId, amount: bookingAmount, milestone: 'BOOKING' }
    });
    pushToUser(transfer.fromPhone, 'notification', farmerNotif.toObject());

    // Distributor ko confirmation notification
    const buyerNotif = await Notification.create({
      userPhone: transfer.toPhone,
      title: 'Order Confirmed!',
      message: `${produce.cropType} payment verify ho gaya. Blockchain transfer processing in background.`,
      type: 'TRANSFER_COMPLETE',
      data: { transferId, milestone: 'BOOKING' }
    });
    pushToUser(transfer.toPhone, 'notification', buyerNotif.toObject());

    // Email: farmer booking confirmation
    if (fromUser?.email) {
      const tmpl = emailTemplates.bookingConfirmed({
        recipientName: fromUser.name,
        cropType: produce.cropType,
        bookingAmount,
        dispatchAmount
      });
      sendMail({ to: fromUser.email, ...tmpl }).catch(() => {});
    }

    // Email: buyer order confirmation
    if (toUser?.email) {
      const tmpl = emailTemplates.orderConfirmed({
        recipientName: toUser.name,
        cropType: produce.cropType,
        milestones: { booking: bookingAmount, dispatch: dispatchAmount, delivery: deliveryAmount },
        totalAmount
      });
      sendMail({ to: toUser.email, ...tmpl }).catch(() => {});
    }

    // SMS: Farmer ko booking confirmation
    sendSms(
      fromUser?.phone,
      smsTemplates.bookingReceived(fromUser?.name || 'Kisan', produce?.cropType || 'Fasal', bookingAmount)
    ).catch(() => {}); // non-blocking

    res.json({
      success: true,
      transfer,
      jobId,
      message: 'Payment verified and blockchain transfer queued for processing!'
    });

  } catch (err) {
    logger.error({ err }, 'Payment verify error');
    res.status(500).json({ message: err.message });
  }
});

// Transaction history
router.get('/transactions', auth, async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { fromPhone: req.user.phone },
          { toPhone: req.user.phone }
        ]
      },
      orderBy: { createdAt: 'desc' }
    }).catch(err => {
      logger.error({ err: err.message }, 'Transactions database fetch failed');
      return []; // Return empty instead of crashing
    });

    res.json(transactions);
  } catch (err) {
    logger.error({ err: err.message }, 'Transactions route error');
    res.json([]); // Fail-safe
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
      const produce = await resolveTransferProduce(t);
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
      currentLocation,
      destinationLocation,
      deliveryRemarks
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
    if (destinationLocation !== undefined) transfer.destinationLocation = destinationLocation;
    if (deliveryRemarks !== undefined) transfer.deliveryRemarks = deliveryRemarks;
    if (expectedDeliveryTime !== undefined) {
      transfer.expectedDeliveryTime = expectedDeliveryTime ? new Date(expectedDeliveryTime) : null;
    }

    await transfer.save();

    const produce = await resolveTransferProduce(transfer);
    const crop = produce?.cropType || 'Lot';

    if (deliveryStatus && oldStatus !== transfer.deliveryStatus) {
      // Auto-release milestone payments
      const escrow = await prisma.escrow.findUnique({ where: { transferId: req.params.transferId } });
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

      // SMS + Email triggers on status change
      const [farmerUser, buyerUser] = await Promise.all([
        User.findOne({ phone: transfer.fromPhone }),
        User.findOne({ phone: transfer.toPhone })
      ]);

      if (deliveryStatus === 'PICKUP_DISPATCHED') {
        if (farmerUser?.phone) {
          sendSms(
            farmerUser.phone,
            smsTemplates.dispatchInitiated(crop, transfer.matchedTransporter?.name || 'Transporter', transfer.vehicleType || 'Vehicle')
          ).catch(() => {});
        }
        [farmerUser, buyerUser].forEach((u) => {
          if (u?.email) {
            sendMail({
              to: u.email,
              ...emailTemplates.deliveryUpdate({ recipientName: u.name, cropType: crop, status: 'Pickup Dispatched', location: transfer.currentLocation })
            }).catch(() => {});
          }
        });
      }

      if (deliveryStatus === 'IN_TRANSIT') {
        [farmerUser, buyerUser].forEach((u) => {
          if (u?.email) {
            sendMail({
              to: u.email,
              ...emailTemplates.deliveryUpdate({ recipientName: u.name, cropType: crop, status: 'In Transit', location: transfer.currentLocation })
            }).catch(() => {});
          }
        });
      }

      if (deliveryStatus === 'DELIVERED') {
        if (buyerUser?.phone) {
          sendSms(
            buyerUser.phone,
            smsTemplates.deliveryConfirmed(crop, transfer.price)
          ).catch(() => {});
        }
        [farmerUser, buyerUser].forEach((u) => {
          if (u?.email) {
            sendMail({
              to: u.email,
              ...emailTemplates.deliveryUpdate({ recipientName: u.name, cropType: crop, status: 'Delivered', location: transfer.currentLocation })
            }).catch(() => {});
          }
        });
      }
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

router.post('/logistics/:transferId/preview', auth, async (req, res) => {
  try {
    const { destinationLocation, preferredVehicleType } = req.body;

    const transfer = await Transfer.findById(req.params.transferId);
    if (!transfer) return res.status(404).json({ message: 'Transfer nahi mila' });

    if (transfer.fromPhone !== req.user.phone && transfer.toPhone !== req.user.phone) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const produce = await resolveTransferProduce(transfer);
    const quantityKg = Number(produce?.quantity || 0);

    const origin = transfer.currentLocation || transfer.location;
    const destination = destinationLocation || transfer.destinationLocation;
    if (!destination) {
      return res.status(400).json({ message: 'Destination location required hai' });
    }

    const plan = buildLogisticsPlan({
      origin,
      destination,
      quantityKg,
      preferredVehicleType
    });

    return res.json({
      transferId: transfer._id,
      origin,
      destination,
      quantityKg,
      ...plan
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get('/logistics/:transferId', auth, async (req, res) => {
  try {
    const transfer = await Transfer.findById(req.params.transferId);
    if (!transfer) return res.status(404).json({ message: 'Transfer nahi mila' });

    if (transfer.fromPhone !== req.user.phone && transfer.toPhone !== req.user.phone) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.json({
      transferId: transfer._id,
      destinationLocation: transfer.destinationLocation || '',
      routeDistanceKm: transfer.routeDistanceKm || 0,
      routeEtaMinutes: transfer.routeEtaMinutes || 0,
      freightEstimateAmount: transfer.freightEstimateAmount || 0,
      freightCurrency: transfer.freightCurrency || 'INR',
      matchedTransporter: transfer.matchedTransporter || null,
      deliverySlotDate: transfer.deliverySlotDate || null,
      deliverySlotLabel: transfer.deliverySlotLabel || '',
      deliverySlotBookedAt: transfer.deliverySlotBookedAt || null,
      slots: buildLogisticsPlan({
        origin: transfer.currentLocation || transfer.location,
        destination: transfer.destinationLocation || transfer.location,
        quantityKg: 0,
        preferredVehicleType: transfer.vehicleType || ''
      }).availableSlots
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post('/logistics/:transferId/book-slot', auth, async (req, res) => {
  try {
    const {
      destinationLocation,
      preferredVehicleType,
      transporterId,
      slotDate,
      slotLabel
    } = req.body;

    const transfer = await Transfer.findById(req.params.transferId);
    if (!transfer) return res.status(404).json({ message: 'Transfer nahi mila' });

    if (transfer.fromPhone !== req.user.phone) {
      return res.status(403).json({ message: 'Sirf sender slot book kar sakta hai' });
    }

    if (!destinationLocation || !slotDate || !slotLabel) {
      return res.status(400).json({ message: 'Destination, slot date aur slot label required hain' });
    }

    const produce = await resolveTransferProduce(transfer);
    const quantityKg = Number(produce?.quantity || 0);

    const plan = buildLogisticsPlan({
      origin: transfer.currentLocation || transfer.location,
      destination: destinationLocation,
      quantityKg,
      preferredVehicleType
    });

    const selectedTransporter = plan.matchedTransporters.find((item) => item.transporterId === transporterId)
      || TRANSPORTERS.find((item) => item.transporterId === transporterId)
      || plan.matchedTransporters[0]
      || null;

    if (!selectedTransporter) {
      return res.status(400).json({ message: 'No transporter available for selected criteria' });
    }

    const slotDateTime = parseSlotDateTime(slotDate, slotLabel);
    if (!slotDateTime) {
      return res.status(400).json({ message: 'Invalid slot date/time' });
    }

    transfer.destinationLocation = destinationLocation;
    transfer.routeDistanceKm = plan.route.distanceKm;
    transfer.routeEtaMinutes = plan.route.etaMinutes;
    transfer.freightEstimateAmount = plan.freight.amount;
    transfer.freightCurrency = plan.freight.currency;
    transfer.expectedDeliveryTime = new Date(slotDateTime.getTime() + (plan.route.etaMinutes * 60000));

    transfer.matchedTransporter = {
      transporterId: selectedTransporter.transporterId,
      name: selectedTransporter.name,
      phone: selectedTransporter.phone,
      vehicleType: selectedTransporter.vehicleType,
      vehicleCapacityKg: selectedTransporter.vehicleCapacityKg,
      rating: selectedTransporter.rating,
      pricePerKm: selectedTransporter.pricePerKm
    };

    transfer.vehicleType = selectedTransporter.vehicleType;
    transfer.driverPhone = selectedTransporter.phone;
    transfer.deliverySlotDate = slotDateTime;
    transfer.deliverySlotLabel = slotLabel;
    transfer.deliverySlotBookedAt = new Date();
    transfer.deliverySlotBookedBy = req.user.phone;

    await transfer.save();

    await notifyDeliveryParticipants({
      transfer,
      actorPhone: req.user.phone,
      title: 'Delivery Slot Booked',
      message: `${selectedTransporter.name} assigned | ${slotDate} ${slotLabel} | ETA ${Math.ceil(plan.route.etaMinutes / 60)}h`,
      type: 'DELIVERY_UPDATE',
      data: {
        destinationLocation,
        slotDate,
        slotLabel,
        transporterId: selectedTransporter.transporterId,
        routeDistanceKm: plan.route.distanceKm,
        etaMinutes: plan.route.etaMinutes,
        freightEstimateAmount: plan.freight.amount
      }
    });

    // SMS: Buyer ko dispatch notification
    const buyerUser = await User.findOne({ phone: transfer.toPhone });
    if (buyerUser?.phone) {
      sendSms(
        buyerUser.phone,
        smsTemplates.dispatchInitiated(
          produce?.cropType || 'Fasal',
          selectedTransporter.name,
          selectedTransporter.vehicleType
        )
      ).catch(() => {});
    }

    return res.json({
      success: true,
      message: 'Delivery slot booked successfully',
      transfer,
      logistics: {
        route: plan.route,
        freight: plan.freight,
        transporter: selectedTransporter
      }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Escrow - View milestone payment details
router.get('/escrow/:transferId', auth, async (req, res) => {
  try {
    const escrow = await prisma.escrow.findUnique({ where: { transferId: req.params.transferId } });
    if (!escrow) return res.status(404).json({ message: 'Escrow record nahi mila' });

    const transfer = await Transfer.findById(req.params.transferId);
    if (!transfer || (transfer.fromPhone !== req.user.phone && transfer.toPhone !== req.user.phone)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const produce = await resolveTransferProduce(transfer);
    
    res.json({
      escrow: escrow,
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
      const escrow = await prisma.escrow.findUnique({ where: { transferId: t._id.toString() } });
      const produce = await resolveTransferProduce(t);
      if (escrow) {
        results.push({
          transfer: t.toObject(),
          escrow: escrow,
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
    const escrow = await prisma.escrow.findUnique({ where: { transferId: req.params.transferId } });
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

    await prisma.escrow.update({
      where: { id: escrow.id },
      data: {
        refundReason: reason,
        refundAmount: refundAmount,
        refundRequestedAt: new Date(),
        status: 'REFUNDED',
        refundCompletedAt: new Date()
      }
    });

    // Update delivery status to show rejection
    transfer.deliveryStatus = 'DELIVERED'; // Mark as attempted delivery
    await transfer.save();

    // Notify farmer about refund request
    const refundNotif = await Notification.create({
      userPhone: transfer.fromPhone,
      title: 'Refund Requested!',
      message: `${transfer.toPhone} ne delivery reject kiya. Reason: ${reason}. \u20b9${refundAmount.toLocaleString()} refund process mein.`,
      type: 'PAYMENT_RECEIVED',
      data: { transferId: req.params.transferId, refundAmount, reason }
    });
    pushToUser(transfer.fromPhone, 'notification', refundNotif.toObject());

    const farmerUser = await User.findOne({ phone: transfer.fromPhone });
    if (farmerUser?.email) {
      const produce = await resolveTransferProduce(transfer);
      sendMail({
        to: farmerUser.email,
        ...emailTemplates.refundRequested({
          farmerName: farmerUser.name,
          buyerPhone: transfer.toPhone,
          cropType: produce?.cropType || 'Fasal',
          refundAmount,
          reason
        })
      }).catch(() => {});
    }

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

// Production-grade compliance docs: invoice PDF
router.get('/docs/:transferId/invoice', auth, async (req, res) => {
  try {
    const context = await fetchDocumentContext(req.params.transferId, req.user.phone);
    if (context.error) {
      return res.status(context.status).json({ message: context.error });
    }

    const docRecord = await getOrCreateComplianceDocument({
      transferId: context.transfer._id,
      documentType: 'INVOICE',
      metadata: { transferType: context.transfer.transferType },
      createdAt: context.transfer.createdAt
    });

    const invoicePayload = buildInvoicePayload({ ...context, documentNumber: docRecord.documentNumber });
    const checksum = createChecksum(invoicePayload);
    const buffer = await buildInvoicePdf(invoicePayload);

    await prisma.complianceDocument.update({
      where: { id: docRecord.id },
      data: { checksum, generatedAt: new Date() }
    });

    await createComplianceAudit({
      req,
      transferId: context.transfer._id,
      documentType: 'INVOICE',
      action: 'GENERATED',
      checksum,
      metadata: {
        documentNumber: invoicePayload.documentNumber,
        grossTotal: invoicePayload.grossTotal,
        transferType: context.transfer.transferType
      }
    });

    await createComplianceAudit({
      req,
      transferId: context.transfer._id,
      documentType: 'INVOICE',
      action: 'DOWNLOADED',
      checksum,
      metadata: { filename: `${invoicePayload.documentNumber}.pdf` }
    });

    return streamPdf(res, buffer, `${invoicePayload.documentNumber}.pdf`);
  } catch (err) {
    console.error('Invoice doc error:', err.message);
    return res.status(500).json({ message: 'Invoice generate nahi ho paya' });
  }
});

// Production-grade compliance docs: delivery challan PDF
router.get('/docs/:transferId/challan', auth, async (req, res) => {
  try {
    const context = await fetchDocumentContext(req.params.transferId, req.user.phone);
    if (context.error) {
      return res.status(context.status).json({ message: context.error });
    }

    const docRecord = await getOrCreateComplianceDocument({
      transferId: context.transfer._id,
      documentType: 'CHALLAN',
      metadata: { transferType: context.transfer.transferType },
      createdAt: context.transfer.createdAt
    });

    const challanPayload = buildChallanPayload({ ...context, documentNumber: docRecord.documentNumber });
    const checksum = createChecksum(challanPayload);
    const buffer = await buildChallanPdf(challanPayload);

    await prisma.complianceDocument.update({
      where: { id: docRecord.id },
      data: { checksum, generatedAt: new Date() }
    });

    await createComplianceAudit({
      req,
      transferId: context.transfer._id,
      documentType: 'CHALLAN',
      action: 'GENERATED',
      checksum,
      metadata: {
        documentNumber: challanPayload.documentNumber,
        deliveryStatus: context.transfer.deliveryStatus
      }
    });

    await createComplianceAudit({
      req,
      transferId: context.transfer._id,
      documentType: 'CHALLAN',
      action: 'DOWNLOADED',
      checksum,
      metadata: { filename: `${challanPayload.documentNumber}.pdf` }
    });

    return streamPdf(res, buffer, `${challanPayload.documentNumber}.pdf`);
  } catch (err) {
    console.error('Challan doc error:', err.message);
    return res.status(500).json({ message: 'Challan generate nahi ho paya' });
  }
});

// Production-grade compliance docs: settlement statement PDF
router.get('/docs/:transferId/settlement', auth, async (req, res) => {
  try {
    const context = await fetchDocumentContext(req.params.transferId, req.user.phone);
    if (context.error) {
      return res.status(context.status).json({ message: context.error });
    }

    const docRecord = await getOrCreateComplianceDocument({
      transferId: context.transfer._id,
      documentType: 'SETTLEMENT',
      metadata: { transferType: context.transfer.transferType },
      createdAt: context.transfer.createdAt
    });

    const settlementPayload = buildSettlementPayload({ ...context, documentNumber: docRecord.documentNumber });
    const checksum = createChecksum(settlementPayload);
    const buffer = await buildSettlementPdf(settlementPayload);

    await prisma.complianceDocument.update({
      where: { id: docRecord.id },
      data: { checksum, generatedAt: new Date() }
    });

    await createComplianceAudit({
      req,
      transferId: context.transfer._id,
      documentType: 'SETTLEMENT',
      action: 'GENERATED',
      checksum,
      metadata: {
        documentNumber: settlementPayload.documentNumber,
        status: settlementPayload.status
      }
    });

    await createComplianceAudit({
      req,
      transferId: context.transfer._id,
      documentType: 'SETTLEMENT',
      action: 'DOWNLOADED',
      checksum,
      metadata: { filename: `${settlementPayload.documentNumber}.pdf` }
    });

    return streamPdf(res, buffer, `${settlementPayload.documentNumber}.pdf`);
  } catch (err) {
    console.error('Settlement doc error:', err.message);
    return res.status(500).json({ message: 'Settlement statement generate nahi ho paya' });
  }
});

// Downloadable audit trail for compliance and B2B buyers
router.get('/docs/:transferId/audit-trail', auth, async (req, res) => {
  try {
    const context = await fetchDocumentContext(req.params.transferId, req.user.phone);
    if (context.error) {
      return res.status(context.status).json({ message: context.error });
    }

    const [invoiceDoc, challanDoc, settlementDoc] = await Promise.all([
      getOrCreateComplianceDocument({
        transferId: context.transfer._id,
        documentType: 'INVOICE',
        metadata: { transferType: context.transfer.transferType },
        createdAt: context.transfer.createdAt
      }),
      getOrCreateComplianceDocument({
        transferId: context.transfer._id,
        documentType: 'CHALLAN',
        metadata: { transferType: context.transfer.transferType },
        createdAt: context.transfer.createdAt
      }),
      getOrCreateComplianceDocument({
        transferId: context.transfer._id,
        documentType: 'SETTLEMENT',
        metadata: { transferType: context.transfer.transferType },
        createdAt: context.transfer.createdAt
      })
    ]);

    const invoicePayload = buildInvoicePayload({ ...context, documentNumber: invoiceDoc.documentNumber });
    const challanPayload = buildChallanPayload({ ...context, documentNumber: challanDoc.documentNumber });
    const settlementPayload = buildSettlementPayload({ ...context, documentNumber: settlementDoc.documentNumber });
    const timelineRows = toAuditRows({
      transfer: context.transfer,
      produce: context.produce,
      escrow: context.escrow,
      invoice: invoicePayload,
      challan: challanPayload,
      settlement: settlementPayload,
      requestedByPhone: req.user.phone
    });

    const persistedLogs = await prisma.complianceAudit.findMany({
      where: { transferId: context.transfer._id.toString() },
      orderBy: { createdAt: 'asc' }
    });

    const payload = {
      generatedAt: new Date().toISOString(),
      transferId: String(context.transfer._id),
      documents: {
        invoice: invoicePayload.documentNumber,
        challan: challanPayload.documentNumber,
        settlement: settlementPayload.documentNumber
      },
      checksums: {
        invoice: createChecksum(invoicePayload),
        challan: createChecksum(challanPayload),
        settlement: createChecksum(settlementPayload)
      },
      timelineRows,
      auditLogs: persistedLogs.map((item) => ({
        when: item.createdAt,
        documentType: item.documentType,
        action: item.action,
        by: item.requestedByPhone,
        role: item.requestedByRole,
        ipAddress: item.ipAddress,
        checksum: item.checksum,
        metadata: item.metadata || null
      }))
    };

    const checksum = createChecksum(payload);
    await createComplianceAudit({
      req,
      transferId: context.transfer._id,
      documentType: 'AUDIT',
      action: 'GENERATED',
      checksum,
      metadata: {
        format: req.query.format === 'csv' ? 'csv' : 'json',
        events: payload.timelineRows.length,
        logs: payload.auditLogs.length
      }
    });

    await createComplianceAudit({
      req,
      transferId: context.transfer._id,
      documentType: 'AUDIT',
      action: 'DOWNLOADED',
      checksum,
      metadata: {
        format: req.query.format === 'csv' ? 'csv' : 'json'
      }
    });

    if (req.query.format === 'csv') {
      const csv = toAuditCsv([
        ...timelineRows,
        ...payload.auditLogs.map((item) => ({
          event: `${item.documentType}_${item.action}`,
          timestamp: item.when,
          transferId: payload.transferId,
          actor: item.by,
          details: JSON.stringify(item.metadata || {})
        }))
      ]);
      return streamCsv(res, csv, `AUD-${payload.transferId.slice(-6).toUpperCase()}.csv`);
    }

    return streamJson(res, { ...payload, checksum }, `AUD-${payload.transferId.slice(-6).toUpperCase()}.json`);
  } catch (err) {
    console.error('Audit trail error:', err.message);
    return res.status(500).json({ message: 'Audit trail generate nahi ho paya' });
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
