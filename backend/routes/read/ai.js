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

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ message: 'GEMINI_API_KEY server par set nahi hai.' });
    }

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-latest',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const prompt = `You are an expert AI agricultural assistant for Indian farmers. 
Analyze the provided image of a crop leaf.
Identify the disease, its severity, and provide practical home remedies and prevention steps.
Write your answers in simple Hindi (Latin alphabet is fine, or simple Devanagari).
Respond ONLY with this JSON structure:
{
  "disease": "name of the disease",
  "severity": "Low, Medium, or High",
  "remedies": ["remedy 1", "remedy 2"],
  "preventions": ["prevention 1", "prevention 2"]
}`;

    const imageParts = [
      {
        inlineData: {
          data: req.file.buffer.toString("base64"),
          mimeType: req.file.mimetype
        }
      }
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();
    
    let parsedData;
    try {
      const cleanText = responseText.replace(/```json|```/g, '').trim();
      parsedData = JSON.parse(cleanText);
    } catch (parseErr) {
      console.error('Gemini JSON Parse Error:', parseErr, 'Raw Text:', responseText);
      // Fallback detection if JSON fails
      parsedData = {
        disease: "Nirdharit nahi ho paaya (AI error)",
        severity: "Unknown",
        remedies: ["Kripya photo dubara saaf karke upload karein."],
        preventions: []
      };
    }

    res.json({
      success: true,
      data: parsedData
    });

  } catch (err) {
    logger.error({ err }, 'Disease detection error');
    res.status(500).json({ message: 'Bimari pehchanne mein dikkat aayi.' });
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
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

