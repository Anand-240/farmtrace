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
  'bacterial blight': { hi: 'Bacterial Blight', remedy: 'Copper-based fungicide spray karo. Infected plants hatao. Drainage improve karo.', severity: 'high' },
  'brown spot': { hi: 'Brown Spot', remedy: 'Mancozeb ya Tricyclazole fungicide use karo. Nitrogen fertilizer balance rakho.', severity: 'medium' },
  'leaf blast': { hi: 'Leaf Blast', remedy: 'Tricyclazole spray immediately karo. Potassium fertilizer badaho. Waterlogging avoid karo.', severity: 'high' },
  'leaf blight': { hi: 'Leaf Blight', remedy: 'Propiconazole fungicide spray karo. Infected leaves kato aur jalao.', severity: 'high' },
  'leaf scald': { hi: 'Leaf Scald', remedy: 'Systemic fungicide use karo. Silicon fertilizer apply karo.', severity: 'medium' },
  'narrow brown leaf spot': { hi: 'Narrow Brown Spot', remedy: 'Fungicide spray karo. Waterlogged conditions improve karo.', severity: 'low' },
  'neck blast': { hi: 'Neck Blast', remedy: 'Tricyclazole ya Isoprothiolane spray karo. Early stage mein treat karna zaroori hai.', severity: 'high' },
  'rice hispa': { hi: 'Rice Hispa', remedy: 'Chlorpyriphos ya Quinalphos insecticide spray karo. Affected leaves kato.', severity: 'medium' },
  'sheath blight': { hi: 'Sheath Blight', remedy: 'Hexaconazole ya Propiconazole fungicide use karo. Plant density kam karo.', severity: 'high' },
  'sheath rot': { hi: 'Sheath Rot', remedy: 'Carbendazim fungicide spray karo. Phosphorus aur potassium fertilizer badaho.', severity: 'medium' },
  'tungro': { hi: 'Tungro Virus', remedy: 'Infected plants uproot karo. Green leafhopper control karo — imidacloprid use karo.', severity: 'high' },
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
      'https://api-inference.huggingface.co/models/iamnotpalak/yolov8-transfpn-crop-disease-detection',
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
      // Model cold start — HuggingFace returns 503 with estimated_time
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

    // Filter low-confidence results and enrich with advice
    const results = detections
      .filter(d => d.score >= 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(d => ({
        label: d.label,
        confidence: Math.round(d.score * 100),
        box: d.box,
        ...getAdvice(d.label)
      }));

    const topDisease = results[0];
    const summary = topDisease
      ? `${topDisease.disease} detected (${topDisease.confidence}% confidence)`
      : 'Fasal swasth lag rahi hai';

    logger.info({ userId: req.user.id, topDisease: topDisease?.label }, 'Crop disease detected');

    res.json({ detections: results, summary });
  } catch (err) {
    logger.error({ err }, 'Crop disease detection error');
    res.status(500).json({ message: 'Detection fail hua, dobara try karo' });
  }
});

module.exports = router;
