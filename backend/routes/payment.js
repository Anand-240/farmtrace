const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const auth = require('../middleware/authMiddleware');
const Transfer = require('../models/Transfer');
const Produce = require('../models/Produce');
const { transferOnChain } = require('../blockchain/blockchainService');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Step 1: Transfer request banao
router.post('/request', auth, async (req, res) => {
  try {
    const { produceMongoId, toPhone, pricePerKg, location, transferType } = req.body;

    const produce = await Produce.findById(produceMongoId);
    if (!produce) {
      return res.status(404).json({ message: 'Produce nahi mila' });
    }

    // Transfer request save karo — PENDING status
    const transfer = await Transfer.create({
      produceId: produceMongoId,
      fromPhone: req.user.phone,
      toPhone,
      price: pricePerKg,
      location,
      transferType,
      blockchainStatus: 'PENDING',
      paymentStatus: 'PENDING'
    });

    res.json({
      success: true,
      transfer,
      message: 'Transfer request bheji gayi!'
    });

  } catch (err) {
    console.error('Request error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Step 2: Pending requests fetch karo (distributor/retailer ke liye)
router.get('/pending', auth, async (req, res) => {
  try {
    const transfers = await Transfer.find({
      toPhone: req.user.phone,
      paymentStatus: 'PENDING'
    }).sort({ createdAt: -1 });

    // Har transfer ka produce fetch karo
    const results = [];
    for (const t of transfers) {
      const produce = await Produce.findById(t.produceId);
      if (produce) {
        results.push({
          ...t.toObject(),
          produce: produce.toObject()
        });
      }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Step 3: Razorpay order create karo
router.post('/create-order', auth, async (req, res) => {
  try {
    const { transferId } = req.body;

    const transfer = await Transfer.findById(transferId);
    if (!transfer) {
      return res.status(404).json({ message: 'Transfer nahi mila' });
    }

    const produce = await Produce.findById(transfer.produceId);
    if (!produce) {
      return res.status(404).json({ message: 'Produce nahi mila' });
    }

    // Total amount calculate karo (paise mein — 1 rupee = 100 paise)
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

// Step 4: Payment verify karo aur blockchain pe transfer karo
router.post('/verify', auth, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      transferId
    } = req.body;

    // Signature verify karo
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment invalid hai' });
    }

    // Transfer fetch karo
    const transfer = await Transfer.findById(transferId);
    const produce = await Produce.findById(transfer.produceId);

    // Payment status update karo
    transfer.paymentStatus = 'PAID';
    transfer.razorpayPaymentId = razorpay_payment_id;
    transfer.razorpayOrderId = razorpay_order_id;

    // Blockchain pe transfer karo
    if (produce.produceId) {
      const toAddress = process.env.PLATFORM_PRIVATE_KEY
        ? new (require('ethers').Wallet)(process.env.PLATFORM_PRIVATE_KEY).address
        : '0x0000000000000000000000000000000000000001';

      const result = await transferOnChain(
        produce.produceId,
        toAddress,
        transfer.price,
        transfer.location
      );

      if (result.success) {
        transfer.txHash = result.txHash;
        transfer.blockchainStatus = 'CONFIRMED';
      }
    }

    await transfer.save();

    // Produce ka current owner update karo
    produce.currentOwner = transfer.toPhone;
    await produce.save();

    res.json({
      success: true,
      transfer,
      txHash: transfer.txHash,
      etherscanUrl: transfer.txHash
        ? `https://sepolia.etherscan.io/tx/${transfer.txHash}`
        : null,
      message: 'Payment ho gayi aur blockchain pe transfer ho gaya!'
    });

  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
