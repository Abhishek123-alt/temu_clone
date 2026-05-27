import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log('🚀 API Request:', config.method.toUpperCase(), config.url, config.data);
  return config;
});

api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.status, response.config.url, response.data);
    return response;
  },
  (error) => {
    console.error('❌ API Error:', error.response?.status, error.config?.url, error.response?.data);

    // Automatically log out if a token expires on an authenticated request.
    // Skip /auth/login and /auth/register — those endpoints return 401 to signal
    // bad credentials, and the caller must be allowed to render that message
    // without the interceptor force-reloading the page out from under it.
    // Also skip when there is no token: an unauthenticated guest browsing the
    // store may hit an endpoint that requires auth (e.g. /products/recommended);
    // those calls should fail quietly, not yank the guest off to /login.
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      const isAuthEntryPoint = url.includes('/auth/login') || url.includes('/auth/register');
      const hasToken = !!useAuthStore.getState().token;
      if (!isAuthEntryPoint && hasToken) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
