const express = require('express');

const router = express.Router();
const { fetchMandiRecords, getSellPriceFloor, pickBestMandiRecord, getMspPriceForCrop } = require('../utils/marketPricing');

const parseLimit = (rawLimit) => {
  const limit = Number(rawLimit);
  if (Number.isNaN(limit) || limit <= 0) return 5;
  return Math.min(limit, 20);
};

router.get('/mandi', async (req, res) => {
  try {
    const state = String(req.query.state || '').trim();
    const commodity = String(req.query.commodity || '').trim();
    const limit = parseLimit(req.query.limit);

    const { records, source, error } = await fetchMandiRecords({ commodity, state, limit });
    const selectedRecord = pickBestMandiRecord(records, commodity)?.record || null;
    const selectedPrice = selectedRecord ? Number(selectedRecord.modal_price) / 100 : null;

    return res.json({
      records,
      source,
      selectedRecord,
      selectedPrice,
      floorPrice: selectedPrice,
      floorSource: selectedPrice ? 'MANDI' : null,
      floorLabel: selectedPrice ? `Current mandi rate ₹${selectedPrice.toFixed(2)}/kg` : null,
      mspPrice: null,
      allowed: Boolean(selectedPrice),
      error: error || null
    });
  } catch (err) {
    console.error('Mandi API proxy error:', err.message);
    return res.status(502).json({ message: 'Mandi rates fetch nahi ho paya' });
  }
});

router.get('/floor', async (req, res) => {
  try {
    const cropType = String(req.query.cropType || '').trim();
    const origin = String(req.query.origin || '').trim();

    const produce = { cropType, origin };
    const floorInfo = await getSellPriceFloor({ produce });

    return res.json({
      ...floorInfo,
      error: floorInfo.allowed ? null : floorInfo.reason
    });
  } catch (err) {
    console.error('Market floor error:', err.message);
    return res.status(502).json({ message: 'Market floor fetch nahi ho paya' });
  }
});

router.get('/commodities', async (req, res) => {
  try {
    const state = String(req.query.state || '').trim();
    const { records, error } = await fetchMandiRecords({ state, limit: 400 });
    if (error) throw new Error(error);

    const priceMap = {};
    records.forEach(r => {
      const comm = r.commodity || r.comm;
      if (!comm) return;
      const price = Number(r.modal_price) / 100;
      if (price > 0 && (!priceMap[comm] || price > priceMap[comm])) {
        priceMap[comm] = price;
      }
    });

    // Strategy: Always show all crops that have an MSP, plus any extras from mandi
    const mspTable = require('../utils/marketPricing').getMspPriceForCrop; // Using the helper
    const mspCropsInternal = Object.keys(require('../utils/marketPricing').parseMspTable());
    const mandiCrops = records.map(r => r.commodity || r.comm).filter(Boolean);
    
    const allCrops = [...new Set([...mspCropsInternal, ...mandiCrops])];

    const commoditiesObjects = allCrops
      .map(c => {
        const msp = getMspPriceForCrop(c) || 0;
        const mandi = priceMap[c] || 0;
        const bestPrice = Math.max(mandi, msp).toFixed(2);
        
        // If no price found at all, skip it (unless it was in mspCropsInternal which means it has a price)
        if (Number(bestPrice) <= 0) return null;
        
        return { name: c, price: bestPrice };
      })
      .filter(Boolean);

    return res.json({ commodities: commoditiesObjects.sort((a, b) => a.name.localeCompare(b.name)) });
  } catch (err) {
    console.error('Commodities fetch error:', err.message);
    return res.status(502).json({ message: 'Available commodities fetch nahi ho payin' });
  }
});

module.exports = router;