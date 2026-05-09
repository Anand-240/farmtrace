const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderName: { type: String },
  senderRole: { type: String },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const disputeSchema = new mongoose.Schema({
  ticketNo: { type: String, unique: true },
  raisedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  raisedByName: { type: String, required: true },
  raisedByRole: { type: String },
  againstId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  againstName: { type: String },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  produceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce' },
  category: {
    type: String,
    enum: ['PAYMENT', 'QUALITY', 'QUANTITY', 'DELIVERY', 'FRAUD', 'OTHER'],
    required: true
  },
  description: { type: String, required: true },
  evidence: [{ name: String, url: String }],
  status: {
    type: String,
    enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED', 'ESCALATED'],
    default: 'OPEN'
  },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
  resolution: { type: String },
  resolvedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedByName: { type: String },
  resolvedAt: { type: Date },
  messages: [messageSchema],
  rating: { type: Number, min: 1, max: 5 }
}, { timestamps: true });

disputeSchema.pre('save', async function (next) {
  if (!this.ticketNo) {
    const count = await mongoose.model('Dispute').countDocuments();
    this.ticketNo = `DIS-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Dispute', disputeSchema);
