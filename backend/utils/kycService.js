const crypto = require('crypto');

// ── Format Validators ─────────────────────────────────────────────────────────
const VALIDATORS = {
  AADHAAR: {
    regex: /^[2-9][0-9]{11}$/,
    cleanInput: (v) => v.replace(/[\s-]/g, ''),
    message: 'Aadhaar 12 digits ka hona chahiye aur 2-9 se start hona chahiye'
  },
  PAN: {
    regex: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
    cleanInput: (v) => v.replace(/\s/g, '').toUpperCase(),
    message: 'PAN format galat hai (example: ABCDE1234F)'
  },
  ESHRAM: {
    // eShram UAN: XX-XXXXXXXXXXX-X (14 chars with dashes) or 12 digits
    regex: /^[0-9]{12}$/,
    cleanInput: (v) => v.replace(/[-\s]/g, ''),
    message: 'eShram UAN 12 digits ka hona chahiye'
  }
};

function validateFormat(documentType, rawNumber) {
  const validator = VALIDATORS[documentType];
  if (!validator) return { valid: false, message: 'Invalid document type' };

  const cleaned = validator.cleanInput(rawNumber || '');
  if (!validator.regex.test(cleaned)) {
    return { valid: false, message: validator.message };
  }
  return { valid: true, cleaned };
}

// ── Masking ───────────────────────────────────────────────────────────────────
function maskDocumentNumber(documentType, cleaned) {
  if (documentType === 'AADHAAR') {
    return `XXXX-XXXX-${cleaned.slice(-4)}`;
  }
  if (documentType === 'PAN') {
    return `${cleaned.slice(0, 2)}XXX${cleaned.slice(5, 9)}${cleaned.slice(-1)}`;
  }
  if (documentType === 'ESHRAM') {
    return `XXXX-XXXX-${cleaned.slice(-4)}`;
  }
  return '****';
}

// ── Hashing (for privacy — never store raw doc numbers) ──────────────────────
function hashDocumentNumber(cleaned) {
  return crypto.createHash('sha256').update(cleaned).digest('hex');
}

// ── Auto-verification via Surepass.io (optional — plug your API key) ─────────
// Docs: https://surepass.io/pan-api-documentation/
//       https://surepass.io/aadhaar-api-documentation/
//       https://surepass.io/e-shram-api-documentation/
const SUREPASS_BASE = 'https://kyc-api.surepass.io/api/v1';

async function verifyViaSurepass(documentType, cleaned, nameAsPerDoc) {
  const token = process.env.SUREPASS_API_TOKEN;
  if (!token) return null; // No API key — fall back to manual review

  const endpointMap = {
    PAN: '/pan',
    ESHRAM: '/e-shram',
    AADHAAR: '/aadhaar-validation' // offline name-match, no OTP required
  };

  const endpoint = endpointMap[documentType];
  if (!endpoint) return null;

  try {
    const body = { id_number: cleaned };
    if (documentType === 'AADHAAR' && nameAsPerDoc) {
      body.name = nameAsPerDoc;
    }

    const res = await fetch(`${SUREPASS_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    return {
      verified: data.success === true,
      nameMatch: data.data?.name_match ?? null,
      apiData: data
    };
  } catch (err) {
    return { verified: false, error: err.message };
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────
async function processKycDocument({ documentType, rawNumber, nameAsPerDoc }) {
  const validation = validateFormat(documentType, rawNumber);
  if (!validation.valid) {
    return { success: false, message: validation.message };
  }

  const { cleaned } = validation;
  const masked = maskDocumentNumber(documentType, cleaned);
  const hashed = hashDocumentNumber(cleaned);

  // Try auto-verification if Surepass API is configured
  const surepassResult = await verifyViaSurepass(documentType, cleaned, nameAsPerDoc);

  let autoVerified = false;
  let verificationResponse = null;

  if (surepassResult) {
    autoVerified = surepassResult.verified === true;
    verificationResponse = surepassResult.apiData || null;
  }

  return {
    success: true,
    cleaned,
    masked,
    hashed,
    autoVerified,
    verificationResponse,
    // If auto-verified → VERIFIED, else → SUBMITTED (manual review)
    kycStatus: autoVerified ? 'VERIFIED' : 'SUBMITTED'
  };
}

module.exports = { validateFormat, maskDocumentNumber, hashDocumentNumber, processKycDocument };
