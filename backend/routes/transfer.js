const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Transfer = require('../models/Transfer');
const Produce = require('../models/Produce');
const { transferOnChain } = require('../blockchain/blockchainService');

router.post('/', auth, async (req, res) => {
  try {
    const { produceMongoId, toPhone, price, location, transferType } = req.body;

    const produce = await Produce.findById(produceMongoId);
    if (!produce) {
      return res.status(404).json({ message: 'Produce nahi mila' });
    }

    // Transfer save karo
    const transfer = await Transfer.create({
      produceId: produce.produceId || produceMongoId,
      fromPhone: req.user.phone,
      toPhone,
      price,
      location,
      transferType,
      blockchainStatus: 'PENDING'
    });

   
    if (produce.produceId) {
      const toAddress = process.env.PLATFORM_WALLET_ADDRESS || 
        '0x0000000000000000000000000000000000000001';
      
      const result = await transferOnChain(
        produce.produceId, toAddress, price, location
      );

      if (result.success) {
        transfer.txHash = result.txHash;
        transfer.blockchainStatus = 'CONFIRMED';
        await transfer.save();
      }
    }

   
    produce.currentOwner = toPhone;
    await produce.save();

    res.json({
      success: true,
      transfer,
      txHash: transfer.txHash,
      message: 'Transfer blockchain pe record ho gaya!'
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
