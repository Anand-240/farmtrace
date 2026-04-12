const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const mongoose = require('mongoose');
const auth = require('../middleware/authMiddleware');
const Produce = require('../models/Produce');
const Transfer = require('../models/Transfer');
const { registerOnChain, getHistoryFromChain } = require('../blockchain/blockchainService');
const { validateSellPrice } = require('../utils/marketPricing');

function getFrontendBaseUrl(req) {
  const origin = req.get('origin');
  const envUrl = process.env.FRONTEND_URL || '';
  const allowedOrigins = envUrl.split(',').map(u => u.trim()).filter(Boolean);
  
  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }
  return (allowedOrigins[0] || 'http://localhost:3000').trim();
}

// BigInt ko string mein convert karo
function serializeBlockchain(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

function makeLotCode(prefix = 'LOT') {
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${time}-${rand}`;
}

function weightedPrice(lots) {
  const totalQty = lots.reduce((sum, lot) => sum + (Number(lot.quantity) || 0), 0);
  if (!totalQty) return 0;
  const weighted = lots.reduce((sum, lot) => {
    const qty = Number(lot.quantity) || 0;
    const price = Number(lot.farmPrice) || 0;
    return sum + (qty * price);
  }, 0);
  return Number((weighted / totalQty).toFixed(2));
}

// Produce register karo
router.post('/register', auth, async (req, res) => {
  try {
    const { farmerName, cropType, origin, quantity, qualityGrade, farmPrice } = req.body;

    const validation = await validateSellPrice({ 
      produce: { cropType, origin }, 
      requestedPrice: farmPrice, 
      transferType: 'FARM_TO_DISTRIBUTOR' 
    });
    
    if (!validation.allowed) {
      return res.status(400).json({ message: validation.reason });
    }

    const produce = await Produce.create({
      farmerName, cropType, origin, quantity,
      qualityGrade, farmPrice,
      farmerPhone: req.user.phone,
      currentOwner: req.user.phone,
      blockchainStatus: 'PENDING',
      lotCode: makeLotCode('LOT'),
      sourceType: 'REGISTER',
      lotStatus: 'ACTIVE'
    });

    if (!produce.rootLotId) {
      produce.rootLotId = produce._id;
      await produce.save();
    }

    const result = await registerOnChain(farmerName, cropType, origin, farmPrice);

    if (result.success) {
      produce.produceId = result.produceId;
      produce.txHash = result.txHash;
      produce.blockchainStatus = 'CONFIRMED';
      await produce.save();
    }

    const verifyUrl = `${getFrontendBaseUrl(req)}/verify/${produce._id}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl);

    res.json({
      success: true,
      produce,
      qrCodeDataUrl,
      txHash: result.txHash,
      etherscanUrl: result.etherscanUrl,
      message: 'Blockchain pe register ho gaya!'
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: err.message });
  }
});


