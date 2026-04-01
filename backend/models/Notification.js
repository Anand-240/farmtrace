const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userPhone:  { type: String, required: true },
  title:      { type: String, required: true },
  message:    { type: String, required: true },
  type:       {
    type: String,
    enum: [
      'PAYMENT_RECEIVED',
      'TRANSFER_COMPLETE',
      'REQUEST_RECEIVED',
      'DELIVERY_UPDATE',
      'LOCATION_SHIFT'
    ]
  },
  isRead:     { type: Boolean, default: false },
  data:       { type: Object }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
