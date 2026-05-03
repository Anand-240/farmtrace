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
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let registration of registrations) {
      registration.unregister();
      console.log('Service Worker Unregistered');
    }
  });
}
