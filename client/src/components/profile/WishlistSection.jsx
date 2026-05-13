import { Heart, Trash2, ShoppingCart, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useWishlistStore } from '../../store/wishlistStore';
import { useCartStore } from '../../store/cartStore';

const WishlistItem = ({ item, onRemove }) => {
  const { addToCart } = useCartStore();
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleAddToCart = async () => {
    setAdding(true);
    try {
      await addToCart(item.product.id, null, 1);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (error) {
      console.error(error);
    } finally {
      setAdding(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 group relative"
    >
      <Link to={`/product/${item.product.slug}`} className="flex-shrink-0">
        <img 
          src={item.product.images[0]?.url || 'https://via.placeholder.com/150'} 
          alt={item.product.title}
          className="w-24 h-24 object-cover rounded-2xl hover:opacity-90 transition-opacity"
        />
      </Link>
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <Link to={`/product/${item.product.slug}`}>
            <h4 className="font-bold text-gray-900 text-base line-clamp-1 hover:text-[#fb7701] transition-colors">
              {item.product.title}
            </h4>
          </Link>
          <p className="text-[#fb7701] font-black text-lg mt-1">${item.product.price.toFixed(2)}</p>
        </div>
        <div className="flex gap-3 mt-3">
          <button 
            onClick={handleAddToCart}
            disabled={adding}
            className={`flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-95 border-2 ${
              success 
              ? 'bg-green-500 text-white border-green-500' 
              : 'bg-white border-gray-100 text-gray-700 hover:bg-gray-900 hover:text-white hover:border-gray-900'
            }`}
          >
            {adding ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
            ) : success ? (
              <><Check size={16} /> ADDED</>
            ) : (
              <><ShoppingCart size={16} /> ADD TO CART</>
            )}
          </button>
          <button 
            onClick={() => onRemove(item.product.id)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const WishlistSection = () => {
  const { wishlist, loading, removeFromWishlist, fetchWishlist } = useWishlistStore();

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  if (loading && wishlist.length === 0) return <div className="animate-pulse h-48 bg-gray-50 rounded-3xl" />;

  return (
    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Heart size={24} className="text-red-500 fill-red-500" /> My Wishlist
      </h3>
      
      {wishlist.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <p className="text-gray-400 font-medium">Your wishlist is empty</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {wishlist.map((item) => (
            <WishlistItem key={item.id} item={item} onRemove={removeFromWishlist} />
          ))}
        </div>
      )}
    </div>
  );
};

export default WishlistSection;
