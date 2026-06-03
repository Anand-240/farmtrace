const express = require('express');
const router = express.Router();
const auth = require('../../middleware/authMiddleware');
const Transfer = require('../../models/Transfer');
const Produce = require('../../models/Produce');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const { transferOnChain } = require('../../blockchain/blockchainService');
const { validateSellPrice } = require('../../utils/marketPricing');
const { pushToUser } = require('../../utils/socket');
const { sendMail, emailTemplates } = require('../../utils/email');
const logger = require('../../utils/logger').child({ module: 'transfer' });

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
      produceMongoId: produce._id,
      produceChainId: produce.produceId || null,
      produceId: String(produce._id),
      fromPhone: req.user.phone,
      toPhone: receiver.phone,
      price,
      location,
      transferType,
      blockchainStatus: 'PENDING'
    });

    // Blockchain pe transfer karo
    const chainProduceId = transfer.produceChainId || produce.produceId;
    if (chainProduceId) {
      const toAddress = process.env.PLATFORM_PRIVATE_KEY
        ? new (require('ethers').Wallet)(process.env.PLATFORM_PRIVATE_KEY).address
        : '0x0000000000000000000000000000000000000001';

      const result = await transferOnChain(
        chainProduceId, toAddress, price, location
      );

      if (result.success) {
        transfer.txHash = result.txHash;
        transfer.blockchainStatus = 'CONFIRMED';
        await transfer.save();
      } else {
        // Blockchain failed — mark the transfer and bail out without changing ownership
        transfer.blockchainStatus = 'FAILED';
        await transfer.save();
        return res.status(502).json({
          success: false,
          message: 'Blockchain transfer fail ho gaya — ownership change nahi hua. Dobara try karo.',
          transfer
        });
      }
    }

    // Only update owner after confirmed blockchain record (or when no chain ID — offline produce)
    produce.currentOwner = receiver.phone;
    await produce.save();

    // Notify receiver
    const receiverNotif = await Notification.create({
      userPhone: receiver.phone,
      title: 'Produce Transfer Ho Gaya!',
      message: `${req.user.name} ne aapko ${produce.cropType} transfer kiya — ₹${price}/kg at ${location}`,
      type: 'TRANSFER_COMPLETE',
      data: { transferId: transfer._id, produceId: produce._id }
    });
    pushToUser(receiver.phone, 'notification', receiverNotif.toObject());

    // Notify sender
    const senderNotif = await Notification.create({
      userPhone: req.user.phone,
      title: 'Transfer Successful!',
      message: `${produce.cropType} successfully ${receiver.name} ko transfer ho gaya`,
      type: 'TRANSFER_COMPLETE',
      data: { transferId: transfer._id, produceId: produce._id }
    });
    pushToUser(req.user.phone, 'notification', senderNotif.toObject());

    // Email receiver
    if (receiver.email) {
      const tmpl = emailTemplates.transferReceived({
        recipientName: receiver.name,
        senderName: req.user.name,
        cropType: produce.cropType,
        pricePerKg: price,
        location
      });
      sendMail({ to: receiver.email, ...tmpl }).catch(() => {});
    }

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
    logger.error({ err }, 'Transfer error');
    res.status(500).json({ message: err.message });
  }
});

// Produce ki poori transfer history
router.get('/history/:produceId', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const transferFilters = [
      { produceId: req.params.produceId },
      { produceChainId: req.params.produceId }
    ];
    if (mongoose.Types.ObjectId.isValid(req.params.produceId)) {
      transferFilters.push({ produceMongoId: req.params.produceId });
    }
    const transfers = await Transfer.find({
      $or: transferFilters
    }).sort({ createdAt: 1 });
    res.json(transfers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
