const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../../middleware/authMiddleware');
const logger = require('../../utils/logger').child({ module: 'cropDisease' });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Sirf image allowed hai'));
    cb(null, true);
  }
});

const { getAdvice } = require('../../utils/diseaseMapping');

// POST /api/v1/crop-disease/detect
router.post('/detect', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Image required hai' });

    const hfToken = process.env.HF_API_TOKEN;
    if (!hfToken) return res.status(503).json({ message: 'HF_API_TOKEN not configured' });

    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': req.file.mimetype
        },
        body: req.file.buffer
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 503) {
        const errJson = JSON.parse(errText || '{}');
        return res.status(503).json({
          message: 'Model load ho raha hai, thodi der mein dobara try karo',
          estimatedTime: errJson.estimated_time || 20
        });
      }
      logger.error({ status: response.status, body: errText }, 'HF API error');
      return res.status(response.status).json({ 
        message: `HuggingFace API Error: ${response.status}`,
        details: errText.substring(0, 100)
      });
    }

    const detections = await response.json();

    if (!Array.isArray(detections) || detections.length === 0) {
      return res.json({ detections: [], summary: 'Koi bimari nahi mili ya image unclear hai.' });
    }

    // Map detections to our advice table
    const results = detections
      .map(d => ({
        label: d.label,
        confidence: Math.round(d.score * 100),
        ...getAdvice(d.label)
      }));

    const topDisease = results[0];
    const summary = topDisease?.severity === 'none'
      ? 'Fasal swasth lag rahi hai'
      : `${topDisease.disease} detected (${topDisease.confidence}% confidence)`;

    logger.info({ userId: req.user.id, topDisease: topDisease?.label }, 'Crop disease detected');

    res.json({ detections: results, summary });
  } catch (err) {
    logger.error({ err }, 'Crop disease detection error');
    res.status(500).json({ message: 'Detection fail hua, dobara try karo' });
  }
});

module.exports = router;
