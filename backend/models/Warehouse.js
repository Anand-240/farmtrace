const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  produceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce' },
  cropType: { type: String },
  quantity: { type: Number, required: true },
  type: { type: String, enum: ['IN', 'OUT'], required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ownerName: { type: String },
  receiptNo: { type: String },
  notes: { type: String },
  timestamp: { type: Date, default: Date.now }
});

const warehouseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  state: { type: String },
  capacity: { type: Number, required: true },
  currentStock: { type: Number, default: 0 },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  managerName: { type: String },
  warehouseType: { type: String, enum: ['COLD_STORAGE', 'DRY', 'SILOS', 'GENERAL'], default: 'GENERAL' },
  facilities: [String],
  pricePerQtlPerDay: { type: Number, default: 2 },
  isActive: { type: Boolean, default: true },
  stockMovements: [stockMovementSchema],
  receiptCounter: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Warehouse', warehouseSchema);
