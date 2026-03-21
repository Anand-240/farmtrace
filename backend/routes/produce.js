const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const mongoose = require('mongoose');
const auth = require('../middleware/authMiddleware');
const Produce = require('../models/Produce');
const Transfer = require('../models/Transfer');
const { registerOnChain, getHistoryFromChain } = require('../blockchain/blockchainService');

// BigInt ko string mein convert karo
function serializeBlockchain(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

// Produce register karo
router.post('/register', auth, async (req, res) => {
  try {
    const { farmerName, cropType, origin, quantity, qualityGrade, farmPrice } = req.body;

    const produce = await Produce.create({
      farmerName, cropType, origin, quantity,
      qualityGrade, farmPrice,
      farmerPhone: req.user.phone,
      currentOwner: req.user.phone,
      blockchainStatus: 'PENDING'
    });

    const result = await registerOnChain(farmerName, cropType, origin, farmPrice);

    if (result.success) {
      produce.produceId = result.produceId;
      produce.txHash = result.txHash;
      produce.blockchainStatus = 'CONFIRMED';
      await produce.save();
    }

    const verifyUrl = `${"https://farmtrace-bay.vercel.app"}/verify/${produce._id}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl);

    res.json({
      success: true,
      produce,
      qrCodeDataUrl,
      txHash: result.txHash,
      etherscanUrl: result.etherscanUrl,
      message: 'Blockchain pe register ho gaya!'
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Farmer ke apne produces
router.get('/farmer/my', auth, async (req, res) => {
  try {
    const produces = await Produce.find({ farmerPhone: req.user.phone })
      .sort({ createdAt: -1 });
    res.json(produces);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Distributor/Retailer ke received produces
router.get('/received/my', auth, async (req, res) => {
  try {
    const transfers = await Transfer.find({ toPhone: req.user.phone })
      .sort({ createdAt: -1 });

    const results = [];
    for (const t of transfers) {
      try {
        let produce = null;
        if (mongoose.Types.ObjectId.isValid(t.produceId)) {
          produce = await Produce.findById(t.produceId);
        }
        if (!produce) {
          produce = await Produce.findOne({ produceId: t.produceId });
        }
        if (produce) {
          results.push({
            ...produce.toObject(),
            receivedPrice: t.price,
            receivedFrom: t.fromPhone,
            transferType: t.transferType,
            transferId: t._id,
            transferTxHash: t.txHash
          });
        }
      } catch (e) {
        console.error('Transfer fetch error:', e.message);
      }
    }
    res.json(results);
  } catch (err) {
    console.error('Received error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Public — produce fetch + transfer history
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid produce ID' });
    }

    const produce = await Produce.findById(req.params.id);
    if (!produce) {
      return res.status(404).json({ message: 'Produce nahi mila' });
    }

    // MongoDB se transfer history
    const dbTransfers = await Transfer.find({
      $or: [
        { produceId: req.params.id },
        { produceId: produce.produceId || '' }
      ]
    }).sort({ createdAt: 1 });

    // Blockchain se history — BigInt fix karo
    let blockchainHistory = [];
    if (produce.produceId) {
      try {
        const result = await getHistoryFromChain(produce.produceId);
        if (result.success) {
          blockchainHistory = serializeBlockchain(result.history);
        }
      } catch (e) {
        console.error('Blockchain history error:', e.message);
      }
    }

    res.json({
      ...serializeBlockchain(produce.toObject()),
      dbTransfers,
      blockchainHistory,
      isBlockchainVerified: !!produce.txHash
    });

  } catch (err) {
    console.error('Produce fetch error:', err);
    res.status(500).json({ message: err.message });
  }
});

// QR code
router.get('/:id/qr', async (req, res) => {
  try {
    const produce = await Produce.findById(req.params.id);
    if (!produce) return res.status(404).json({ message: 'Nahi mila' });
    const verifyUrl = `${"https://farmtrace-bay.vercel.app"}/verify/${produce._id}`;
    const qr = await QRCode.toDataURL(verifyUrl, { width: 400 });
    res.json({ qrCodeDataUrl: qr, verifyUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
