const express = require('express');
const router = express.Router();
const { z } = require('zod');
const auth = require('../../middleware/authMiddleware');
const Auction = require('../../models/Auction');
const Produce = require('../../models/Produce');
const logger = require('../../utils/logger').child({ module: 'auction' });

const createAuctionSchema = z.object({
  produceId: z.string().min(1),
  basePrice: z.number().positive(),
  reservePrice: z.number().positive().optional(),
  incrementAmount: z.number().positive().optional().default(50),
  autoAcceptPrice: z.number().positive().optional(),
  endTime: z.string(),
  description: z.string().optional()
});

// Create auction
router.post('/', auth, async (req, res) => {
  try {
    const parsed = createAuctionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

    const { produceId, basePrice, reservePrice, incrementAmount, autoAcceptPrice, endTime, description } = parsed.data;

    const produce = await Produce.findById(produceId);
    if (!produce) return res.status(404).json({ message: 'Produce not found' });
    const ownerPhone = produce.currentOwner || produce.farmerPhone;
    if (ownerPhone !== req.user.phone) {
      return res.status(403).json({ message: 'Aap is produce ke owner nahi hain' });
    }

    const existing = await Auction.findOne({ produceId, status: 'ACTIVE' });
    if (existing) return res.status(409).json({ message: 'Is produce ke liye auction already active hai' });

    const auction = new Auction({
      produceId,
      sellerId: req.user.id,
      sellerName: req.user.name,
      cropType: produce.cropType,
      quantity: produce.quantity,
      qualityGrade: produce.qualityGrade,
      origin: produce.origin,
      imageUrl: produce.imageUrl,
      basePrice,
      reservePrice,
      incrementAmount: incrementAmount || 50,
      autoAcceptPrice,
      currentBid: basePrice,
      endTime: new Date(endTime),
      description
    });
    await auction.save();
    return res.status(201).json({ message: 'Auction create ho gaya', auction });
  } catch (err) {
    logger.error({ err }, 'Create auction error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// Place a bid
router.post('/:id/bid', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || isNaN(amount)) return res.status(400).json({ message: 'Valid bid amount required' });
    const bidAmount = Number(amount);

    // Atomic update: bid validity conditions are in the query filter itself.
    // If two requests race, only the one whose conditions still hold after the lock wins.
    const auction = await Auction.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'ACTIVE',
        endTime: { $gt: new Date() },
        sellerId: { $ne: req.user._id },
        $or: [
          // First bid: no bids yet, amount must be >= basePrice
          { bids: { $size: 0 }, currentBid: { $lte: bidAmount } },
          // Subsequent bid: amount must be >= currentBid + incrementAmount
          { $expr: { $lte: [{ $add: ['$currentBid', '$incrementAmount'] }, bidAmount] } }
        ]
      },
      {
        $set: { currentBid: bidAmount, currentWinner: req.user._id, currentWinnerName: req.user.name },
        $push: { bids: { bidderId: req.user._id, bidderName: req.user.name, bidderRole: req.user.role, amount: bidAmount } }
      },
      { new: true }
    );

    if (!auction) {
      // Explain why it failed
      const existing = await Auction.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Auction not found' });
      if (existing.status !== 'ACTIVE') return res.status(400).json({ message: 'Auction active nahi hai' });
      if (new Date() > existing.endTime) {
        existing.status = 'CLOSED';
        await existing.save();
        return res.status(400).json({ message: 'Auction ka time khatam ho gaya' });
      }
      if (String(existing.sellerId) === String(req.user._id)) {
        return res.status(403).json({ message: 'Aap apni khud ki auction mein bid nahi kar sakte' });
      }
      const isFirstBid = existing.bids.length === 0;
      const minBid = isFirstBid ? existing.basePrice : existing.currentBid + existing.incrementAmount;
      return res.status(400).json({ message: `Minimum bid ₹${minBid} hona chahiye (ya kisi aur ne pehle bid kar diya)` });
    }

    // Auto-accept check after atomic bid placement
    if (auction.autoAcceptPrice && bidAmount >= auction.autoAcceptPrice) {
      auction.status = 'SOLD';
      auction.winnerId = req.user._id;
      auction.winnerName = req.user.name;
      auction.finalPrice = bidAmount;
      await auction.save();
    }

    return res.json({ message: 'Bid place ho gaya', currentBid: auction.currentBid, status: auction.status });
  } catch (err) {
    logger.error({ err }, 'Place bid error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// Close auction (seller action)
router.patch('/:id/close', auth, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: 'Auction not found' });
    if (String(auction.sellerId) !== String(req.user.id)) return res.status(403).json({ message: 'Unauthorized' });
    if (auction.status !== 'ACTIVE') return res.status(400).json({ message: 'Auction already closed hai' });

    if (auction.currentWinner && (!auction.reservePrice || auction.currentBid >= auction.reservePrice)) {
      auction.status = 'SOLD';
      auction.winnerId = auction.currentWinner;
      auction.winnerName = auction.currentWinnerName;
      auction.finalPrice = auction.currentBid;
    } else {
      auction.status = 'CLOSED';
    }
    await auction.save();
    return res.json({ message: `Auction ${auction.status === 'SOLD' ? 'sell ho gaya' : 'close ho gaya'}`, auction });
  } catch (err) {
    logger.error({ err }, 'Close auction error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// Cancel auction
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: 'Auction not found' });
    if (String(auction.sellerId) !== String(req.user.id)) return res.status(403).json({ message: 'Unauthorized' });
    auction.status = 'CANCELLED';
    await auction.save();
    return res.json({ message: 'Auction cancel ho gaya' });
  } catch (err) {
    logger.error({ err }, 'Cancel auction error');
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
