const mongoose = require('mongoose');

const escrowSchema = new mongoose.Schema({
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transfer', required: true, unique: true },
  totalAmount: { type: Number, required: true }, // Total payment amount
  
  // Milestone breakdown (percentages: 40% booking, 30% dispatch, 30% delivery)
  bookingAmount: { type: Number, required: true },      // 40% - Upfront deposit
  dispatchAmount: { type: Number, required: true },     // 30% - Released after PICKUP_DISPATCHED
  deliveryAmount: { type: Number, required: true },     // 30% - Released after DELIVERED
  
  // Milestone status tracking
  bookingPaid: { type: Boolean, default: false },
  bookingPaidAt: { type: Date },
  
  dispatchReleased: { type: Boolean, default: false },
  dispatchReleasedAt: { type: Date },
  
  deliveryReleased: { type: Boolean, default: false },
  deliveryReleasedAt: { type: Date },
  
  // Refund tracking
  refundReason: { type: String },                        // Why refund happened
  refundAmount: { type: Number, default: 0 },
  refundRequestedAt: { type: Date },
  refundCompletedAt: { type: Date },
  
  // Payment details
  razorpayPaymentId: { type: String },
  razorpayOrderId: { type: String },
  
  status: {
    type: String,
    enum: ['ACTIVE', 'COMPLETED', 'REFUNDED', 'FAILED'],
    default: 'ACTIVE'
  }
}, { timestamps: true });

module.exports = mongoose.model('Escrow', escrowSchema);