router.get('/farmer/my', auth, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const filters = {
      farmerPhone: req.user.phone,
      ...(includeInactive ? {} : { lotStatus: 'ACTIVE' })
    };

    const produces = await Produce.find(filters)
      .sort({ createdAt: -1 });
    res.json(produces);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lot split: ek lot ko multiple sub-lots me tod do
router.post('/:id/split', auth, async (req, res) => {
  try {
    const { splits = [], quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid lot ID' });
    }

    const hasSingleQuantity = quantity !== undefined && quantity !== null && quantity !== '';
    if (!hasSingleQuantity && (!Array.isArray(splits) || splits.length < 1)) {
      return res.status(400).json({ message: 'Split ke liye valid quantity do' });
    }

    const sourceLot = await Produce.findById(req.params.id);
    if (!sourceLot) {
      return res.status(404).json({ message: 'Source lot nahi mila' });
    }

    if (sourceLot.currentOwner !== req.user.phone) {
      return res.status(403).json({ message: 'Sirf current owner lot split kar sakta hai' });
    }

    if (sourceLot.lotStatus !== 'ACTIVE') {
      return res.status(400).json({ message: 'Inactive lot split nahi ho sakta' });
    }

    const normalizedSplits = hasSingleQuantity
      ? [Number(quantity)]
      : splits.map((item) => Number(item?.quantity || item));

    const allValid = normalizedSplits.every((qty) => Number.isFinite(qty) && qty > 0);
    if (!allValid) {
      return res.status(400).json({ message: 'Har split quantity valid positive number honi chahiye' });
    }

    const requestedQty = normalizedSplits.reduce((sum, qty) => sum + qty, 0);
    const sourceQty = Number(sourceLot.quantity) || 0;

    // Single quantity split flow me remaining qty source lot me rehni chahiye.
    if (hasSingleQuantity && requestedQty >= sourceQty) {
      return res.status(400).json({
        message: 'Single split quantity source quantity se kam honi chahiye'
      });
    }

    if (requestedQty > sourceQty) {
      return res.status(400).json({ message: 'Split quantity source lot quantity se zyada nahi ho sakti' });
    }

    const children = await Produce.insertMany(
      normalizedSplits.map((qty, idx) => ({
        farmerName: sourceLot.farmerName,
        cropType: sourceLot.cropType,
        origin: sourceLot.origin,
        quantity: qty,
        qualityGrade: sourceLot.qualityGrade,
        farmPrice: sourceLot.farmPrice,
        imageUrl: sourceLot.imageUrl,
        farmerPhone: sourceLot.farmerPhone,
        currentOwner: sourceLot.currentOwner,
        lotCode: makeLotCode(`SPL${idx + 1}`),
        lotStatus: 'ACTIVE',
        sourceType: 'SPLIT',
        rootLotId: sourceLot.rootLotId || sourceLot._id,
        parentLots: [sourceLot._id],
        blockchainStatus: 'PENDING'
      }))
    );

    const remainingQty = Number((sourceQty - requestedQty).toFixed(3));
    sourceLot.quantity = remainingQty;
    sourceLot.childLots = [...(sourceLot.childLots || []), ...children.map((item) => item._id)];
    if (remainingQty <= 0) {
      sourceLot.lotStatus = 'SPLIT';
      sourceLot.quantity = 0;
    }
    await sourceLot.save();

    res.json({
      success: true,
      message: 'Lot split ho gaya',
      sourceLot,
      childLots: children,
      childLot: children.length === 1 ? children[0] : null,
      remainingQty: sourceLot.quantity
    });
  } catch (err) {
    console.error('Split lot error:', err);
    res.status(500).json({ message: 'Lot split nahi hua' });
  }
});

// Lot merge: multiple lots ko ek naya lot banao
router.post('/merge', auth, async (req, res) => {
  try {
    const { lotIds = [] } = req.body;

    if (!Array.isArray(lotIds) || lotIds.length < 2) {
      return res.status(400).json({ message: 'Merge ke liye kam se kam 2 lot IDs do' });
    }

    const validIds = lotIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length !== lotIds.length) {
      return res.status(400).json({ message: 'Invalid lot IDs diye gaye hain' });
    }

    const lots = await Produce.find({ _id: { $in: validIds } });
    if (lots.length !== validIds.length) {
      return res.status(404).json({ message: 'Kuch lots nahi mile' });
    }

    const sameOwner = lots.every((lot) => lot.currentOwner === req.user.phone);
    if (!sameOwner) {
      return res.status(403).json({ message: 'Sirf apne owned active lots merge kar sakte ho' });
    }

    const allActive = lots.every((lot) => lot.lotStatus === 'ACTIVE' && Number(lot.quantity) > 0);
    if (!allActive) {
      return res.status(400).json({ message: 'Sirf active lots merge ho sakte hain' });
    }

    const first = lots[0];
    const sameCrop = lots.every((lot) => lot.cropType === first.cropType);
    const sameGrade = lots.every((lot) => lot.qualityGrade === first.qualityGrade);

    if (!sameCrop || !sameGrade) {
      return res.status(400).json({ message: 'Merge ke liye crop type aur grade same hona chahiye' });
    }

    const mergedQty = Number(lots.reduce((sum, lot) => sum + (Number(lot.quantity) || 0), 0).toFixed(3));
    const merged = await Produce.create({
      farmerName: first.farmerName,
      cropType: first.cropType,
      origin: first.origin,
      quantity: mergedQty,
      qualityGrade: first.qualityGrade,
      farmPrice: weightedPrice(lots),
      imageUrl: first.imageUrl,
      farmerPhone: first.farmerPhone,
      currentOwner: first.currentOwner,
      lotCode: makeLotCode('MRG'),
      lotStatus: 'ACTIVE',
      sourceType: 'MERGE',
      rootLotId: first.rootLotId || first._id,
      parentLots: lots.map((lot) => lot._id),
      blockchainStatus: 'PENDING'
    });

    await Produce.updateMany(
      { _id: { $in: lots.map((lot) => lot._id) } },
      {
        $set: { lotStatus: 'MERGED', quantity: 0 },
        $addToSet: { childLots: merged._id }
      }
    );

    res.json({
      success: true,
      message: 'Lots merge ho gaye',
      mergedLot: merged,
      sourceLots: lots.map((lot) => lot._id)
    });
  } catch (err) {
    console.error('Merge lot error:', err);
    res.status(500).json({ message: 'Lot merge nahi hua' });
  }
});

