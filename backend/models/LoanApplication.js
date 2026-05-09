const mongoose = require('mongoose');

const loanApplicationSchema = new mongoose.Schema({
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farmerName: { type: String, required: true },
  farmerPhone: { type: String },
  loanType: {
    type: String,
    enum: ['CROP_LOAN', 'KISAN_CREDIT_CARD', 'INVOICE_DISCOUNTING', 'WAREHOUSE_RECEIPT_LOAN', 'EQUIPMENT_LOAN'],
    required: true
  },
  amount: { type: Number, required: true },
  purpose: { type: String, required: true },
  tenure: { type: Number },
  interestRate: { type: Number },
  produceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce' },
  cropType: { type: String },
  collateral: { type: String },
  bankName: { type: String },
  status: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DISBURSED', 'REJECTED', 'CLOSED'],
    default: 'DRAFT'
  },
  approvedAmount: { type: Number },
  rejectionReason: { type: String },
  disbursedAt: { type: Date },
  repaidAt: { type: Date },
  documents: [{ name: String, url: String }],
  reviewedBy: { type: String },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('LoanApplication', loanApplicationSchema);
