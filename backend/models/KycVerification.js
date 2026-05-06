const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  documentType: { type: String, enum: ['AADHAAR', 'PAN', 'ESHRAM'], required: true },
  documentNumberHash: { type: String, required: true },
  documentNumberMasked: { type: String, required: true },
  nameAsPerDoc: { type: String, trim: true },
  dobAsPerDoc: { type: Date },
  frontImageUrl: { type: String },
  backImageUrl: { type: String },
  status: {
    type: String,
    enum: ['SUBMITTED', 'VERIFIED', 'REJECTED'],
    default: 'SUBMITTED'
  },
  rejectionReason: { type: String },
  autoVerified: { type: Boolean, default: false },
  verificationResponse: { type: mongoose.Schema.Types.Mixed },
  reviewedAt: { type: Date },
  reviewedBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('KycVerification', kycSchema);
