/**
 * Normalizes phone numbers to E.164 format (+91...)
 * If 10 digits are provided, prepends +91.
 * If 12 digits starting with 91 are provided, prepends +.
 */
function normalizePhone(phone) {
  if (!phone) return phone;
  
  // Remove all non-numeric characters
  let cleaned = String(phone).replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return '+91' + cleaned;
  }
  
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return '+' + cleaned;
  }
  
  // Already has +
  if (String(phone).startsWith('+')) {
    return phone;
  }

  return phone;
}

module.exports = { normalizePhone };
