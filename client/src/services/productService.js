import api from './api';

export const productService = {
  getProducts: async (skip = 0, limit = 20, search = '', dealOnly = false, normalOnly = false, categoryId = null, newArrivals = false, sortBy = '', attributeFilters = null, priceMin = null, priceMax = null, includeOutOfStock = false) => {
    let url = `/products/?skip=${skip}&limit=${limit}&search=${encodeURIComponent(search)}`;
    if (dealOnly) url += '&deal_only=true';
    if (normalOnly) url += '&normal_only=true';
    if (categoryId) url += `&category_id=${categoryId}`;
    if (newArrivals) url += '&new_arrivals=true';
    if (sortBy) url += `&sort_by=${sortBy}`;
    if (attributeFilters && Object.keys(attributeFilters).length > 0) {
      url += `&filters=${encodeURIComponent(JSON.stringify(attributeFilters))}`;
    }
    if (priceMin !== null && priceMin !== '' && priceMin !== undefined) url += `&price_min=${priceMin}`;
    if (priceMax !== null && priceMax !== '' && priceMax !== undefined) url += `&price_max=${priceMax}`;
    if (includeOutOfStock) url += '&include_out_of_stock=true';
    const response = await api.get(url);
    return response.data;
  },
  getCategories: async () => {
    const response = await api.get('/products/categories');
    return response.data;
  },
  getCategoryAttributes: async (categoryId) => {
    const response = await api.get(`/products/categories/${categoryId}/attributes`);
    return response.data;
  },
  getFacets: async (search = '', categoryId = null) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryId) params.set('category_id', categoryId);
    const response = await api.get(`/products/facets?${params.toString()}`);
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
