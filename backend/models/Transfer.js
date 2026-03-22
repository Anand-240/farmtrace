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
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED'],
    default: 'PENDING'
  },
  blockchainStatus: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'FAILED'],
    default: 'PENDING'
  },
  txHash:              { type: String },
  razorpayPaymentId:   { type: String },
  razorpayOrderId:     { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Transfer', transferSchema);