// Distributor/Retailer ke received produces
router.get('/received/my', auth, async (req, res) => {
  try {
    const transfers = await Transfer.find({ toPhone: req.user.phone })
      .sort({ createdAt: -1 });

    const results = [];
    for (const t of transfers) {
      try {
        let produce = null;
        if (mongoose.Types.ObjectId.isValid(t.produceId)) {
          produce = await Produce.findById(t.produceId);
        }
        if (!produce) {
          produce = await Produce.findOne({ produceId: t.produceId });
        }
        if (produce) {
          results.push({
            ...produce.toObject(),
            receivedPrice: t.price,
            receivedFrom: t.fromPhone,
            transferType: t.transferType,
            transferId: t._id,
            transferTxHash: t.txHash
          });
        }
      } catch (e) {
        console.error('Transfer fetch error:', e.message);
      }
    }
    res.json(results);
  } catch (err) {
    console.error('Received error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Public — produce fetch + transfer history
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid produce ID' });
    }

    const produce = await Produce.findById(req.params.id)
      .populate('parentLots', 'lotCode cropType quantity lotStatus')
      .populate('childLots', 'lotCode cropType quantity lotStatus');
    if (!produce) {
      return res.status(404).json({ message: 'Produce nahi mila' });
    }

    // MongoDB se transfer history
    const dbTransfers = await Transfer.find({
      $or: [
        { produceId: req.params.id },
        { produceId: produce.produceId || '' }
      ]
    }).sort({ createdAt: 1 });

    // Blockchain se history — BigInt fix karo
    let blockchainHistory = [];
    if (produce.produceId) {
      try {
        const result = await getHistoryFromChain(produce.produceId);
        if (result.success) {
          blockchainHistory = serializeBlockchain(result.history);
        }
      } catch (e) {
        console.error('Blockchain history error:', e.message);
      }
    }

    res.json({
      ...serializeBlockchain(produce.toObject()),
      dbTransfers,
      blockchainHistory,
      isBlockchainVerified: !!produce.txHash
    });

  } catch (err) {
    console.error('Produce fetch error:', err);
    res.status(500).json({ message: err.message });
  }
});

// QR code
router.get('/:id/qr', async (req, res) => {
  try {
    const produce = await Produce.findById(req.params.id);
    if (!produce) return res.status(404).json({ message: 'Nahi mila' });
    const verifyUrl = `${getFrontendBaseUrl(req)}/verify/${produce._id}`;
    const qr = await QRCode.toDataURL(verifyUrl, { width: 400 });
    res.json({ qrCodeDataUrl: qr, verifyUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
