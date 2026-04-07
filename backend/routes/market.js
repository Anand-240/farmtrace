const express = require('express');

const router = express.Router();
const { fetchMandiRecords, getSellPriceFloor, pickBestMandiRecord } = require('../utils/marketPricing');

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

module.exports = router;