const mongoose = require('mongoose');

const complianceDocumentSchema = new mongoose.Schema({
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transfer', required: true, index: true },
  documentType: {
    type: String,
    enum: ['INVOICE', 'CHALLAN', 'SETTLEMENT'],
    required: true,
    index: true
  },
  documentNumber: { type: String, required: true, unique: true, index: true },
  checksum: { type: String },
  version: { type: Number, default: 1 },
  generatedAt: { type: Date, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

complianceDocumentSchema.index({ transferId: 1, documentType: 1 }, { unique: true });

module.exports = mongoose.model('ComplianceDocument', complianceDocumentSchema);
