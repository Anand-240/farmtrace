import axios from 'axios';

const getBaseURL = () => {
  let url = process.env.REACT_APP_API_URL || '';

  // 1. If no environment variable, use defaults
  if (!url && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (['localhost', '127.0.0.1'].includes(hostname)) {
      url = 'http://localhost:4000/api/v1';
    } else {
      // For Vercel production, use relative /api/v1 which matches vercel.json rewrites
      url = '/api/v1';
    }
  }

  // 2. Safety Check: If the URL is provided but missing /api/v1, append it
  // This handles cases where REACT_APP_API_URL is set to just the domain
  if (url && url.startsWith('http') && !url.includes('/api/v1')) {
    // Strip trailing slash
    if (url.endsWith('/')) url = url.slice(0, -1);
    
    if (url.endsWith('/api')) {
      url = url + '/v1';
    } else {
      url = url + '/api/v1';
    }
  }

  return url;
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

  // URL normalization to prevent double prefixing (like api/v1/api/v1)
  let url = config.url || '';
  
  if (url.startsWith('http')) {
    return config;
  }

  // If the request already includes /api/v1, remove it because baseURL has it
  if (url.startsWith('/api/v1')) {
    url = url.substring(7);
  } else if (url.startsWith('api/v1')) {
    url = url.substring(6);
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
