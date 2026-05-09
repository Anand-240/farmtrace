const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  bidderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bidderName: { type: String, required: true },
  bidderRole: { type: String },
  amount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

const auctionSchema = new mongoose.Schema({
  produceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerName: { type: String, required: true },
  cropType: { type: String, required: true },
  quantity: { type: Number, required: true },
  qualityGrade: { type: String },
  origin: { type: String },
  basePrice: { type: Number, required: true },
  reservePrice: { type: Number },
  incrementAmount: { type: Number, default: 50 },
  autoAcceptPrice: { type: Number },
  currentBid: { type: Number },
  currentWinner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  currentWinnerName: { type: String },
  bids: [bidSchema],
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ['ACTIVE', 'CLOSED', 'CANCELLED', 'SOLD'],
    default: 'ACTIVE'
  },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winnerName: { type: String },
  finalPrice: { type: Number },
  imageUrl: { type: String },
  description: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Auction', auctionSchema);
