import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user, isAuthenticated: true }),
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        // Clear the previous user's cart so a guest on the same browser
        // doesn't inherit their items. Dynamic require avoids a circular
        // import (cartStore already imports authStore).
        import('./cartStore').then(({ useCartStore }) => {
          useCartStore.getState().clearCart();
        });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
