import axios from 'axios';

const getRuntimeConfig = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  return window.__FARMTRACE_CONFIG__ || {};
};

const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (['localhost', '127.0.0.1'].includes(hostname)) {
      return 'http://localhost:4000';
    }
  }

  const runtimeConfig = getRuntimeConfig();
  const runtimeBaseUrl = runtimeConfig.REACT_APP_API_URL?.trim();
  if (runtimeBaseUrl) {
    return runtimeBaseUrl;
  }

  const configuredBaseUrl = process.env.REACT_APP_API_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  return '/api/v1';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000
});

if (process.env.NODE_ENV === 'development') {
  console.log('API Base URL:', api.defaults.baseURL);
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Ensure config.url is a string
  let url = config.url || '';

  // If the URL already contains the baseURL prefix, strip it to avoid duplication by axios
  const base = (config.baseURL || '').replace(/\/+$/, '');
  if (base && url.startsWith(base)) {
    url = url.substring(base.length);
  }

  // Ensure the URL starts with / if it's not an absolute URL
  if (url && !url.startsWith('http') && !url.startsWith('/')) {
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
