import api from './api';

export const productService = {
  getProducts: async (skip = 0, limit = 20, search = '', dealOnly = false, normalOnly = false, categoryId = null) => {
    let url = `/products/?skip=${skip}&limit=${limit}&search=${encodeURIComponent(search)}`;
    if (dealOnly) url += '&deal_only=true';
    if (normalOnly) url += '&normal_only=true';
    if (categoryId) url += `&category_id=${categoryId}`;
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
