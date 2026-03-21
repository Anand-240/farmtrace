const mongoose = require('mongoose');

const produceSchema = new mongoose.Schema({
  farmerName: { type: String, required: true },
  cropType:   { type: String, required: true },
  origin:     { type: String, required: true },
  quantity:   { type: Number, required: true },
  qualityGrade: {
    type: String,
    enum: ['A', 'B', 'C'],
    required: true
  },
  farmPrice:  { type: Number, required: true },
  imageUrl:   { type: String },
  farmerPhone: { type: String, required: true },
  currentOwner: { type: String },

  // Blockchain data
  produceId: { type: String },        // bytes32 blockchain ID
  txHash:    { type: String },        // deployment transaction
  blockchainStatus: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'FAILED'],
    default: 'PENDING'
  }
}, { timestamps: true });

module.exports = mongoose.model('Produce', produceSchema);
