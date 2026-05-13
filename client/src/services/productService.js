import api from './api';

export const productService = {
  getProducts: async (skip = 0, limit = 20, search = '', dealOnly = false, normalOnly = false, categoryId = null, newArrivals = false, sortBy = '') => {
    let url = `/products/?skip=${skip}&limit=${limit}&search=${encodeURIComponent(search)}`;
    if (dealOnly) url += '&deal_only=true';
    if (normalOnly) url += '&normal_only=true';
    if (categoryId) url += `&category_id=${categoryId}`;
    if (newArrivals) url += '&new_arrivals=true';
    if (sortBy) url += `&sort_by=${sortBy}`;
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
  },
  getRelatedProducts: async (productId) => {
    const response = await api.get(`/products/related/${productId}`);
    return response.data;
  },
  getRecommendedProducts: async () => {
    const response = await api.get(`/products/recommended`);
    return response.data;
  }
};
