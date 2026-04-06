const express = require('express');

const router = express.Router();

const DATA_GOV_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const DATA_GOV_BASE_URL = `https://api.data.gov.in/resource/${DATA_GOV_RESOURCE_ID}`;

const parseLimit = (rawLimit) => {
  const limit = Number(rawLimit);
  if (Number.isNaN(limit) || limit <= 0) return 5;
  return Math.min(limit, 20);
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

router.get('/mandi', async (req, res) => {
  try {
    const apiKey = process.env.DATA_GOV_API_KEY || process.env.REACT_APP_DATA_GOV_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ message: 'DATA_GOV_API_KEY configure nahi hai' });
    }

    const state = String(req.query.state || '').trim();
    const commodity = String(req.query.commodity || '').trim();
    const limit = parseLimit(req.query.limit);

    let response = await fetch(buildDataGovUrl({ apiKey, state, commodity, limit }));
    let payload = await response.json();

    if ((!payload?.records || payload.records.length === 0) && state) {
      response = await fetch(buildDataGovUrl({ apiKey, commodity, limit }));
      payload = await response.json();
    }

    return res.json({
      records: Array.isArray(payload?.records) ? payload.records : [],
      source: 'data.gov.in'
    });
  } catch (err) {
    console.error('Mandi API proxy error:', err.message);
    return res.status(502).json({ message: 'Mandi rates fetch nahi ho paya' });
  }
});

module.exports = router;