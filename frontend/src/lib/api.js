import axios from 'axios';

// Get API URL from environment or use production default
const getBaseURL = () => {
  const configuredBaseUrl = process.env.REACT_APP_API_URL?.trim();
  
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  // Check if localhost
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (['localhost', '127.0.0.1'].includes(hostname)) {
      return 'http://localhost:4000';
    }
  }

  // Default to production backend
  return 'https://farmtrace-backend-6xzw.onrender.com';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  withCredentials: true
});

// Log API URL in development
if (process.env.NODE_ENV === 'development') {
  console.log('API Base URL:', api.defaults.baseURL);
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response error interceptor for debugging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default api;
