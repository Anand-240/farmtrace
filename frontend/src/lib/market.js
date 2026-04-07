import api from './api';

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

export const normalizeText = (value = '') => String(value)
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

export const getCommodityCandidates = (cropType = '') => {
  const normalized = normalizeText(cropType);
  const aliases = [];

  Object.entries(CROP_COMMODITY_ALIASES).forEach(([key, value]) => {
    if (normalized.includes(key)) {
      aliases.push(...value);
    }
  });

  aliases.push(cropType);
  aliases.push(normalized);

  return [...new Set(aliases.map((item) => String(item || '').trim()).filter(Boolean))];
};

export const extractStateFromOrigin = (origin = '') => {
  const parts = String(origin).split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return '';
  return parts[parts.length - 1];
};

export const getMandiFloorForProduce = async (produce) => {
  if (!produce?.cropType) {
    return { mandiPrice: null, floorPrice: null, commodity: null, state: '', record: null };
  }

  const state = extractStateFromOrigin(produce.origin);
  const commodityCandidates = getCommodityCandidates(produce.cropType);

  for (const commodity of commodityCandidates) {
    const response = await api.get('/api/market/mandi', {
      params: { commodity, state, limit: 20 }
    });

    const records = Array.isArray(response.data?.records) ? response.data.records : [];
    const selectedRecord = response.data?.selectedRecord
      || records.find((record) => Number(record?.modal_price) > 0)
      || null;

    const mandiPrice = selectedRecord
      ? Number(response.data?.selectedPrice ?? selectedRecord.modal_price) / 100
      : null;

    if (mandiPrice || Number.isFinite(Number(response.data?.floorPrice))) {
      const floorPrice = Number(response.data?.floorPrice);
      return {
        mandiPrice,
        floorPrice: Number.isFinite(floorPrice) ? floorPrice : mandiPrice,
        floorSource: response.data?.floorSource || (mandiPrice ? 'MANDI' : null),
        floorLabel: response.data?.floorLabel || (mandiPrice ? `Current mandi rate ₹${mandiPrice.toFixed(2)}/kg` : null),
        mspPrice: Number.isFinite(Number(response.data?.mspPrice)) ? Number(response.data.mspPrice) : null,
        commodity: selectedRecord?.commodity || selectedRecord?.comm || commodity,
        state,
        record: selectedRecord
      };
    }
  }

  const floorResponse = await api.get('/api/market/floor', {
    params: { cropType: produce.cropType, origin: produce.origin }
  });

  return {
    mandiPrice: Number.isFinite(Number(floorResponse.data?.mandiPrice)) ? Number(floorResponse.data.mandiPrice) : null,
    floorPrice: Number.isFinite(Number(floorResponse.data?.floorPrice)) ? Number(floorResponse.data.floorPrice) : null,
    floorSource: floorResponse.data?.floorSource || null,
    floorLabel: floorResponse.data?.floorLabel || null,
    mspPrice: Number.isFinite(Number(floorResponse.data?.mspPrice)) ? Number(floorResponse.data.mspPrice) : null,
    commodity: floorResponse.data?.commodity || null,
    state,
    record: floorResponse.data?.record || null
  };
};