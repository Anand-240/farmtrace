const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  produceId:      { type: String, required: true },
  cropType:       { type: String },
  fromPhone:      { type: String, required: true },
  fromName:       { type: String },
  toPhone:        { type: String, required: true },
  toName:         { type: String },
  amount:         { type: Number, required: true },
  pricePerKg:     { type: Number },
  quantity:       { type: Number },
  transferType:   { type: String },
  paymentId:      { type: String },
  txHash:         { type: String },
  status:         { type: String, enum: ['COMPLETED', 'PENDING', 'FAILED'], default: 'COMPLETED' },
  type:           { type: String, enum: ['SENT', 'RECEIVED'] }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
