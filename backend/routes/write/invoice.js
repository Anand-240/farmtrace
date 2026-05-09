const express = require('express');
const router = express.Router();
const auth = require('../../middleware/authMiddleware');
const Invoice = require('../../models/Invoice');
const logger = require('../../utils/logger').child({ module: 'invoice' });

function computeGst(lineItems, isInterState) {
  let subtotal = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
  const computed = lineItems.map(item => {
    const amount = item.quantity * item.rate;
    const taxAmt = (amount * item.gstRate) / 100;
    let cgst = 0, sgst = 0, igst = 0;
    if (isInterState) { igst = taxAmt; }
    else { cgst = taxAmt / 2; sgst = taxAmt / 2; }
    subtotal += amount;
    totalCgst += cgst; totalSgst += sgst; totalIgst += igst;
    return { ...item, amount, cgst, sgst, igst, totalAmount: amount + taxAmt };
  });
  const totalTax = totalCgst + totalSgst + totalIgst;
  return { lineItems: computed, subtotal, totalCgst, totalSgst, totalIgst, totalTax, grandTotal: subtotal + totalTax };
}

// Create invoice
router.post('/', auth, async (req, res) => {
  try {
    const { buyerName, buyerGstin, buyerAddress, buyerState, buyerId, produceId, lineItems, sellerGstin, sellerAddress, notes, dueDate } = req.body;
    if (!buyerName || !lineItems || !lineItems.length) return res.status(400).json({ message: 'Buyer name and line items required' });

    const sellerState = req.body.sellerState || '';
    const isInterState = sellerState && buyerState && sellerState.toLowerCase() !== buyerState.toLowerCase();

    const gstCalc = computeGst(lineItems, isInterState);

    const invoice = new Invoice({
      sellerId: req.user.id,
      sellerName: req.user.name,
      sellerGstin, sellerAddress, sellerState,
      buyerId, buyerName, buyerGstin, buyerAddress, buyerState,
      produceId,
      ...gstCalc,
      isInterState,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes,
      status: 'ISSUED'
    });
    await invoice.save();
    return res.status(201).json({ message: 'Invoice generate ho gaya', invoice });
  } catch (err) {
    logger.error({ err }, 'Create invoice error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// My invoices (as seller)
router.get('/my', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { sellerId: req.user.id };
    if (status) filter.status = status;
    const invoices = await Invoice.find(filter).sort({ createdAt: -1 });
    return res.json({ invoices });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get single invoice
router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    return res.json({ invoice });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Update status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['PAID', 'CANCELLED'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    return res.json({ message: 'Invoice updated', invoice });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
