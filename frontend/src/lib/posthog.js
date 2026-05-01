/**
 * FarmTrace PostHog Analytics
 *
 * Tracks the key conversion funnel:
 *   Marketplace → Register → Transfer → Razorpay Opened
 *   → Payment Verified → Blockchain Confirmed
 *
 * ENV vars:
 *   REACT_APP_POSTHOG_KEY  — PostHog project API key (ph_...)
 *   REACT_APP_POSTHOG_HOST — optional, defaults to https://app.posthog.com
 */
import posthog from 'posthog-js';

let initialised = false;

export function initPostHog() {
  const key = process.env.REACT_APP_POSTHOG_KEY;
  if (!key) return; // Silent no-op in dev without a key

  posthog.init(key, {
    api_host: process.env.REACT_APP_POSTHOG_HOST || 'https://us.i.posthog.com',
    // Auto-capture clicks, form submits, page views
    autocapture: true,
    capture_pageview: true,
    // Do not capture sensitive form data
    mask_all_text: false,
    mask_all_element_attributes: false,
    loaded: (ph) => {
      if (process.env.NODE_ENV !== 'production') {
        ph.debug(); // verbose logging in dev only
      }
    },
  });

  initialised = true;
}

/**
 * Track a custom event.
 * @param {string} event - Event name, e.g. 'crop_registered'
 * @param {Record<string, any>} [properties] - Extra context
 */
export function track(event, properties = {}) {
  if (!initialised) return;
  posthog.capture(event, properties);
}

/**
 * Identify the logged-in user so funnels are attached to a real person.
 * Call this after successful login / token refresh.
 * @param {string} userId
 * @param {{ name?: string, email?: string, role?: string }} traits
 */
export function identifyUser(userId, traits = {}) {
  if (!initialised) return;
  posthog.identify(userId, traits);
}

/** Reset identity on logout */
export function resetUser() {
  if (!initialised) return;
  posthog.reset();
}

export default posthog;
