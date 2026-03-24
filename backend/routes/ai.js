const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const auth = require('../middleware/authMiddleware');
const Produce = require('../models/Produce');
const User = require('../models/User');
const Transfer = require('../models/Transfer');
const Notification = require('../models/Notification');

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
    console.error('Greeting AI error:', err.message);
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
      .select('name phone village district state');

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
        phone: distributor.phone,
        location: [distributor.village, distributor.district, distributor.state]
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
    }).select('name phone role village district');

    const produceList = myProduces.map(p =>
      `ID: ${p._id}, Crop: ${p.cropType}, Quantity: ${p.quantity}kg, FarmPrice: ₹${p.farmPrice}/kg`
    ).join('\n');

    const receiverList = receivers.map(r =>
      `Name: ${r.name}, Phone: ${r.phone}, Role: ${r.role}, Location: ${r.village || ''} ${r.district || ''}`
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
  "receiverPhone": "matched phone or null",
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
    console.error('AI error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post('/confirm-transfer', auth, async (req, res) => {
  try {
    const { produceId, receiverPhone, pricePerKg, location, transferType } = req.body;

    const produce = await Produce.findById(produceId);
    if (!produce) return res.status(404).json({ message: 'Produce nahi mila' });

    const receiver = await User.findOne({ phone: receiverPhone });
    if (!receiver) return res.status(404).json({ message: 'Receiver nahi mila' });

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
