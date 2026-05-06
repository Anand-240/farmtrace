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

const DISEASE_ADVICE = {
  'bacterial_blight': { hi: 'Bacterial Blight', remedy: 'Copper-based fungicide spray karo. Infected plants hatao. Drainage improve karo.', severity: 'high' },
  'blast': { hi: 'Blast (Bimari)', remedy: 'Tricyclazole ya Isoprothiolane fungicide use karo. Potassium fertilizer badaho.', severity: 'high' },
  'brown_spot': { hi: 'Brown Spot', remedy: 'Mancozeb ya Tricyclazole spray karo. Nitrogen fertilizer balance rakho.', severity: 'medium' },
  'leaf_blight': { hi: 'Leaf Blight', remedy: 'Propiconazole fungicide spray karo. Infected leaves kato aur jalao.', severity: 'high' },
  'rust': { hi: 'Rust (Gerua)', remedy: 'Propiconazole ya Tebuconazole use karo. Affected parts hatao.', severity: 'high' },
  'smut': { hi: 'Smut', remedy: 'Seed treatment karo aur infected parts hatao. Drainage sahi rakho.', severity: 'medium' },
  'mosaic': { hi: 'Mosaic Virus', remedy: 'Infected plants uproot karo. Green leafhopper aur insects control karo.', severity: 'high' },
  'septoria': { hi: 'Septoria Leaf Spot', remedy: 'Fungicide spray karo. Crop rotation follow karo.', severity: 'medium' },
  'scab': { hi: 'Scab', remedy: 'Fungicide spray karo aur drainage improve karo.', severity: 'medium' },
  'healthy': { hi: 'Fasal Swasth Hai', remedy: 'Koi bimari nahi mili. Regular monitoring jari rakho.', severity: 'none' },
};

function getAdvice(label = '') {
  const key = label.toLowerCase().trim();
  for (const [disease, advice] of Object.entries(DISEASE_ADVICE)) {
    if (key.includes(disease)) return { disease: advice.hi, remedy: advice.remedy, severity: advice.severity };
  }
  return { disease: label, remedy: 'Nazdiki Krishi Vigyan Kendra (KVK) se sampark karo.', severity: 'unknown' };
}

// POST /api/v1/crop-disease/detect
router.post('/detect', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Image required hai' });

    const hfToken = process.env.HF_API_TOKEN;
    if (!hfToken) return res.status(503).json({ message: 'HF_API_TOKEN not configured' });

    const response = await fetch(
      'https://api-inference.huggingface.co/models/wambugu71/crop_leaf_diseases_vit',
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
      return res.status(502).json({ message: 'Detection service unavailable' });
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
