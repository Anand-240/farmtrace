const express = require('express');
const router = express.Router();
const auth = require('../../middleware/authMiddleware');

const GOVT_SCHEMES = [
  {
    id: 'pm-kisan',
    name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    benefit: '₹6,000/year direct income support (3 instalments of ₹2,000)',
    eligibility: ['FARMER'],
    criteria: { landRequired: true, maxLandHolding: null, minLandHolding: 0, roles: ['FARMER'] },
    applicationProcess: 'Apply at nearest CSC or PM-KISAN portal',
    documents: ['Aadhaar Card', 'Land Records (Khatoni)', 'Bank Account Details'],
    deadline: 'Rolling',
    portalUrl: 'https://pmkisan.gov.in',
    category: 'INCOME_SUPPORT',
    isActive: true
  },
  {
    id: 'pmfby',
    name: 'PMFBY (Pradhan Mantri Fasal Bima Yojana)',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    benefit: 'Crop insurance against natural calamities, pests & diseases',
    eligibility: ['FARMER'],
    criteria: { roles: ['FARMER'], landRequired: true },
    applicationProcess: 'Apply through banks or CSC before sowing season',
    documents: ['Aadhaar Card', 'Land Records', 'Bank Account', 'Sowing Certificate'],
    deadline: 'Before crop sowing',
    portalUrl: 'https://pmfby.gov.in',
    category: 'INSURANCE',
    isActive: true
  },
  {
    id: 'kcc',
    name: 'Kisan Credit Card (KCC)',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    benefit: 'Revolving credit up to ₹3 lakh at 4% interest rate',
    eligibility: ['FARMER'],
    criteria: { roles: ['FARMER'], landRequired: true },
    applicationProcess: 'Apply at nearest bank branch (nationalized/cooperative)',
    documents: ['Aadhaar', 'Land Records', 'Photograph', 'Identity Proof'],
    deadline: 'Rolling',
    portalUrl: null,
    category: 'CREDIT',
    isActive: true
  },
  {
    id: 'pm-fasal',
    name: 'PM-FASAL (Agri Infrastructure Fund)',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    benefit: 'Loans for post-harvest infra: cold chains, warehouses, sorting units (3% interest subvention)',
    eligibility: ['FARMER', 'DISTRIBUTOR'],
    criteria: { roles: ['FARMER', 'DISTRIBUTOR'] },
    applicationProcess: 'Apply on AIF portal or through Primary Agricultural Credit Societies',
    documents: ['Aadhaar', 'Business Plan', 'Land Records', 'Bank Account'],
    deadline: 'Rolling',
    portalUrl: 'https://agriinfra.dac.gov.in',
    category: 'INFRASTRUCTURE',
    isActive: true
  },
  {
    id: 'e-nam',
    name: 'eNAM Integration (National Agriculture Market)',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    benefit: 'Access to national e-trading platform for better price discovery',
    eligibility: ['FARMER', 'DISTRIBUTOR'],
    criteria: { roles: ['FARMER', 'DISTRIBUTOR'] },
    applicationProcess: 'Register at eNAM portal through APMC mandi',
    documents: ['Aadhaar', 'Bank Account', 'APMC License (for traders)'],
    deadline: 'Rolling',
    portalUrl: 'https://enam.gov.in',
    category: 'MARKET_ACCESS',
    isActive: true
  },
  {
    id: 'nmsa',
    name: 'NMSA (National Mission for Sustainable Agriculture)',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    benefit: 'Support for soil health management, micro-irrigation, rainfed farming',
    eligibility: ['FARMER'],
    criteria: { roles: ['FARMER'] },
    applicationProcess: 'Apply through District Agriculture Office',
    documents: ['Aadhaar', 'Land Records', 'Farmer Registration Certificate'],
    deadline: 'Annual (State-specific)',
    portalUrl: null,
    category: 'SUSTAINABLE_FARMING',
    isActive: true
  },
  {
    id: 'atma',
    name: 'ATMA (Agricultural Technology Management Agency)',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    benefit: 'Farm extension services, training, demonstrations & exposure visits',
    eligibility: ['FARMER'],
    criteria: { roles: ['FARMER'] },
    applicationProcess: 'Contact Block Technology Team in your district',
    documents: ['Aadhaar', 'Farmer ID'],
    deadline: 'Rolling',
    portalUrl: null,
    category: 'TRAINING',
    isActive: true
  },
  {
    id: 'wdra',
    name: 'WDRA Negotiable Warehouse Receipt',
    ministry: 'Warehousing Development and Regulatory Authority',
    benefit: 'Use stored produce as collateral for bank loans (up to 75% of produce value)',
    eligibility: ['FARMER', 'DISTRIBUTOR'],
    criteria: { roles: ['FARMER', 'DISTRIBUTOR'] },
    applicationProcess: 'Store produce in WDRA-registered warehouses',
    documents: ['Aadhaar', 'Produce Quality Certificate', 'Warehouse Receipt'],
    deadline: 'Rolling',
    portalUrl: 'https://wdra.gov.in',
    category: 'CREDIT',
    isActive: true
  }
];

router.get('/', auth, async (req, res) => {
  const { category, role } = req.query;
  let schemes = GOVT_SCHEMES.filter(s => s.isActive);
  if (category) schemes = schemes.filter(s => s.category === category);
  if (role) schemes = schemes.filter(s => s.eligibility.includes(role.toUpperCase()));
  return res.json({ schemes, total: schemes.length });
});

router.get('/eligible', auth, async (req, res) => {
  const userRole = req.user.role || 'FARMER';
  const eligible = GOVT_SCHEMES.filter(s => s.isActive && s.eligibility.includes(userRole));
  return res.json({ schemes: eligible, total: eligible.length, userRole });
});

router.get('/:id', auth, async (req, res) => {
  const scheme = GOVT_SCHEMES.find(s => s.id === req.params.id);
  if (!scheme) return res.status(404).json({ message: 'Scheme not found' });
  return res.json({ scheme });
});

module.exports = router;
