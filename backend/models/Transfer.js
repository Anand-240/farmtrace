const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
  produceId:    { type: String, required: true },
  fromPhone:    { type: String, required: true },
  toPhone:      { type: String, required: true },
  price:        { type: Number, required: true },
  location:     { type: String, required: true },
  transferType: {
    type: String,
    enum: ['FARM_TO_DISTRIBUTOR', 'DISTRIBUTOR_TO_RETAILER', 'RETAILER_TO_CONSUMER'],
    required: true
  },
  txHash:       { type: String },
  blockchainStatus: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'FAILED'],
    default: 'PENDING'
  }
}, { timestamps: true });

module.exports = mongoose.model('Transfer', transferSchema);
