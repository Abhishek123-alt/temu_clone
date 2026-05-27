import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import { useAuthStore } from './authStore';

const isAuthed = () => useAuthStore.getState().isAuthenticated;

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      loading: false,

      fetchCart: async () => {
        if (!isAuthed()) return;
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

      addToCart: async (productId, variantId = null, quantity = 1, productSnapshot = null) => {
        if (isAuthed()) {
          try {
            await api.post('/cart/items', {
              product_id: productId,
              variant_id: variantId,
              quantity,
            });
            await get().fetchCart();
          } catch (error) {
            console.error('Failed to add to cart:', error);
            throw error;
          }
          return;
        }
        // Guest: keep items in local store only. Need a product snapshot so
        // the cart page can render title/price/image without server data.
        if (!productSnapshot) {
          throw new Error('Guest cart requires a product snapshot');
        }
        const items = get().items.slice();
        const idx = items.findIndex(
          (it) => it.product.id === productId && (it.variant_id || null) === (variantId || null)
        );
        if (idx >= 0) {
          items[idx] = { ...items[idx], quantity: items[idx].quantity + quantity };
        } else {
          items.push({
            id: `guest-${productId}-${variantId || 'base'}`,
            product: productSnapshot,
            variant_id: variantId,
            quantity,
          });
        }
        set({ items });
      },

      updateQuantity: async (productId, quantity) => {
        if (isAuthed()) {
          try {
            await api.put(`/cart/items/${productId}`, { quantity });
            await get().fetchCart();
          } catch (error) {
            console.error('Failed to update quantity:', error);
          }
          return;
        }
        const items = get()
          .items.map((it) => (it.product.id === productId ? { ...it, quantity } : it))
          .filter((it) => it.quantity > 0);
        set({ items });
      },

      removeItem: async (productId) => {
        if (isAuthed()) {
          try {
            await api.delete(`/cart/items/${productId}`);
            await get().fetchCart();
          } catch (error) {
            console.error('Failed to remove item:', error);
          }
          return;
        }
        set({ items: get().items.filter((it) => it.product.id !== productId) });
      },

      clearCart: () => {
        set({ items: [] });
      },

      // Replay a guest cart into the server cart after login/register, then
      // refetch so the local view reflects the canonical server state.
      mergeGuestCart: async () => {
        if (!isAuthed()) return;
        const guestItems = get().items;
        if (guestItems.length === 0) {
          await get().fetchCart();
          return;
        }
        for (const it of guestItems) {
          try {
            await api.post('/cart/items', {
              product_id: it.product.id,
              variant_id: it.variant_id || null,
              quantity: it.quantity,
            });
          } catch (error) {
            console.error('Failed to merge guest cart item:', it.product.id, error);
          }
        }
        await get().fetchCart();
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getTotalPrice: () => {
        return get()
          .items.reduce((total, item) => total + item.product.price * item.quantity, 0)
          .toFixed(2);
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);
