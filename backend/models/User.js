const mongoose = require('mongoose');

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

const optionalRegexValidator = (regex, message) => ({
  validator: (value) => !value || regex.test(String(value).trim().toUpperCase()),
  message
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, unique: true, sparse: true, trim: true },
  password: { type: String },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  googleId: { type: String, unique: true, sparse: true },
  avatar: String,
  role: { type: String, enum: ['FARMER', 'DISTRIBUTOR', 'RETAILER'], required: true },
  village: String,
  city: String,
  district: String,
  state: String,
  pincode: {
    type: String,
    trim: true,
    validate: optionalRegexValidator(PINCODE_REGEX, 'Invalid pincode format')
  },
  businessName: String,
  gstin: {
    type: String,
    uppercase: true,
    trim: true,
    validate: optionalRegexValidator(GSTIN_REGEX, 'Invalid GSTIN format')
  },
  pan: {
    type: String,
    uppercase: true,
    trim: true,
    validate: optionalRegexValidator(PAN_REGEX, 'Invalid PAN format')
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
