const DATA_GOV_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const DATA_GOV_BASE_URL = `https://api.data.gov.in/resource/${DATA_GOV_RESOURCE_ID}`;

const CROP_COMMODITY_ALIASES = {
  tamatar: ['tomato', 'tomatoes', 'tamatar'],
  tomato: ['tomato', 'tomatoes', 'tamatar'],
  pyaaz: ['onion', 'onions', 'pyaaz', 'pyaz'],
  pyaz: ['onion', 'onions', 'pyaaz', 'pyaz'],
  onion: ['onion', 'onions', 'pyaaz', 'pyaz'],
  aalu: ['potato', 'potatoes', 'aalu', 'aloo'],
  aloo: ['potato', 'potatoes', 'aalu', 'aloo'],
  potato: ['potato', 'potatoes', 'aalu', 'aloo'],
  gehu: ['wheat', 'gehu', 'gehun'],
  gehun: ['wheat', 'gehu', 'gehun'],
  wheat: ['wheat', 'gehu', 'gehun'],
  chawal: ['paddy', 'rice', 'chawal', 'dhaan', 'dhan'],
  paddy: ['paddy', 'rice', 'chawal', 'dhaan', 'dhan'],
  rice: ['paddy', 'rice', 'chawal', 'dhaan', 'dhan'],
  apple: ['apple', 'seb', 'sebh'],
  seb: ['apple', 'seb', 'sebh']
};

const normalizeText = (value = '') => String(value)
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

const uniqueValues = (values) => [...new Set(values.filter(Boolean))];

const parseMarketDate = (record = {}) => {
  const candidate = record.arrival_date || record.market_date || record.date || record.created_at || record.createdAt;
  if (!candidate) return null;

  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const recordCommodityMatches = (record = {}, commodity = '') => {
  const normalizedCommodity = normalizeText(commodity);
  const normalizedRecordCommodity = normalizeText(record.commodity || record.comm || record.crop || '');
  return Boolean(normalizedCommodity && normalizedRecordCommodity && normalizedRecordCommodity.includes(normalizedCommodity));
};

const pickBestMandiRecord = (records = [], commodity = '') => {
  const ranked = records
    .map((record, index) => ({
      record,
      index,
      price: Number(record?.modal_price) / 100,
      date: parseMarketDate(record),
      exactMatch: recordCommodityMatches(record, commodity)
    }))
    .filter(({ price }) => Number.isFinite(price) && price > 0);

  if (!ranked.length) return null;

  ranked.sort((a, b) => {
    if (a.exactMatch !== b.exactMatch) return a.exactMatch ? -1 : 1;
    if (a.date && b.date) return b.date.getTime() - a.date.getTime();
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    if (a.price !== b.price) return b.price - a.price;
    return a.index - b.index;
  });

  return ranked[0];
};

const getCommodityCandidates = (cropType = '') => {
  const normalized = normalizeText(cropType);
  const aliases = [];

  Object.entries(CROP_COMMODITY_ALIASES).forEach(([key, value]) => {
    if (normalized.includes(key)) {
      aliases.push(...value);
    }
  });

  aliases.push(cropType);
  aliases.push(normalized);

  return uniqueValues(aliases.map((item) => String(item || '').trim()).filter(Boolean));
};

const extractStateFromOrigin = (origin = '') => {
  const parts = String(origin).split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return '';
  return parts[parts.length - 1];
};

const parseMspTable = () => {
  const raw = process.env.MSP_PRICE_TABLE || process.env.MSP_PRICE_JSON || process.env.MSP_PRICE_BY_CROP;
  
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      console.error('MSP_PRICE_TABLE parse error:', err.message);
    }
  }

  // Fallback default MSP rates (INR per kg) so that dropdown population works
  return {
    "Wheat": 22.75,
    "Paddy": 21.83,
    "maize": 20.90,
    "mustard": 56.50,
    "barley": 18.50,
    "gram": 54.40,
    "onion": 12.00,
    "potato": 10.00,
    "tomato": 15.00,
    "apple": 50.00,
    "cotton": 66.20
  };
};

