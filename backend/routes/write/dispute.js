const express = require('express');
const router = express.Router();
const { z } = require('zod');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const auth = require('../../middleware/authMiddleware');
const Dispute = require('../../models/Dispute');
const User = require('../../models/User');
const logger = require('../../utils/logger').child({ module: 'dispute' });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
      return cb(new Error('Sirf image ya PDF allowed hai'));
    }
    cb(null, true);
  }
});

async function uploadEvidenceToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'farmtrace_disputes', public_id: filename, resource_type: 'auto' },
      (err, result) => { if (err) return reject(err); resolve(result.secure_url); }
    );
    stream.end(buffer);
  });
}

const disputeSchema = z.object({
  category: z.enum(['PAYMENT', 'QUALITY', 'QUANTITY', 'DELIVERY', 'FRAUD', 'OTHER']),
  description: z.string().min(10),
  transactionId: z.string().optional(),
  produceId: z.string().optional(),
  againstId: z.string().optional(),
  againstName: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional()
});

// Search FarmTrace users to link as the against-party
router.get('/party-search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ users: [] });
    const query = q.trim();
    const isPhone = /^[6-9]\d{9}$/.test(query.replace(/\D/g, ''));
    const filter = isPhone
      ? { phone: { $regex: query.replace(/\D/g, '') }, _id: { $ne: req.user.id } }
      : {
          _id: { $ne: req.user.id },
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } },
            { businessName: { $regex: query, $options: 'i' } }
          ]
        };
    const users = await User.find(filter).select('name email phone role businessName city state').limit(6);
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Raise dispute
router.post('/', auth, async (req, res) => {
  try {
    const parsed = disputeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

    const dispute = new Dispute({
      ...parsed.data,
      raisedById: req.user.id,
      raisedByName: req.user.name,
      raisedByRole: req.user.role
    });
    await dispute.save();
    return res.status(201).json({ message: 'Dispute raise ho gaya', dispute });
  } catch (err) {
    logger.error({ err }, 'Raise dispute error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// Add message to dispute
router.post('/:id/message', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 1) return res.status(400).json({ message: 'Message required' });

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ message: 'Dispute not found' });
    if (['RESOLVED', 'CLOSED'].includes(dispute.status)) return res.status(400).json({ message: 'Dispute closed hai' });

    dispute.messages.push({ senderId: req.user.id, senderName: req.user.name, senderRole: req.user.role, text });
    await dispute.save();
    return res.json({ message: 'Message add ho gaya', dispute });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Resolve dispute — only parties involved can act
// Raiser can withdraw (CLOSED); accused party can resolve (RESOLVED/UNDER_REVIEW)
router.patch('/:id/resolve', auth, async (req, res) => {
  try {
    const { resolution, status } = req.body;
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ message: 'Dispute not found' });

    const isRaiser = String(dispute.raisedById) === String(req.user.id);
    const isAccused = dispute.againstId && String(dispute.againstId) === String(req.user.id);

    if (!isRaiser && !isAccused) {
      return res.status(403).json({ message: 'Sirf dispute ke parties hi isko resolve kar sakte hain' });
    }

    // Raiser can only withdraw their own dispute
    if (isRaiser && status && status !== 'CLOSED') {
      return res.status(400).json({ message: 'Raiser sirf dispute withdraw (CLOSED) kar sakta hai' });
    }

    // Accused party can mark RESOLVED or UNDER_REVIEW only
    if (isAccused && status && !['RESOLVED', 'UNDER_REVIEW'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. RESOLVED ya UNDER_REVIEW allowed hai' });
    }

    dispute.resolution = resolution;
    dispute.status = status || (isRaiser ? 'CLOSED' : 'RESOLVED');
    dispute.resolvedById = req.user.id;
    dispute.resolvedByName = req.user.name;
    dispute.resolvedAt = new Date();
    await dispute.save();
    return res.json({ message: 'Dispute resolve ho gaya', dispute });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// My disputes
router.get('/my', auth, async (req, res) => {
  try {
    const disputes = await Dispute.find({ raisedById: req.user.id }).sort({ createdAt: -1 });
    return res.json({ disputes });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// All disputes (admin)
router.get('/all', auth, async (req, res) => {
  try {
    const { status, category } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    const disputes = await Dispute.find(filter).sort({ createdAt: -1 });
    return res.json({ disputes });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Upload evidence files to an existing dispute (parties only, max 3 files)
router.post('/:id/evidence', auth, upload.array('files', 3), async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ message: 'Dispute not found' });

    const isRaiser = String(dispute.raisedById) === String(req.user.id);
    const isAccused = dispute.againstId && String(dispute.againstId) === String(req.user.id);
    if (!isRaiser && !isAccused) {
      return res.status(403).json({ message: 'Sirf dispute ke parties evidence upload kar sakte hain' });
    }
    if (['RESOLVED', 'CLOSED'].includes(dispute.status)) {
      return res.status(400).json({ message: 'Closed dispute mein evidence nahi add ho sakta' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Koi file nahi mili' });
    }

    const uploaded = await Promise.all(
      req.files.map(async (file) => {
        const filename = `dispute_${dispute._id}_${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
        const url = await uploadEvidenceToCloudinary(file.buffer, filename);
        return { name: file.originalname, url };
      })
    );

    dispute.evidence.push(...uploaded);
    await dispute.save();
    return res.json({ message: `${uploaded.length} file(s) upload ho gaya`, evidence: dispute.evidence });
  } catch (err) {
    logger.error({ err }, 'Evidence upload error');
    return res.status(500).json({ message: 'Evidence upload failed' });
  }
});

// Get single dispute
router.get('/:id', auth, async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ message: 'Dispute not found' });
    return res.json({ dispute });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
