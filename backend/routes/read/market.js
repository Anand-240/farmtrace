const express = require('express');

const router = express.Router();
const { fetchMandiRecords, getSellPriceFloor, pickBestMandiRecord, getMspPriceForCrop, getStatePriceMap, normalizeText } = require('../../utils/marketPricing');
const { getRoute, getRouteByCoords, CITY_COORDS } = require('../../utils/routingService');
const { calculateTransportCost, getCurrentFuelPrices } = require('../../utils/fuelPricing');
const logger = require('../../utils/logger').child({ module: 'market' });
const Produce = require('../../models/Produce');

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
    logger.error({ err }, 'Mandi API proxy error');
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
    logger.error({ err }, 'Market floor error');
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
    logger.error({ err }, 'Commodities fetch error');
    return res.status(502).json({ message: 'Available commodities fetch nahi ho payin' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;
    
    const from = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const size = parseInt(limit);

    const filter = {};
    if (query) {
      const regex = new RegExp(String(query), 'i');
      filter.$or = [
        { farmerName: regex },
        { cropType: regex },
        { origin: regex },
        { qualityGrade: regex }
      ];
    }

    const total = await Produce.countDocuments(filter);
    const results = await Produce.find(filter)
      .sort({ createdAt: -1 })
      .skip(from)
      .limit(size);

    return res.json({ 
      results: results.map(r => ({ id: r._id, ...r.toObject() })), 
      total, 
      page: parseInt(page), 
      limit: size 
    });
  } catch (err) {
    logger.error({ err }, 'MongoDB search error');
    return res.status(500).json({ message: 'Search failed' });
  }
});

// Route cost: shortest path + fuel cost between two cities
// GET /api/v1/market/route-cost?from=pune&to=mumbai&vehicleType=Mini+Truck
router.get('/route-cost', async (req, res) => {
  try {
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const vehicleType = String(req.query.vehicleType || 'Mini Truck').trim();

    if (!from || !to) {
      return res.status(400).json({ message: 'from aur to city required hai' });
    }

    if (from.toLowerCase() === to.toLowerCase()) {
      return res.status(400).json({ message: 'Dono same location hai. Alag areas enter karein.' });
    }

    const fromLat = parseFloat(req.query.fromLat);
    const fromLng = parseFloat(req.query.fromLng);
    const toLat   = parseFloat(req.query.toLat);
    const toLng   = parseFloat(req.query.toLng);

    let routeResult;
    if (!isNaN(fromLat) && !isNaN(fromLng) && !isNaN(toLat) && !isNaN(toLng)) {
      routeResult = await getRouteByCoords(from, { lat: fromLat, lng: fromLng }, to, { lat: toLat, lng: toLng });
    } else {
      routeResult = await getRoute(from, to);
    }

    if (routeResult.error) {
      return res.status(404).json({
        message: routeResult.error,
        availableCities: Object.keys(CITY_COORDS)
      });
    }

    if (routeResult.distanceKm < 0.5) {
      return res.status(400).json({ message: 'Dono locations ek hi jagah ke paas hain. Alag areas enter karein.' });
    }

    const fuelResult = calculateTransportCost(routeResult.distanceKm, vehicleType);
    const fuelPrices = getCurrentFuelPrices();

    return res.json({
      from: { name: routeResult.from.name, coords: routeResult.from.coords },
      to: { name: routeResult.to.name, coords: routeResult.to.coords },
      route: {
        distanceKm: routeResult.distanceKm,
        durationMin: routeResult.durationMin,
        durationHours: `${Math.floor(routeResult.durationMin / 60)}h ${routeResult.durationMin % 60}m`,
        geometry: routeResult.geometry,
        source: routeResult.source
      },
      transport: fuelResult,
      fuelPrices
    });
  } catch (err) {
    logger.error({ err }, 'route-cost error');
    return res.status(500).json({ message: 'Route calculate nahi ho paya: ' + err.message });
  }
});

// List available cities for autocomplete
router.get('/cities', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const cities = Object.keys(CITY_COORDS);
  const filtered = q ? cities.filter(c => c.startsWith(q)) : cities;
  return res.json(filtered.map(c => ({
    name: c.charAt(0).toUpperCase() + c.slice(1),
    coords: CITY_COORDS[c]
  })));
});

module.exports = router;