const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Transfer = require('../models/Transfer');
const Produce = require('../models/Produce');
const User = require('../models/User');
const { transferOnChain } = require('../blockchain/blockchainService');
const { validateSellPrice } = require('../utils/marketPricing');

router.post('/', auth, async (req, res) => {
  try {
    const { produceMongoId, toPhone, toEmail, price, location, transferType } = req.body;
    const normalizedEmail = toEmail?.trim().toLowerCase();

    if (!produceMongoId || (!toPhone && !normalizedEmail) || !price || !location || !transferType) {
      return res.status(400).json({ message: 'Sab fields required hain' });
    }

    const produce = await Produce.findById(produceMongoId);
    if (!produce) {
      return res.status(404).json({ message: 'Produce nahi mila' });
    }

    const sellValidation = await validateSellPrice({
      produce,
      requestedPrice: price,
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

    const receiver = await User.findOne(
      normalizedEmail ? { email: normalizedEmail } : { phone: toPhone?.trim() }
    );
    if (!receiver) {
      return res.status(404).json({ message: normalizedEmail ? 'Receiver nahi mila — email check karo' : 'Receiver nahi mila — phone check karo' });
    }

    // MongoDB mein transfer save karo
    const transfer = await Transfer.create({
      produceId: produce.produceId || produceMongoId,
      fromPhone: req.user.phone,
      toPhone: receiver.phone,
      price,
      location,
      transferType,
      blockchainStatus: 'PENDING'
    });

    // Blockchain pe transfer karo
    if (produce.produceId) {
      const toAddress = process.env.PLATFORM_PRIVATE_KEY
        ? new (require('ethers').Wallet)(process.env.PLATFORM_PRIVATE_KEY).address
        : '0x0000000000000000000000000000000000000001';

      const result = await transferOnChain(
        produce.produceId, toAddress, price, location
      );

      if (result.success) {
        transfer.txHash = result.txHash;
        transfer.blockchainStatus = 'CONFIRMED';
        await transfer.save();
      }
    }

    // Current owner update karo
    produce.currentOwner = receiver.phone;
    await produce.save();

    res.json({
      success: true,
      transfer,
      txHash: transfer.txHash,
      etherscanUrl: transfer.txHash
        ? `https://sepolia.etherscan.io/tx/${transfer.txHash}`
        : null,
      message: 'Transfer blockchain pe record ho gaya!'
    });

  } catch (err) {
    console.error('Transfer error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Produce ki poori transfer history
router.get('/history/:produceId', async (req, res) => {
  try {
    const transfers = await Transfer.find({
      produceId: req.params.produceId
    }).sort({ createdAt: 1 });
    res.json(transfers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
