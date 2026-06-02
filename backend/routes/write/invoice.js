const express = require('express');
const router = express.Router();
const auth = require('../../middleware/authMiddleware');
const Invoice = require('../../models/Invoice');
const User = require('../../models/User');
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

// Search registered users to link as buyer
router.get('/buyer-search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ users: [] });
    const query = q.trim();
    const isGstin = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(query);
    const isPhone = /^[6-9]\d{9}$/.test(query.replace(/\D/g, ''));

    let filter;
    if (isGstin) {
      filter = { gstin: query.toUpperCase(), _id: { $ne: req.user.id } };
    } else if (isPhone) {
      filter = { phone: { $regex: query.replace(/\D/g, '') }, _id: { $ne: req.user.id } };
    } else {
      filter = {
        _id: { $ne: req.user.id },
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
          { businessName: { $regex: query, $options: 'i' } }
        ]
      };
    }
    const users = await User.find(filter).select('name email phone gstin pan businessName state city role').limit(8);
    return res.json({ users });
  } catch (err) {
    logger.error({ err }, 'Buyer search error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// Check if a GSTIN is already registered in the system
router.get('/gstin-check', auth, async (req, res) => {
  try {
    const { gstin } = req.query;
    if (!gstin) return res.json({ found: false });
    const user = await User.findOne({ gstin: gstin.toUpperCase().trim(), _id: { $ne: req.user.id } }).select('name email role businessName');
    return res.json({ found: !!user, user: user || null });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Create invoice
router.post('/', auth, async (req, res) => {
  try {
    const { buyerName, buyerGstin, buyerPhone, buyerEmail, buyerAddress, buyerState, buyerId, produceId, lineItems, sellerGstin, sellerAddress, notes, dueDate } = req.body;
    if (!buyerName || !lineItems || !lineItems.length) return res.status(400).json({ message: 'Buyer name and line items required' });

    const sellerState = req.body.sellerState || '';
    const isInterState = sellerState && buyerState && sellerState.toLowerCase() !== buyerState.toLowerCase();
    const buyerVerified = !!buyerId;

    const gstCalc = computeGst(lineItems, isInterState);

    const invoice = new Invoice({
      sellerId: req.user.id,
      sellerName: req.user.name,
      sellerGstin, sellerAddress, sellerState,
      buyerId, buyerName, buyerGstin, buyerPhone, buyerEmail, buyerAddress, buyerState, buyerVerified,
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
