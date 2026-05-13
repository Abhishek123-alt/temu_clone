import api from './api';

export const userService = {
  getWishlist: async () => {
    const response = await api.get('/user/wishlist');
    return response.data;
  },
  addToWishlist: async (productId) => {
    const response = await api.post(`/user/wishlist/${productId}`);
    return response.data;
  },
  removeFromWishlist: async (productId) => {
    await api.delete(`/user/wishlist/${productId}`);
  },
  getRecentlyViewed: async (limit = 10) => {
    const response = await api.get(`/user/recently-viewed?limit=${limit}`);
    return response.data;
  },
  addToRecentlyViewed: async (productId) => {
    const response = await api.post(`/user/recently-viewed/${productId}`);
    return response.data;
  }
};
