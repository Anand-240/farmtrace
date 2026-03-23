const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const auth = require('../middleware/authMiddleware');
const Produce = require('../models/Produce');
const User = require('../models/User');
const Transfer = require('../models/Transfer');
const Notification = require('../models/Notification');

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNumber(pattern, message) {
  const match = message.match(pattern);
  return match ? Number(match[1]) : null;
}

function extractLocation(message) {
  const locationPatterns = [
    /(?:in|at|to)\s+([a-zA-Z\s]+?)(?:\s+mein|\s+me|\s+ko|\s+for|\s*$)/i,
    /([a-zA-Z\s]+?)\s+mein/i
  ];

  for (const pattern of locationPatterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function findMatchingProduce(message, produces) {
  const normalizedMessage = normalizeText(message);
  return produces.find(produce =>
    normalizedMessage.includes(normalizeText(produce.cropType))
  ) || null;
}

function findMatchingReceiver(message, receivers) {
  const normalizedMessage = normalizeText(message);

  return receivers.find(receiver => {
    const normalizedName = normalizeText(receiver.name);
    return normalizedName && normalizedMessage.includes(normalizedName);
  }) || null;
}

function buildSummary({ quantity, cropType, receiverName, pricePerKg, location }) {
  const parts = [
    quantity ? `${quantity} kilo ${cropType}` : cropType,
    receiverName ? `${receiverName} ko` : null,
    pricePerKg ? `₹${pricePerKg}/kg mein` : null,
    location ? `${location} ke liye` : null
  ].filter(Boolean);

  return `${parts.join(' ')} bechne ki request bheju?`;
}

function buildClarification({ produce, receiver, pricePerKg }) {
  if (!produce && !receiver) {
    return 'Kaunsi fasal aur kisko bhejna hai? Fasal ka naam aur receiver ka naam batao.';
  }
  if (!produce) {
    return 'Kaunsi registered fasal bhejni hai? Fasal ka naam clear batao.';
  }
  if (!receiver) {
    return 'Kisko bhejna hai? Distributor ya retailer ka naam batao.';
  }
  if (!pricePerKg) {
    return 'Kitne rupaye per kilo mein bechna hai? Price batao.';
  }

  return null;
}

function parseTransferLocally(message, produces, receivers) {
  const produce = findMatchingProduce(message, produces);
  const receiver = findMatchingReceiver(message, receivers);
  const quantity =
    extractNumber(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilogram)/i, message) ||
    produce?.quantity ||
    null;
  const pricePerKg =
    extractNumber(/(?:₹|rs\.?|rupees?|rupaye?)\s*(\d+(?:\.\d+)?)/i, message) ||
    extractNumber(/(\d+(?:\.\d+)?)\s*(?:rupaye|rupees?|rs\.?)\b/i, message) ||
    null;
  const location = extractLocation(message) || receiver?.district || receiver?.village || null;
  const clarificationNeeded = buildClarification({ produce, receiver, pricePerKg });

  return {
    understood: Boolean(produce || receiver || pricePerKg || quantity),
    produceId: produce?._id?.toString() || null,
    cropType: produce?.cropType || null,
    quantity,
    pricePerKg,
    receiverPhone: receiver?.phone || null,
    receiverName: receiver?.name || null,
    location,
    transferType: 'FARM_TO_DISTRIBUTOR',
    clarificationNeeded,
    summary: produce && receiver && pricePerKg
      ? buildSummary({
          quantity,
          cropType: produce.cropType,
          receiverName: receiver.name,
          pricePerKg,
          location
        })
      : 'Details thode aur clear chahiye.'
  };
}

async function parseTransferWithAI(message, user, produces, receivers) {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const produceList = produces.map(p =>
    `ID: ${p._id}, Crop: ${p.cropType}, Quantity: ${p.quantity}kg, Price: ₹${p.farmPrice}/kg`
  ).join('\n');

  const receiverList = receivers.map(r =>
    `Name: ${r.name}, Phone: ${r.phone}, Role: ${r.role}, Location: ${r.village || ''} ${r.district || ''}`
  ).join('\n');

  const prompt = `
You are an AI assistant for FarmTrace, an agricultural supply chain app in India.

A farmer named "${user.name}" wants to sell produce. Parse their message and extract transfer details.

Farmer's registered produces:
${produceList || 'No produces registered yet'}

Available distributors/retailers:
${receiverList || 'No receivers available'}

Farmer's message: "${message}"

Respond ONLY with a valid JSON object, no markdown, no explanation:
{
  "understood": true/false,
  "produceId": "mongodb_id or null",
  "cropType": "extracted crop name",
  "quantity": number or null,
  "pricePerKg": number or null,
  "receiverPhone": "matched phone or null",
  "receiverName": "matched name or null",
  "location": "extracted location or null",
  "transferType": "FARM_TO_DISTRIBUTOR or DISTRIBUTOR_TO_RETAILER",
  "clarificationNeeded": "question to ask if something unclear, or null",
  "summary": "Hindi mein ek line summary jo farmer ko confirm karne ke liye dikhai de"
}
`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleanText = text.replace(/```json|```/g, '').trim();

  return JSON.parse(cleanText);
}

router.post('/parse-transfer', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ message: 'Message required hai' });
    }

    // Farmer ke produces fetch karo
    const myProduces = await Produce.find({
      farmerPhone: req.user.phone,
      blockchainStatus: 'CONFIRMED'
    });

    // Distributors/Retailers list fetch karo
    const receivers = await User.find({
      role: { $in: ['DISTRIBUTOR', 'RETAILER'] }
    }).select('name phone role village district');

    let parsed;
    try {
      parsed = await parseTransferWithAI(message, req.user, myProduces, receivers);
    } catch (aiError) {
      console.error('AI parse fallback triggered:', aiError.message);
      parsed = parseTransferLocally(message, myProduces, receivers);
    }

    res.json({ success: true, parsed });

  } catch (err) {
    console.error('AI parse error:', err);
    res.status(500).json({ message: err.message });
  }
});

// AI se transfer confirm karke request banao
router.post('/confirm-transfer', auth, async (req, res) => {
  try {
    const { produceId, receiverPhone, pricePerKg, location, transferType } = req.body;

    const produce = await Produce.findById(produceId);
    if (!produce) return res.status(404).json({ message: 'Produce nahi mila' });

    const receiver = await User.findOne({ phone: receiverPhone });
    if (!receiver) return res.status(404).json({ message: 'Receiver nahi mila' });

    // Transfer request banao
    const transfer = await Transfer.create({
      produceId,
      fromPhone: req.user.phone,
      toPhone: receiverPhone,
      price: pricePerKg,
      location: location || receiver.district || 'India',
      transferType: transferType || 'FARM_TO_DISTRIBUTOR',
      blockchainStatus: 'PENDING',
      paymentStatus: 'PENDING'
    });

    // Receiver ko notification
    await Notification.create({
      userPhone: receiverPhone,
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
    console.error('Confirm error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