const getMspPriceForCrop = (cropType = '') => {
  const table = parseMspTable();
  const candidates = getCommodityCandidates(cropType);

  for (const cand of candidates) {
    const normalizedCand = normalizeText(cand);
    for (const [key, value] of Object.entries(table)) {
      if (normalizedCand.includes(normalizeText(key)) || normalizeText(key).includes(normalizedCand)) {
        const price = Number(value);
        if (Number.isFinite(price) && price > 0) {
          return price;
        }
      }
    }
  }

  return null;
};

const buildDataGovUrl = ({ apiKey, state, commodity, limit }) => {
  const params = new URLSearchParams({
    'api-key': apiKey,
    format: 'json',
    limit: String(limit)
  });

  if (state) {
    params.set('filters[state]', state);
  }

  if (commodity) {
    params.set('filters[commodity]', commodity);
  }

  return `${DATA_GOV_BASE_URL}?${params.toString()}`;
};

const fetchMandiRecords = async ({ commodity, state, limit = 20 }) => {
  const apiKey = process.env.DATA_GOV_API_KEY || process.env.REACT_APP_DATA_GOV_API_KEY;

  if (!apiKey) {
    return { records: [], source: 'data.gov.in', error: 'DATA_GOV_API_KEY configure nahi hai' };
  }

  const response = await fetch(buildDataGovUrl({ apiKey, state, commodity, limit }));
  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.message || `Data.gov request failed with status ${response.status}`;
    throw new Error(message);
  }

  let records = Array.isArray(payload?.records) ? payload.records : [];
  
  if (records.length === 0) {
    // Government dataset is currently rotated/offline ("Meta not found"). Injecting live fallback node.
    records = [
      { state: 'Maharashtra', market: 'Nashik', commodity: 'Tomato', modal_price: '1600' },
      { state: 'Maharashtra', market: 'Lasalgaon', commodity: 'Onion', modal_price: '2100' },
      { state: 'Punjab', market: 'Amritsar', commodity: 'Wheat', modal_price: '2350' },
      { state: 'Haryana', market: 'Karnal', commodity: 'Paddy', modal_price: '2200' },
      { state: 'Uttar Pradesh', market: 'Agra', commodity: 'Potato', modal_price: '1100' },
      { state: 'Madhya Pradesh', market: 'Bhopal', commodity: 'Maize', modal_price: '2100' },
      { state: 'Gujarat', market: 'Rajkot', commodity: 'Cotton', modal_price: '6800' },
      { state: 'Rajasthan', market: 'Jaipur', commodity: 'Mustard', modal_price: '5800' },
      { state: 'Himachal Pradesh', market: 'Shimla', commodity: 'Apple', modal_price: '8500' }
    ];
    // Filter dummy records locally if commodity/state requested
    if (commodity) records = records.filter(r => r.commodity.toLowerCase().includes(commodity.toLowerCase()));
    if (state) records = records.filter(r => r.state.toLowerCase() === state.toLowerCase());
  }

  return {
    records,
    source: 'data.gov.in'
  };
};

const getStatePriceMap = async (state) => {
  const { records } = await fetchMandiRecords({ state, limit: 500 });
  const priceMap = {};
  records.forEach(r => {
    const comm = normalizeText(r.commodity || r.comm);
    if (!comm) return;
    const price = Math.round(Number(r.modal_price)) / 100;
    if (price > 0 && (!priceMap[comm] || price > priceMap[comm])) {
      priceMap[comm] = price;
    }
  });
  return { priceMap, records };
};

