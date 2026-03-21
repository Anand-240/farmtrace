const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['FARMER', 'DISTRIBUTOR', 'RETAILER'], required: true },
  village: String,
  district: String,
  state: String
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
