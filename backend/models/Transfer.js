const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
  produceMongoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce', index: true },
  produceChainId: { type: String, index: true },
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
  destinationLocation: { type: String },
  routeDistanceKm: { type: Number },
  routeEtaMinutes: { type: Number },
  freightEstimateAmount: { type: Number },
  freightCurrency: { type: String, default: 'INR' },
  matchedTransporter: {
    transporterId: { type: String },
    name: { type: String },
    phone: { type: String },
    vehicleType: { type: String },
    vehicleCapacityKg: { type: Number },
    rating: { type: Number },
    pricePerKm: { type: Number }
  },
  deliverySlotDate: { type: Date },
  deliverySlotLabel: { type: String },
  deliverySlotBookedAt: { type: Date },
  deliverySlotBookedBy: { type: String },
  pickupDispatchedAt: { type: Date },
  inTransitAt: { type: Date },
  deliveredAt: { type: Date },
  txHash:              { type: String },
  razorpayPaymentId:   { type: String },
  razorpayOrderId:     { type: String },
  deliveryRemarks:     { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Transfer', transferSchema);
