import { create } from 'zustand';
import { userService } from '../services/userService';

export const useWishlistStore = create((set, get) => ({
  wishlist: [],
  loading: false,
  
  fetchWishlist: async () => {
    set({ loading: true });
    try {
      const data = await userService.getWishlist();
      set({ wishlist: data, loading: false });
    } catch (error) {
      console.error("Failed to fetch wishlist:", error);
      set({ loading: false });
    }
  },

  addToWishlist: async (product) => {
    try {
      const newItem = await userService.addToWishlist(product.id);
      // Ensure we add the product object to the item for UI consistency
      const itemWithProduct = { ...newItem, product };
      set((state) => ({ 
        wishlist: [...state.wishlist, itemWithProduct] 
      }));
    } catch (error) {
      console.error("Failed to add to wishlist:", error);
    }
  },

  removeFromWishlist: async (productId) => {
    console.log("🗑️ Removing from wishlist:", productId);
    try {
      await userService.removeFromWishlist(productId);
      set((state) => {
        const newWishlist = state.wishlist.filter((item) => item.product.id !== productId);
        console.log("✅ New wishlist size:", newWishlist.length);
        return { wishlist: newWishlist };
      });
    } catch (error) {
      console.error("❌ Failed to remove from wishlist:", error);
    }
  },

  toggleWishlist: async (product) => {
    const { wishlist } = get();
    const isInWishlist = wishlist.some((item) => item.product.id === product.id);
    
    if (isInWishlist) {
      await get().removeFromWishlist(product.id);
    } else {
      await get().addToWishlist(product);
    }
  },

  isInWishlist: (productId) => {
    return get().wishlist.some((item) => item.product.id === productId);
  }
}));
