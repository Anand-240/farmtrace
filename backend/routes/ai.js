const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const auth = require('../middleware/authMiddleware');
const Produce = require('../models/Produce');
const User = require('../models/User');
const Transfer = require('../models/Transfer');
const Notification = require('../models/Notification');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/parse-transfer', auth, async (req, res) => {
  try {
    const { message } = req.body;

    // Farmer ke produces fetch karo
    const myProduces = await Produce.find({
      farmerPhone: req.user.phone,
      blockchainStatus: 'CONFIRMED'
    });

    // Distributors/Retailers list fetch karo
    const receivers = await User.find({
      role: { $in: ['DISTRIBUTOR', 'RETAILER'] }
    }).select('name phone role village district');

    const produceList = myProduces.map(p =>
      `ID: ${p._id}, Crop: ${p.cropType}, Quantity: ${p.quantity}kg, Price: ₹${p.farmPrice}/kg`
    ).join('\n');

    const receiverList = receivers.map(r =>
      `Name: ${r.name}, Phone: ${r.phone}, Role: ${r.role}, Location: ${r.village || ''} ${r.district || ''}`
    ).join('\n');

    const prompt = `
You are an AI assistant for FarmTrace, an agricultural supply chain app in India.

A farmer named "${req.user.name}" wants to sell produce. Parse their message and extract transfer details.

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

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // JSON parse karo
    const cleanText = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanText);

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
