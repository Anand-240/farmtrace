const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const auth = require('../../middleware/authMiddleware');
const Produce = require('../../models/Produce');
const User = require('../../models/User');
const Transfer = require('../../models/Transfer');
const Notification = require('../../models/Notification');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { validateSellPrice } = require('../../utils/marketPricing');
const logger = require('../../utils/logger').child({ module: 'ai' });
// Import file-type dynamically if using ES Module, or directly if CJS compatible
let fileType;
import('file-type').then(module => fileType = module).catch(e => console.log('file-type load err:', e));

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function buildFarmerGreeting(user, produceCount, distributorCount) {
  if (!process.env.GROQ_API_KEY) {
    return `Namaste ${user.name}! Main aapka FarmTrace AI assistant hoon. Aap yahan nayi fasal register kar sakte ho ya apni confirmed fasal distributor ko bech sakte ho.`;
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a concise Hindi assistant for Indian farmers using FarmTrace.
Write one short greeting in simple Hindi.
Mention that the farmer can either register a new crop or sell to a distributor.
Keep it under 35 words. No markdown.`
        },
        {
          role: 'user',
          content: `Farmer name: ${user.name}
Confirmed produce count: ${produceCount}
Distributor count: ${distributorCount}`
        }
      ],
      temperature: 0.4,
      max_tokens: 80
    });

    return completion.choices?.[0]?.message?.content?.trim()
      || `Namaste ${user.name}! Main aapki madad karunga. Aap nayi fasal register kar sakte ho ya distributor ko bech sakte ho.`;
  } catch (err) {
    logger.error({ err }, 'Greeting AI error');
    return `Namaste ${user.name}! Main aapka FarmTrace AI assistant hoon. Aap yahan nayi fasal register kar sakte ho ya apni confirmed fasal distributor ko bech sakte ho.`;
  }
}

router.get('/farmer-assistant/bootstrap', auth, async (req, res) => {
  try {
    const produces = await Produce.find({
      farmerPhone: req.user.phone,
      blockchainStatus: 'CONFIRMED'
    })
      .sort({ createdAt: -1 })
      .select('_id cropType origin quantity qualityGrade farmPrice createdAt');

    const distributors = await User.find({ role: 'DISTRIBUTOR' })
      .sort({ name: 1 })
      .select('name email phone village city district state');

    const greeting = await buildFarmerGreeting(
      req.user,
      produces.length,
      distributors.length
    );

    res.json({
      success: true,
      greeting,
      produces: produces.map((produce) => ({
        _id: produce._id,
        cropType: produce.cropType,
        origin: produce.origin,
        quantity: produce.quantity,
        qualityGrade: produce.qualityGrade,
        farmPrice: produce.farmPrice
      })),
      distributors: distributors.map((distributor) => ({
        name: distributor.name,
        email: distributor.email,
        phone: distributor.phone,
        location: [distributor.village, distributor.city || distributor.district, distributor.state]
          .filter(Boolean)
          .join(', ')
      }))
    });
  } catch (err) {
    console.error('Farmer assistant bootstrap error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post('/parse-transfer', auth, async (req, res) => {
  try {
    const { message } = req.body;

    const myProduces = await Produce.find({
      farmerPhone: req.user.phone,
      blockchainStatus: 'CONFIRMED'
    });

    const receivers = await User.find({
      role: { $in: ['DISTRIBUTOR', 'RETAILER'] }
    }).select('name email phone role village city district');

    const produceList = myProduces.map(p =>
      `ID: ${p._id}, Crop: ${p.cropType}, Quantity: ${p.quantity}kg, FarmPrice: ₹${p.farmPrice}/kg`
    ).join('\n');

    const receiverList = receivers.map(r =>
      `Name: ${r.name}, Email: ${r.email}, Phone: ${r.phone}, Role: ${r.role}, Location: ${r.village || ''} ${r.city || r.district || ''}`
    ).join('\n');

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant for FarmTrace, an agricultural supply chain app in India.
Extract transfer details from farmer's message and respond ONLY with valid JSON.
No markdown, no explanation, just JSON.`
        },
        {
          role: 'user',
          content: `Farmer: "${req.user.name}"

Farmer's produces:
${produceList || 'No produces yet'}

Available distributors/retailers:
${receiverList || 'None available'}

Farmer's message: "${message}"

Respond ONLY with this JSON:
{
  "understood": true/false,
  "produceId": "mongodb_id or null",
  "cropType": "crop name",
  "quantity": number or null,
  "pricePerKg": number or null,
  "receiverEmail": "matched email or null",
  "receiverName": "matched name or null",
  "location": "location or null",
  "transferType": "FARM_TO_DISTRIBUTOR or DISTRIBUTOR_TO_RETAILER",
  "clarificationNeeded": "question if unclear, or null",
  "summary": "Hindi mein confirm karne ke liye ek line"
}`
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    const text = completion.choices[0].message.content.trim();
    const cleanText = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    res.json({ success: true, parsed });

  } catch (err) {
    logger.error({ err }, 'AI parse-transfer error');
    res.status(500).json({ message: err.message });
  }
});

