import api from './api';

export const authService = {
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  loginWithGoogle: async ({ credential, referralCode } = {}) => {
    const response = await api.post('/auth/google', {
      credential,
      referral_code: referralCode || null,
    });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/user/me');
    return response.data;
  }
};
