const express = require('express');
const router = express.Router();
const { z } = require('zod');
const auth = require('../../middleware/authMiddleware');
const QualityReport = require('../../models/QualityReport');
const logger = require('../../utils/logger').child({ module: 'quality' });

const reportSchema = z.object({
  produceId: z.string().min(1),
  cropType: z.string().min(1),
  grade: z.enum(['FAQ', 'A', 'B', 'C', 'Premium', 'Rejected']),
  moistureContent: z.number().optional(),
  purityPercent: z.number().optional(),
  foreignMatter: z.number().optional(),
  damagedGrains: z.number().optional(),
  weight: z.number().optional(),
  labName: z.string().optional(),
  graderName: z.string().optional(),
  graderLicenseNo: z.string().optional(),
  remarks: z.string().optional(),
  parameters: z.array(z.object({ name: z.string(), value: z.string(), unit: z.string().optional(), status: z.string().optional() })).optional()
});

router.post('/', auth, async (req, res) => {
  try {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

    const report = new QualityReport({
      ...parsed.data,
      farmerId: req.user.id,
      farmerName: req.user.name,
      status: 'COMPLETED'
    });
    await report.save();
    return res.status(201).json({ message: 'Quality report save ho gaya', report });
  } catch (err) {
    logger.error({ err }, 'Create quality report error');
    return res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['PENDING', 'COMPLETED', 'DISPUTED'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const report = await QualityReport.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!report) return res.status(404).json({ message: 'Report not found' });
    return res.json({ message: 'Status update ho gaya', report });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/my', auth, async (req, res) => {
  try {
    const reports = await QualityReport.find({ farmerId: req.user.id }).sort({ createdAt: -1 });
    return res.json({ reports });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/produce/:produceId', auth, async (req, res) => {
  try {
    const reports = await QualityReport.find({ produceId: req.params.produceId }).sort({ createdAt: -1 });
    return res.json({ reports });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
