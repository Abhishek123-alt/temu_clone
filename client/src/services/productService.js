import api from './api';

export const productService = {
  getProducts: async (skip = 0, limit = 20, search = '') => {
    const url = `/products/?skip=${skip}&limit=${limit}${search ? `&search=${search}` : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  getCategories: async () => {
    const response = await api.get('/products/categories');
    return response.data;
  },
  getProductBySlug: async (slug) => {
    const response = await api.get(`/products/${slug}`);
    return response.data;
  }
};
