import api from './api';

export const adminService = {
  getStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },
  getUsers: async () => {
    const response = await api.get('/admin/users');
    return response.data;
  },
  getPendingSellers: async () => {
    const response = await api.get('/admin/sellers/pending');
    return response.data;
  },
  reviewSeller: async (userId, decision) => {
    const response = await api.post(`/admin/sellers/${userId}/review`, { decision });
    return response.data;
  }
};
