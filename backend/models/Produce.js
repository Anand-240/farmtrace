const mongoose = require('mongoose');

const produceSchema = new mongoose.Schema({
  farmerName: { type: String, required: true },
  cropType:   { type: String, required: true },
  origin:     { type: String, required: true },
  quantity: {
    type: Number,
    required: true,
    min: [0.001, 'Quantity 0 se zyada honi chahiye']
  },
  qualityGrade: {
    type: String,
    enum: ['A', 'B', 'C'],
    required: true
  },
  farmPrice: {
    type: Number,
    required: true,
    min: [1, 'Farm price kam se kam ₹1 hona chahiye']
  },
  imageUrl:   { type: String },
  farmerPhone: { type: String, required: true },
  currentOwner: { type: String },

  
  produceId: { type: String },        
  txHash:    { type: String },        
  blockchainStatus: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'FAILED'],
    default: 'PENDING'
  },

 
  lotCode: { type: String, unique: true, sparse: true },
  lotStatus: {
    type: String,
    enum: ['ACTIVE', 'SPLIT', 'MERGED'],
    default: 'ACTIVE'
  },
  sourceType: {
    type: String,
    enum: ['REGISTER', 'SPLIT', 'MERGE'],
    default: 'REGISTER'
  },
  rootLotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce' },
  parentLots: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Produce' }],
  childLots: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Produce' }]
}, { timestamps: true });

module.exports = mongoose.model('Produce', produceSchema);
