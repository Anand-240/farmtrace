const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
  produceId:    { type: String, required: true },
  fromPhone:    { type: String, required: true },
  toPhone:      { type: String, required: true },
  price:        { type: Number, required: true },
  location:     { type: String, required: true },
  transferType: {
    type: String,
    enum: ['FARM_TO_DISTRIBUTOR', 'DISTRIBUTOR_TO_RETAILER', 'RETAILER_TO_CONSUMER'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED'],
    default: 'PENDING'
  },
  blockchainStatus: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'FAILED'],
    default: 'PENDING'
  },
  deliveryStatus: {
    type: String,
    enum: ['PENDING_DISPATCH', 'PICKUP_DISPATCHED', 'IN_TRANSIT', 'DELIVERED'],
    default: 'PENDING_DISPATCH'
  },
  driverName: { type: String },
  driverPhone: { type: String },
  vehicleNumber: { type: String },
  vehicleType: { type: String },
  currentLocation: { type: String },
  expectedDeliveryTime: { type: Date },
  pickupDispatchedAt: { type: Date },
  inTransitAt: { type: Date },
  deliveredAt: { type: Date },
  txHash:              { type: String },
  razorpayPaymentId:   { type: String },
  razorpayOrderId:     { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Transfer', transferSchema);