router.post('/confirm-transfer', auth, async (req, res) => {
  try {
    const { produceId, receiverPhone, receiverEmail, pricePerKg, location, transferType } = req.body;

    const produce = await Produce.findById(produceId);
    if (!produce) return res.status(404).json({ message: 'Produce nahi mila' });

    const sellValidation = await validateSellPrice({
      produce,
      requestedPrice: pricePerKg,
      transferType: transferType || 'FARM_TO_DISTRIBUTOR'
    });

    if (!sellValidation.allowed) {
      return res.status(400).json({
        message: sellValidation.reason,
        floorPrice: sellValidation.floorPrice || null,
        mandiPrice: sellValidation.mandiPrice || null,
        mspPrice: sellValidation.mspPrice || null,
        floorSource: sellValidation.floorSource || null,
        floorLabel: sellValidation.floorLabel || null,
        commodity: sellValidation.commodity || null,
        state: sellValidation.state || null
      });
    }

    const normalizedEmail = receiverEmail?.trim().toLowerCase();
    const receiver = await User.findOne(
      normalizedEmail ? { email: normalizedEmail } : { phone: receiverPhone?.trim() }
    );
    if (!receiver) return res.status(404).json({ message: 'Receiver nahi mila' });

    const transfer = await Transfer.create({
      produceMongoId: produce._id,
      produceChainId: produce.produceId || null,
      produceId: String(produce._id),
      fromPhone: req.user.phone,
      toPhone: receiver.phone,
      price: pricePerKg,
      location: location || receiver.city || receiver.district || 'India',
      transferType: transferType || 'FARM_TO_DISTRIBUTOR',
      blockchainStatus: 'PENDING',
      paymentStatus: 'PENDING'
    });

    await Notification.create({
      userPhone: receiver.phone,
      title: 'Naya Transfer Request',
      message: `${req.user.name} ne ${produce.cropType} transfer karne ki request bheji — ₹${pricePerKg}/kg`,
      type: 'REQUEST_RECEIVED',
      data: { transferId: transfer._id, produceId }
    });

    res.json({
      success: true,
      transfer,
      message: `${produce.cropType} ki request ${receiver.name} ko bheji gayi!`
    });

  } catch (err) {
    logger.error({ err }, 'AI confirm-transfer error');
    res.status(500).json({ message: err.message });
  }
});

router.post('/disease-detect', auth, (req, res, next) => {
  upload.single('image')(req, res, async function (err) {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ message: err.message || 'Image upload fail ho gaya.' });
    }
    
    if (req.file && fileType) {
      const type = await fileType.fileTypeFromBuffer(req.file.buffer);
      if (!type || !type.mime.startsWith('image/')) {
        return res.status(400).json({ message: 'Invalid file type. Only images are allowed.' });
      }
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Koi image upload nahi hui.' });
    }

    const hfToken = process.env.HF_API_TOKEN;
    if (!hfToken) {
      return res.status(503).json({ message: 'HF_API_TOKEN server par set nahi hai.' });
    }

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
      if (response.status === 503) {
        return res.status(503).json({ 
          message: 'HuggingFace model load ho raha hai, thodi der mein dobara try karein (Cold Start).' 
        });
      }
      logger.error({ status: response.status, body: errText }, 'HF API error');
      throw new Error('Detection service temporarily unavailable');
    }

    const detections = await response.json();

    if (!Array.isArray(detections) || detections.length === 0) {
      return res.json({
        success: true,
        data: {
          disease: "Koi bimari nahi mili",
          severity: "Low",
          remedies: ["Fasal swasth lag rahi hai. Regular checkup karte rahein."],
          preventions: []
        }
      });
    }

    // Map detections to our advice table (reusing logic from cropDisease.js)
    const DISEASE_ADVICE = {
      'bacterial blight': { hi: 'Bacterial Blight', remedy: 'Copper-based fungicide spray karo.', severity: 'high' },
      'brown spot': { hi: 'Brown Spot', remedy: 'Mancozeb ya Tricyclazole fungicide use karo.', severity: 'medium' },
      'leaf blast': { hi: 'Leaf Blast', remedy: 'Tricyclazole spray immediately karo.', severity: 'high' },
      'leaf blight': { hi: 'Leaf Blight', remedy: 'Propiconazole fungicide spray karo.', severity: 'high' },
      'leaf scald': { hi: 'Leaf Scald', remedy: 'Systemic fungicide use karo.', severity: 'medium' },
      'narrow brown leaf spot': { hi: 'Narrow Brown Spot', remedy: 'Fungicide spray karo.', severity: 'low' },
      'neck blast': { hi: 'Neck Blast', remedy: 'Tricyclazole spray karo.', severity: 'high' },
      'rice hispa': { hi: 'Rice Hispa', remedy: 'Chlorpyriphos insecticide spray karo.', severity: 'medium' },
      'sheath blight': { hi: 'Sheath Blight', remedy: 'Hexaconazole fungicide use karo.', severity: 'high' },
      'sheath rot': { hi: 'Sheath Rot', remedy: 'Carbendazim fungicide spray karo.', severity: 'medium' },
      'tungro': { hi: 'Tungro Virus', remedy: 'Infected plants uproot karo.', severity: 'high' },
      'healthy': { hi: 'Fasal Swasth Hai', remedy: 'Koi bimari nahi mili.', severity: 'none' },
    };

    const top = detections[0];
    const key = top.label.toLowerCase();
    let match = { disease: top.label, remedy: 'Nazdiki Krishi Vigyan Kendra (KVK) se sampark karo.', severity: 'unknown' };

    for (const [d, advice] of Object.entries(DISEASE_ADVICE)) {
      if (key.includes(d)) {
        match = { disease: advice.hi, remedy: advice.remedy, severity: advice.severity };
        break;
      }
    }

    res.json({
      success: true,
      data: {
        disease: match.disease,
        severity: match.severity,
        remedies: [match.remedy],
        preventions: ["Khet mein paani ka drainage sahi rakho.", "Infected patti ko jala do."]
      }
    });

  } catch (err) {
    logger.error({ err }, 'HF Disease detection error');
    res.status(500).json({ message: 'Bimari pehchanne mein dikkat aayi. Kripya baad mein try karein.' });
  }
});

