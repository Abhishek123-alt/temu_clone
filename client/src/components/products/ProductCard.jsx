import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ShoppingCart, Check } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { useWishlistStore } from '../../store/wishlistStore';
import { Heart } from 'lucide-react';

const ProductCard = ({ product }) => {
  const { addToCart } = useCartStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setAdding(true);
    try {
      await addToCart(product.id, null, 1);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (error) {
      console.error(error);
    } finally {
      setAdding(false);
    }
  };
  const mainImage = product.images?.length > 0 
    ? (product.images.find(img => img.is_main)?.url || product.images[0]?.url)
    : 'https://via.placeholder.com/400x400?text=No+Image';
  const discount = product.original_price 
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100) 
    : 0;

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="card group cursor-pointer overflow-hidden"
    >
      <Link to={`/product/${product.slug}`}>
        {/* Image Container */}
        <div className="relative aspect-square overflow-hidden bg-gray-50">
          <img 
            src={mainImage} 
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {discount > 0 && (
            <div className="absolute top-2 left-2 bg-[#fb7701] text-white text-[10px] font-bold px-2 py-1 rounded-md">
              -{discount}%
            </div>
          )}
          
          {/* Wishlist Button Overlay */}
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWishlist(product);
            }}
            className={`absolute top-2 right-2 p-1.5 rounded-full shadow-sm transition-all z-10 ${
              isInWishlist(product.id)
              ? 'bg-red-50 text-red-500'
              : 'bg-white/80 text-gray-400 hover:text-red-500'
            }`}
          >
            <Heart size={16} fill={isInWishlist(product.id) ? "currentColor" : "none"} />
          </button>
        </div>

        {/* Content */}
        <div className="p-3">
          <h3 className="text-sm text-gray-700 line-clamp-2 font-medium h-10 mb-1">
            {product.title}
          </h3>
          
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <div className="flex text-yellow-400">
                <Star size={12} fill="currentColor" />
              </div>
              <span className="text-[10px] text-gray-400 font-bold">{product.rating}</span>
            </div>
            <span className="text-[10px] text-gray-400 font-bold bg-gray-100 px-1.5 py-0.5 rounded">{product.sales_count || 0} sold</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-gray-900">${product.price}</span>
            {product.original_price && (
              <span className="text-xs text-gray-400 line-through">${product.original_price}</span>
            )}
          </div>
        </div>
      </Link>

      <div className="p-3 pt-0">
        <button 
          onClick={handleAddToCart}
          disabled={adding}
          className={`w-full mt-3 border py-1.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            success ? 'bg-green-500 text-white border-green-500' : 
            'border-gray-200 text-gray-700 hover:bg-[#fb7701] hover:text-white hover:border-[#fb7701]'
          }`}
        >
          {adding ? (
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
          ) : success ? (
            <><Check size={14} /> Added</>
          ) : (
            <><ShoppingCart size={14} /> Add to Cart</>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default ProductCard;
