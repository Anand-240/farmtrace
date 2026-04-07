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
  rice: ['paddy', 'rice', 'chawal', 'dhaan', 'dhan']
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
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error('MSP_PRICE_TABLE parse error:', err.message);
    return {};
  }
};

const getMspPriceForCrop = (cropType = '') => {
  const table = parseMspTable();
  const normalized = normalizeText(cropType);

  for (const [key, value] of Object.entries(table)) {
    if (normalized.includes(normalizeText(key))) {
      const price = Number(value);
      if (Number.isFinite(price) && price > 0) {
        return price;
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

  return {
    records: Array.isArray(payload?.records) ? payload.records : [],
    source: 'data.gov.in'
  };
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
    if (mandiHit) {
      break;
    }
  }

  const mandiPrice = mandiHit?.price || null;
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
  validateSellPrice
};