const express = require('express');
const router = express.Router();
const { z } = require('zod');
const auth = require('../../middleware/authMiddleware');
const Dispute = require('../../models/Dispute');
const logger = require('../../utils/logger').child({ module: 'dispute' });

const disputeSchema = z.object({
  category: z.enum(['PAYMENT', 'QUALITY', 'QUANTITY', 'DELIVERY', 'FRAUD', 'OTHER']),
  description: z.string().min(10),
  transactionId: z.string().optional(),
  produceId: z.string().optional(),
  againstId: z.string().optional(),
  againstName: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional()
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

// Resolve dispute (admin/arbiter)
router.patch('/:id/resolve', auth, async (req, res) => {
  try {
    const { resolution, status } = req.body;
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ message: 'Dispute not found' });

    dispute.resolution = resolution;
    dispute.status = status || 'RESOLVED';
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
