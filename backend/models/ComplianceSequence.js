const mongoose = require('mongoose');

const complianceSequenceSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: Number, required: true, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('ComplianceSequence', complianceSequenceSchema);
