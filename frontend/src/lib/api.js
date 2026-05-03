import axios from 'axios';

const getBaseURL = () => {
  // 1. Check runtime config (useful for Docker/Vercel)
  const runtimeConfig = typeof window !== 'undefined' ? window.__FARMTRACE_CONFIG__ : null;
  let url = runtimeConfig?.REACT_APP_API_URL || process.env.REACT_APP_API_URL || '';

  // 2. Handle Localhost / Development overrides
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocal = ['localhost', '127.0.0.1'].includes(hostname) || hostname.startsWith('192.168.');
    
    // If we're on localhost but the URL is relative or pointing to production/wrong port
    if (isLocal && (!url || url.startsWith('/') || !url.includes(':4000'))) {
      url = `http://${hostname}:4000/api/v1`;
    }
  }

  // 3. Absolute Fallback: if no URL, assume same origin with v1
  if (!url) {
    url = '/api/v1';
  }

  // 4. Normalization: ensure /api/v1 is present exactly once
  if (url.startsWith('http')) {
    if (!url.includes('/api/v1')) {
      if (url.endsWith('/')) url = url.slice(0, -1);
      if (url.endsWith('/api')) {
        url = url + '/v1';
      } else {
        url = url + '/api/v1';
      }
    }
  } else {
    // Relative URL case
    if (url === '/api' || url === 'api') {
      url = '/api/v1';
    } else if (!url.startsWith('/api/v1') && !url.startsWith('api/v1')) {
       // Only prepend if it doesn't already have it
       if (url === '/' || !url) url = '/api/v1';
    }
  }

  return url;
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 20000
});

console.log('🚀 API Client Initialized | BaseURL:', api.defaults.baseURL);

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // URL normalization to prevent double prefixing (like api/v1/api/v1)
  let url = config.url || '';
  
  if (url.startsWith('http')) {
    return config;
  }

  // URL normalization to prevent double prefixing (like /api/v1/v1 or /api/v1/api/v1)
  if (url.startsWith('/api/v1')) {
    url = url.substring(7);
  } else if (url.startsWith('api/v1')) {
    url = url.substring(6);
  } else if (url.startsWith('/v1')) {
    url = url.substring(3);
  } else if (url.startsWith('v1')) {
    url = url.substring(2);
  }

  // Ensure it starts with a clean slash for axios to append to baseURL
  if (!url.startsWith('/')) {
    url = '/' + url;
  }

  config.url = url;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
