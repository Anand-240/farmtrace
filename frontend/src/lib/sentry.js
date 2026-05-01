/**
 * FarmTrace Sentry Initialization — Frontend
 *
 * Call initSentry() once before ReactDOM.render.
 *
 * ENV vars (set in .env / Vercel):
 *   REACT_APP_SENTRY_DSN  — project DSN from sentry.io
 *   REACT_APP_SENTRY_ENV  — e.g. "production" / "staging"
 */
import * as Sentry from '@sentry/react';

export function initSentry() {
  // Skip if no DSN is configured (dev with no Sentry project set up)
  if (!process.env.REACT_APP_SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: process.env.REACT_APP_SENTRY_ENV || process.env.NODE_ENV || 'development',

    // Performance tracing — 10% sample in prod to keep quota
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session replay — capture 10% of sessions, 100% on error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Never capture passwords / card numbers in replays
        maskAllInputs: true,
        blockAllMedia: false,
      }),
    ],

    // Ignore browser extension noise
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      /^chrome-extension:\/\//,
    ],
  });
}

/**
 * Higher-order component that wraps the root App with an ErrorBoundary.
 * Re-export Sentry's withProfiler for optional profiling.
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;
export const withSentryProfiler = Sentry.withProfiler;
