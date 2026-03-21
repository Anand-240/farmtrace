const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Transfer = require('../models/Transfer');
const Produce = require('../models/Produce');
const { transferOnChain } = require('../blockchain/blockchainService');

router.post('/', auth, async (req, res) => {
  try {
    const { produceMongoId, toPhone, price, location, transferType } = req.body;

    if (!produceMongoId || !toPhone || !price || !location || !transferType) {
      return res.status(400).json({ message: 'Sab fields required hain' });
    }

    const produce = await Produce.findById(produceMongoId);
    if (!produce) {
      return res.status(404).json({ message: 'Produce nahi mila' });
    }

    // MongoDB mein transfer save karo
    const transfer = await Transfer.create({
      produceId: produce.produceId || produceMongoId,
      fromPhone: req.user.phone,
      toPhone,
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
    produce.currentOwner = toPhone;
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
