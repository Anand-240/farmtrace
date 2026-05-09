const mongoose = require('mongoose');

const buyerRatingSchema = new mongoose.Schema({
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  buyerName: { type: String, required: true },
  raterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  raterName: { type: String, required: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  produceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  paymentTimeliness: { type: Number, min: 1, max: 5 },
  communication: { type: Number, min: 1, max: 5 },
  fairness: { type: Number, min: 1, max: 5 },
  review: { type: String },
  isVerifiedTransaction: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('BuyerRating', buyerRatingSchema);