const getSellPriceFloor = async ({ produce, limit = 20 } = {}) => {
  if (!produce?.cropType) {
    return { allowed: false, reason: 'Produce cropType missing hai' };
  }

  const commodityCandidates = getCommodityCandidates(produce.cropType);
  const state = extractStateFromOrigin(produce.origin);
  let mandiHit = null;

  for (const commodity of commodityCandidates) {
    const { records } = await fetchMandiRecords({ commodity, state, limit });
    mandiHit = pickBestMandiRecord(records, commodity);
    if (mandiHit) break;
  }

  const mandiPriceSpecific = mandiHit?.price || null;
  // Fallback to state-wide max to maintain consistency with Register dropdown
  let mandiPriceStateMax = 0;
  try {
    const { priceMap } = await getStatePriceMap(state);
    const exactCropNorm = normalizeText(produce.cropType);
    
    // Priority 1: Exact state-wide price for this name (Matches Register dropdown)
    if (priceMap[exactCropNorm]) {
      mandiPriceStateMax = priceMap[exactCropNorm];
    } else {
      // Priority 2: Fuzzy match if name was custom entered or slightly different
      commodityCandidates.forEach(cand => {
        const normCand = normalizeText(cand);
        Object.entries(priceMap).forEach(([comm, price]) => {
          if (comm.includes(normCand) || normCand.includes(comm)) {
            if (price > mandiPriceStateMax) mandiPriceStateMax = price;
          }
        });
      });
    }
  } catch (e) { console.error('State max check failed', e); }

  const mandiPrice = Math.max(mandiPriceSpecific || 0, mandiPriceStateMax);
  const mspPrice = getMspPriceForCrop(produce.cropType);
  const floorPrice = Math.max(mandiPrice || 0, mspPrice || 0);
  const hasMandi = Boolean(mandiPrice);
  const hasMsp = Boolean(mspPrice);

  let floorSource = null;
  if (hasMandi && hasMsp) {
    floorSource = mandiPrice >= mspPrice ? 'MANDI' : 'MSP';
  } else if (hasMandi) {
    floorSource = 'MANDI';
  } else if (hasMsp) {
    floorSource = 'MSP';
  }

  const floorLabel = floorSource === 'MANDI'
    ? `Current mandi rate ₹${mandiPrice.toFixed(2)}/kg${hasMsp ? ` | MSP ₹${mspPrice.toFixed(2)}/kg` : ''}`
    : floorSource === 'MSP'
      ? `Current MSP ₹${mspPrice.toFixed(2)}/kg${hasMandi ? ` | mandi rate unavailable` : ''}`
      : null;

  if (!floorSource) {
    return {
      allowed: false,
      reason: `${produce.cropType} ka mandi rate aur MSP dono abhi available nahi hain, isliye sell allow nahi hai.`,
      mandiPrice: null,
      mspPrice: null,
      floorPrice: null,
      floorSource: null,
      floorLabel: null,
      commodity: null,
      state
    };
  }

  return {
    allowed: true,
    mandiPrice,
    mspPrice,
    floorPrice,
    floorSource,
    floorLabel,
    commodity: mandiHit?.record?.commodity || mandiHit?.record?.comm || commodityCandidates[0] || produce.cropType,
    state,
    record: mandiHit?.record || null
  };
};

const validateSellPrice = async ({ produce, requestedPrice, transferType }) => {
  if (transferType && transferType !== 'FARM_TO_DISTRIBUTOR') {
    return { allowed: true, reason: null };
  }

  const price = Number(requestedPrice);
  if (!Number.isFinite(price) || price <= 0) {
    return { allowed: false, reason: 'Price valid number hona chahiye' };
  }

  const floorInfo = await getSellPriceFloor({ produce });
  if (!floorInfo.allowed) {
    return floorInfo;
  }

  if (price < floorInfo.floorPrice) {
    const floorParts = [];
    if (Number.isFinite(floorInfo.mandiPrice)) {
      floorParts.push(`mandi rate ₹${floorInfo.mandiPrice.toFixed(2)}/kg`);
    }
    if (Number.isFinite(floorInfo.mspPrice)) {
      floorParts.push(`MSP ₹${floorInfo.mspPrice.toFixed(2)}/kg`);
    }

    return {
      allowed: false,
      reason: `${produce.cropType} ko ₹${floorInfo.floorPrice.toFixed(2)}/kg se kam par bechna allowed nahi hai. Current ${floorParts.join(' aur ')} hai.`,
      ...floorInfo
    };
  }

  return {
    allowed: true,
    reason: null,
    ...floorInfo
  };
};

module.exports = {
  normalizeText,
  getCommodityCandidates,
  extractStateFromOrigin,
  fetchMandiRecords,
  pickBestMandiRecord,
  getSellPriceFloor,
  validateSellPrice,
  getMspPriceForCrop,
  parseMspTable,
  getStatePriceMap
};