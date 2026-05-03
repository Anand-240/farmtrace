import axios from 'axios';

const getBaseURL = () => {
  // 1. Priority: Environment Variable
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // 2. Localhost Development
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (['localhost', '127.0.0.1'].includes(hostname)) {
      return 'http://localhost:4000/api/v1';
    }
  }

  // 3. Default Production Path
  return '/api/v1';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Robust URL normalization to prevent double prefixing like "api/api/v1"
  let url = config.url || '';
  
  // If the URL already starts with http, don't touch it
  if (url.startsWith('http')) {
    return config;
  }

  // Strip leading slash to let axios combine it cleanly with baseURL
  if (url.startsWith('/')) {
    url = url.substring(1);
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
