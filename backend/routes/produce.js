const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const auth = require('../middleware/authMiddleware');
const Produce = require('../models/Produce');
const { registerOnChain, getHistoryFromChain } = require('../blockchain/blockchainService');


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

    
    const verifyUrl = `${process.env.FRONTEND_URL}/verify/${produce._id}`;
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
    res.status(500).json({ message: err.message });
  }
});


router.get('/:id', async (req, res) => {
  try {
    const produce = await Produce.findById(req.params.id);
    if (!produce) {
      return res.status(404).json({ message: 'Produce nahi mila' });
    }

    // Blockchain se history bhi lo
    let blockchainHistory = [];
    if (produce.produceId) {
      const result = await getHistoryFromChain(produce.produceId);
      if (result.success) blockchainHistory = result.history;
    }

    res.json({
      ...produce.toObject(),
      blockchainHistory,
      isBlockchainVerified: !!produce.txHash
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get('/farmer/my', auth, async (req, res) => {
  try {
    const produces = await Produce.find({ farmerPhone: req.user.phone })
      .sort({ createdAt: -1 });
    res.json(produces);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get('/:id/qr', async (req, res) => {
  try {
    const produce = await Produce.findById(req.params.id);
    if (!produce) return res.status(404).json({ message: 'Nahi mila' });

    const verifyUrl = `${process.env.FRONTEND_URL}/verify/${produce._id}`;
    const qr = await QRCode.toDataURL(verifyUrl, { width: 400 });

    res.json({ qrCodeDataUrl: qr, verifyUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
