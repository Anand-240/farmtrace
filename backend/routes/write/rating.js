const express = require('express');
const router = express.Router();
const auth = require('../../middleware/authMiddleware');
const BuyerRating = require('../../models/BuyerRating');
const logger = require('../../utils/logger').child({ module: 'rating' });

// Submit rating
router.post('/', auth, async (req, res) => {
  try {
    const { buyerId, buyerName, rating, paymentTimeliness, communication, fairness, review, transactionId, produceId } = req.body;
    if (!buyerId || !rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Valid buyer and rating (1-5) required' });
    if (String(buyerId) === String(req.user.id)) return res.status(400).json({ message: 'Aap apne aap ko rate nahi kar sakte' });

    const existing = await BuyerRating.findOne({ buyerId, raterId: req.user.id, transactionId: transactionId || undefined });
    if (existing) return res.status(409).json({ message: 'Aap already rate kar chuke hain' });

    const ratingDoc = new BuyerRating({
      buyerId, buyerName, raterId: req.user.id, raterName: req.user.name,
      rating, paymentTimeliness, communication, fairness, review, transactionId, produceId,
      isVerifiedTransaction: Boolean(transactionId)
    });
    await ratingDoc.save();
    return res.status(201).json({ message: 'Rating submit ho gaya', rating: ratingDoc });
  } catch (err) {
    logger.error({ err }, 'Submit rating error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get buyer ratings summary
router.get('/buyer/:buyerId', auth, async (req, res) => {
  try {
    const ratings = await BuyerRating.find({ buyerId: req.params.buyerId }).sort({ createdAt: -1 });
    if (!ratings.length) return res.json({ averageRating: 0, totalRatings: 0, ratings: [] });

    const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratings.forEach(r => { breakdown[Math.round(r.rating)] = (breakdown[Math.round(r.rating)] || 0) + 1; });

    return res.json({ averageRating: parseFloat(avg.toFixed(1)), totalRatings: ratings.length, breakdown, ratings });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get all buyers with ratings (marketplace trust scores)
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const agg = await BuyerRating.aggregate([
      { $group: { _id: '$buyerId', buyerName: { $first: '$buyerName' }, avgRating: { $avg: '$rating' }, totalRatings: { $sum: 1 } } },
      { $sort: { avgRating: -1 } },
      { $limit: 20 }
    ]);
    return res.json({ leaderboard: agg });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
