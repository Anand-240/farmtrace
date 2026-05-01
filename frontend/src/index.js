import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/theme.css';
import { initSentry } from './lib/sentry';
import { initPostHog } from './lib/posthog';

// Initialise monitoring BEFORE rendering (order matters for Sentry)
initSentry();
initPostHog();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(() => {}) // registered silently
      .catch(() => {});
  });
}
