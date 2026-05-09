const express = require('express');
const router = express.Router();
const { z } = require('zod');
const auth = require('../../middleware/authMiddleware');
const LoanApplication = require('../../models/LoanApplication');
const logger = require('../../utils/logger').child({ module: 'finance' });

const loanSchema = z.object({
  loanType: z.enum(['CROP_LOAN', 'KISAN_CREDIT_CARD', 'INVOICE_DISCOUNTING', 'WAREHOUSE_RECEIPT_LOAN', 'EQUIPMENT_LOAN']),
  amount: z.number().positive(),
  purpose: z.string().min(5),
  tenure: z.number().optional(),
  cropType: z.string().optional(),
  collateral: z.string().optional(),
  bankName: z.string().optional(),
  produceId: z.string().optional(),
  notes: z.string().optional()
});

// Apply for loan
router.post('/apply', auth, async (req, res) => {
  try {
    const parsed = loanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

    const loan = new LoanApplication({
      ...parsed.data,
      farmerId: req.user.id,
      farmerName: req.user.name,
      farmerPhone: req.user.phone,
      status: 'SUBMITTED',
      interestRate: getInterestRate(parsed.data.loanType)
    });
    await loan.save();
    return res.status(201).json({ message: 'Loan application submit ho gaya', loan });
  } catch (err) {
    logger.error({ err }, 'Apply loan error');
    return res.status(500).json({ message: 'Server error' });
  }
});

function getInterestRate(loanType) {
  const rates = { CROP_LOAN: 7, KISAN_CREDIT_CARD: 4, INVOICE_DISCOUNTING: 12, WAREHOUSE_RECEIPT_LOAN: 9, EQUIPMENT_LOAN: 10 };
  return rates[loanType] || 9;
}

// My applications
router.get('/my', auth, async (req, res) => {
  try {
    const loans = await LoanApplication.find({ farmerId: req.user.id }).sort({ createdAt: -1 });
    return res.json({ loans });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Admin: all applications
router.get('/all', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const loans = await LoanApplication.find(filter).sort({ createdAt: -1 });
    return res.json({ loans });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Update status (admin)
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status, approvedAmount, rejectionReason } = req.body;
    const validStatuses = ['UNDER_REVIEW', 'APPROVED', 'DISBURSED', 'REJECTED', 'CLOSED'];
    if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const update = { status, reviewedBy: req.user.name };
    if (approvedAmount) update.approvedAmount = approvedAmount;
    if (rejectionReason) update.rejectionReason = rejectionReason;
    if (status === 'DISBURSED') update.disbursedAt = new Date();

    const loan = await LoanApplication.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!loan) return res.status(404).json({ message: 'Application not found' });
    return res.json({ message: 'Status update ho gaya', loan });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
