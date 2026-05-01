'use strict';

/**
 * FarmTrace SMS Utility — MSG91
 *
 * Falls back to a no-op if SMS_API_KEY is not set,
 * so dev/test environments never throw.
 *
 * ENV vars required:
 *   SMS_API_KEY   — MSG91 Auth Key
 *   SMS_SENDER_ID — 6-char sender ID (default: FARMTC)
 *   SMS_TEMPLATE_ID — MSG91 DLT-approved template ID (required for India)
 */

const logger = require('./logger').child({ module: 'sms' });

const MSG91_API = 'https://api.msg91.com/api/v5/flow/';

/**
 * Send an SMS via MSG91 Flow API.
 * @param {string} phone  - Recipient phone in E.164 format, e.g. "919876543210"
 * @param {string} message - Plain text message (≤160 chars for single SMS)
 * @param {Record<string,string>} [variables] - Template variable substitutions
 */
async function sendSms(phone, message, variables = {}) {
  if (!process.env.SMS_API_KEY) {
    logger.warn({ phone }, 'SMS_API_KEY not set — skipping SMS');
    return { success: false, skipped: true };
  }

  // Normalise phone: strip + and spaces, ensure country code present
  const normalised = String(phone).replace(/\D/g, '');

  try {
    const payload = {
      template_id: process.env.SMS_TEMPLATE_ID || '',
      sender: process.env.SMS_SENDER_ID || 'FARMTC',
      short_url: '0',
      mobiles: normalised,
      // Inject each variable as a top-level key for MSG91 flow templates
      ...variables,
      // Fallback: plain body if no template
      message: variables.message || message,
    };

    // Use built-in fetch (Node 18+) — no extra dependency
    const res = await fetch(MSG91_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: process.env.SMS_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.type === 'error') {
      logger.error({ phone: normalised, status: res.status, data }, 'SMS send failed');
      return { success: false, error: data };
    }

    logger.info({ phone: normalised, requestId: data.request_id }, 'SMS sent');
    return { success: true, data };
  } catch (err) {
    logger.error({ err, phone: normalised }, 'SMS network error');
    return { success: false, error: err.message };
  }
}

/**
 * Pre-built SMS message helpers for FarmTrace order events.
 */
const smsTemplates = {
  bookingReceived: (farmerName, cropType, amount) =>
    `FarmTrace: ${farmerName}, aapko ${cropType} ke liye Rs.${amount} booking payment mili. Dispatch ke baad aur milega.`,

  dispatchInitiated: (cropType, driverName, vehicleNumber) =>
    `FarmTrace: ${cropType} dispatch ho gaya. Driver: ${driverName}, Vehicle: ${vehicleNumber}. Track your delivery on FarmTrace.`,

  deliveryConfirmed: (cropType, finalAmount) =>
    `FarmTrace: ${cropType} deliver ho gaya! Final payment Rs.${finalAmount} release ho gayi. Shukriya FarmTrace use karne ke liye.`,

  transferRequestReceived: (fromName, cropType, pricePerKg) =>
    `FarmTrace: ${fromName} ne ${cropType} ke liye transfer request bheji - Rs.${pricePerKg}/kg. App par dekho.`,
};

module.exports = { sendSms, smsTemplates };
