const express = require('express');
const router = express.Router();
const auth = require('../../middleware/authMiddleware');
const Auction = require('../../models/Auction');
const logger = require('../../utils/logger').child({ module: 'auction-read' });

// List active auctions
router.get('/', auth, async (req, res) => {
  try {
    const { status = 'ACTIVE', crop, page = 1, limit = 12 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (crop) filter.cropType = new RegExp(crop, 'i');

    // Auto-close expired active auctions
    await Auction.updateMany({ status: 'ACTIVE', endTime: { $lt: new Date() } }, { $set: { status: 'CLOSED' } });

    const total = await Auction.countDocuments(filter);
    const auctions = await Auction.find(filter)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    return res.json({ auctions, total, page: parseInt(page) });
  } catch (err) {
    logger.error({ err }, 'List auctions error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get single auction with full bid history
router.get('/:id', auth, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id).populate('produceId');
    if (!auction) return res.status(404).json({ message: 'Auction not found' });
    return res.json({ auction });
  } catch (err) {
    logger.error({ err }, 'Get auction error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// My auctions (as seller)
router.get('/my/selling', auth, async (req, res) => {
  try {
    const auctions = await Auction.find({ sellerId: req.user.id }).sort({ createdAt: -1 });
    return res.json({ auctions });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// My bids (as buyer)
router.get('/my/bids', auth, async (req, res) => {
  try {
    const auctions = await Auction.find({ 'bids.bidderId': req.user.id }).sort({ createdAt: -1 });
    return res.json({ auctions });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
