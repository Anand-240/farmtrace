const express = require('express');

const router = express.Router();
const { fetchMandiRecords, getSellPriceFloor, pickBestMandiRecord, getMspPriceForCrop, getStatePriceMap, normalizeText } = require('../../utils/marketPricing');
const { Client } = require('@elastic/elasticsearch');

const elasticClient = new Client({
  node: process.env.ELASTICSEARCH_URL,
});

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
    const { priceMap, records, error } = await getStatePriceMap(state);
    if (error) throw new Error(error);

    // Strategy: Always show all crops that have an MSP, plus any extras from mandi
    const mspCropsInternal = Object.keys(require('../../utils/marketPricing').parseMspTable());
    const mandiCrops = records.map(r => r.commodity || r.comm).filter(Boolean);
    
    const allCrops = [...new Set([...mspCropsInternal, ...mandiCrops])];

    const commoditiesObjects = allCrops
      .map(c => {
        const normed = normalizeText(c);
        const msp = getMspPriceForCrop(c) || 0;
        const mandi = priceMap[normed] || 0;
        const bestPrice = Math.max(mandi, msp);
        
        if (bestPrice <= 0) return null;
        return { name: c, price: bestPrice };
      })
      .filter(Boolean);

    return res.json({ commodities: commoditiesObjects.sort((a, b) => a.name.localeCompare(b.name)) });
  } catch (err) {
    console.error('Commodities fetch error:', err.message);
    return res.status(502).json({ message: 'Available commodities fetch nahi ho payin' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.json({ results: [] });
    }

    const result = await elasticClient.search({
      index: 'produce',
      body: {
        query: {
          multi_match: {
            query,
            fields: ['farmerName', 'cropType', 'origin', 'qualityGrade']
          }
        }
      }
    });

    const results = result.hits.hits.map(hit => ({ id: hit._id, ...hit._source }));
    return res.json({ results });
  } catch (err) {
    console.error('Elasticsearch search error:', err.message);
    return res.status(502).json({ message: 'Search failed' });
  }
});

module.exports = router;