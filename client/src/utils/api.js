import axios from 'axios';

// In production (Vercel), VITE_API_URL points to the Railway backend.
// In dev, falls back to the local proxy (/api → localhost:3001/api via Vite config).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('purecode_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('purecode_token');
      localStorage.removeItem('purecode_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