/**
 * POST /api/v1/ai/chat
 * Conversational AI with farmer context injected as system prompt.
 * Tries Groq first; falls back to Google Gemini on rate-limit or error.
 */
router.post('/chat', auth, async (req, res) => {
  try {
    // history: [{ role: 'user'|'assistant', content: string }]
    const { message, history = [] } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    // ── Inject farmer context into system prompt ──────────────────────────────
    const [produces, transfers] = await Promise.all([
      Produce.find({ farmerPhone: req.user.phone }).sort({ createdAt: -1 }).limit(10)
        .select('cropType origin quantity qualityGrade farmPrice lotStatus blockchainStatus createdAt'),
      Transfer.find({
        $or: [{ fromPhone: req.user.phone }, { toPhone: req.user.phone }]
      }).sort({ createdAt: -1 }).limit(5).select('transferType price location paymentStatus blockchainStatus createdAt')
    ]);

    const produceContext = produces.length
      ? produces.map(p =>
          `- ${p.cropType} | ${p.quantity}kg | Grade ${p.qualityGrade} | ₹${p.farmPrice}/kg | ${p.origin} | Status: ${p.blockchainStatus}`
        ).join('\n')
      : 'No produce registered yet.';

    const transferContext = transfers.length
      ? transfers.map(t =>
          `- ${t.transferType} | ₹${t.price}/kg | ${t.location} | Payment: ${t.paymentStatus}`
        ).join('\n')
      : 'No recent transfers.';

    const systemPrompt = `You are FarmTrace AI — a helpful, concise agri-supply-chain assistant for Indian farmers.
You answer questions about the farmer's registered crops, supply chain, mandi prices, best farming practices, and FarmTrace platform features.
Always respond in a mix of simple Hindi and English (Hinglish), keeping answers brief and practical.
NEVER make up data — only reference the farmer's actual data provided below.

=== FARMER PROFILE ===
Name: ${req.user.name}
Phone: ${req.user.phone}
Role: ${req.user.role}

=== REGISTERED PRODUCE (last 10) ===
${produceContext}

=== RECENT TRANSFERS (last 5) ===
${transferContext}

If the user asks something outside your scope, politely redirect them.`;

    // Build messages array: system + last 3 history turns + new message
    const trimmedHistory = history.slice(-6); // max 3 back-and-forth
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...trimmedHistory.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    let reply = null;

    // ── Primary: Groq ─────────────────────────────────────────────────────────
    if (process.env.GROQ_API_KEY) {
      try {
        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: chatMessages,
          temperature: 0.5,
          max_tokens: 400
        });
        reply = completion.choices?.[0]?.message?.content?.trim();
      } catch (groqErr) {
        const isRateLimit = groqErr?.status === 429 || groqErr?.message?.toLowerCase().includes('rate');
        logger.warn({ err: groqErr, isRateLimit }, 'Groq failed, falling back to Gemini');
        reply = null;
      }
    }

    // ── Fallback: Google Gemini ───────────────────────────────────────────────
    if (!reply && process.env.GEMINI_API_KEY) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Gemini uses a different message format — no 'system' role in generateContent
        const geminiHistory = trimmedHistory.map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }]
        }));

        const chat = model.startChat({
          history: geminiHistory,
          systemInstruction: systemPrompt
        });

        const result = await chat.sendMessage(message);
        reply = result.response.text()?.trim();
      } catch (geminiErr) {
        logger.error({ err: geminiErr }, 'Gemini fallback also failed');
      }
    }

    if (!reply) {
      return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again shortly.' });
    }

    res.json({ success: true, reply });
  } catch (err) {
    logger.error({ err }, 'AI chat error');
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

