const mongoose = require('mongoose');

const qualityReportSchema = new mongoose.Schema({
  produceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce', required: true },
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farmerName: { type: String, required: true },
  cropType: { type: String, required: true },
  grade: { type: String, enum: ['FAQ', 'A', 'B', 'C', 'Premium', 'Rejected'], required: true },
  moistureContent: { type: Number },
  purityPercent: { type: Number },
  foreignMatter: { type: Number },
  damagedGrains: { type: Number },
  weight: { type: Number },
  labName: { type: String },
  graderName: { type: String },
  graderLicenseNo: { type: String },
  assayDate: { type: Date, default: Date.now },
  reportUrl: { type: String },
  parameters: [{ name: String, value: String, unit: String, status: String }],
  remarks: { type: String },
  status: { type: String, enum: ['PENDING', 'COMPLETED', 'DISPUTED'], default: 'PENDING' }
}, { timestamps: true });

module.exports = mongoose.model('QualityReport', qualityReportSchema);
