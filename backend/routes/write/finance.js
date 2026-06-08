const express = require('express');
const router = express.Router();
const { z } = require('zod');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const auth = require('../../middleware/authMiddleware');
const LoanApplication = require('../../models/LoanApplication');
const logger = require('../../utils/logger').child({ module: 'finance' });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP or PDF allowed'));
  }
});

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

// Upload documents for a loan application
router.post('/:id/documents', auth, upload.array('docs', 5), async (req, res) => {
  try {
    const loan = await LoanApplication.findOne({ _id: req.params.id, farmerId: req.user.id });
    if (!loan) return res.status(404).json({ message: 'Application not found' });
    if (!req.files?.length) return res.status(400).json({ message: 'Koi file nahi mili' });

    const uploaded = await Promise.all(req.files.map((file) =>
      new Promise((resolve, reject) => {
        const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'farmtrace_loan_docs', resource_type: resourceType },
          (err, result) => err ? reject(err) : resolve({ name: file.originalname, url: result.secure_url })
        );
        stream.end(file.buffer);
      })
    ));

    loan.documents.push(...uploaded);
    await loan.save();
    return res.json({ message: `${uploaded.length} document(s) upload ho gaye`, documents: loan.documents });
  } catch (err) {
    logger.error({ err }, 'Document upload error');
    return res.status(500).json({ message: err.message || 'Upload failed' });
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
