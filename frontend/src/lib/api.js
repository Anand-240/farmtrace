import axios from 'axios';

const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (['localhost', '127.0.0.1'].includes(hostname)) {
      return 'http://localhost:4000/api/v1';
    }
  }
  // Force absolute path for deployment
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

  let url = config.url || '';
  
  // Strip duplicate prefix
  if (url.startsWith('/api/v1/')) {
    url = url.substring(7);
  } else if (url.startsWith('/api/v1')) {
    url = url.substring(7);
  }

  // Ensure absolute
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
