import axios from 'axios';

const configuredBaseUrl = process.env.REACT_APP_API_URL?.trim();
const isLocalhost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

const api = axios.create({
  baseURL: configuredBaseUrl || (isLocalhost ? 'http://localhost:4000' : '')
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
