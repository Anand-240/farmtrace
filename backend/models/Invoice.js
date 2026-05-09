const mongoose = require('mongoose');

const invoiceLineSchema = new mongoose.Schema({
  description: String,
  hsnCode: String,
  quantity: Number,
  unit: String,
  rate: Number,
  amount: Number,
  gstRate: Number,
  cgst: Number,
  sgst: Number,
  igst: Number,
  totalAmount: Number
});

const invoiceSchema = new mongoose.Schema({
  invoiceNo: { type: String, unique: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerName: { type: String, required: true },
  sellerGstin: { type: String },
  sellerAddress: { type: String },
  sellerState: { type: String },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  buyerName: { type: String, required: true },
  buyerGstin: { type: String },
  buyerAddress: { type: String },
  buyerState: { type: String },
  produceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce' },
  lineItems: [invoiceLineSchema],
  subtotal: { type: Number },
  totalCgst: { type: Number },
  totalSgst: { type: Number },
  totalIgst: { type: Number },
  totalTax: { type: Number },
  grandTotal: { type: Number },
  isInterState: { type: Boolean, default: false },
  invoiceDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  status: { type: String, enum: ['DRAFT', 'ISSUED', 'PAID', 'CANCELLED'], default: 'DRAFT' },
  eInvoiceIrn: { type: String },
  ewayBillNo: { type: String },
  notes: { type: String }
}, { timestamps: true });

invoiceSchema.pre('save', async function (next) {
  if (!this.invoiceNo) {
    const count = await mongoose.model('Invoice').countDocuments();
    const year = new Date().getFullYear();
    this.invoiceNo = `FT-INV-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
