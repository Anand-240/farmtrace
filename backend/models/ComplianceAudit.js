const mongoose = require('mongoose');

const complianceAuditSchema = new mongoose.Schema({
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transfer', required: true, index: true },
  documentType: {
    type: String,
    enum: ['INVOICE', 'CHALLAN', 'SETTLEMENT', 'AUDIT'],
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: ['GENERATED', 'DOWNLOADED'],
    required: true
  },
  requestedByPhone: { type: String, required: true, index: true },
  requestedByRole: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  checksum: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('ComplianceAudit', complianceAuditSchema);
