import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      loading: false,

      fetchCart: async () => {
        set({ loading: true });
        try {
          const response = await api.get('/cart/');
          set({ items: response.data.items });
        } catch (error) {
          console.error('Failed to fetch cart:', error);
        } finally {
          set({ loading: false });
        }
      },

      addToCart: async (productId, quantity = 1) => {
        try {
          await api.post('/cart/items', { product_id: productId, quantity });
          await get().fetchCart(); // Refresh cart
        } catch (error) {
          console.error('Failed to add to cart:', error);
          throw error;
        }
      },

      updateQuantity: async (productId, quantity) => {
        try {
          await api.put(`/cart/items/${productId}`, { quantity });
          await get().fetchCart();
        } catch (error) {
          console.error('Failed to update quantity:', error);
        }
      },

      removeItem: async (productId) => {
        try {
          await api.delete(`/cart/items/${productId}`);
          await get().fetchCart();
        } catch (error) {
          console.error('Failed to remove item:', error);
        }
      },
      
      clearCart: () => {
        set({ items: [] });
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getTotalPrice: () => {
        return get().items.reduce((total, item) => total + (item.product.price * item.quantity), 0).toFixed(2);
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);
