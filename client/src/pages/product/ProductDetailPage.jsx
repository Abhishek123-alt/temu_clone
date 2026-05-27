import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { productService } from '../../services/productService';
import { userService } from '../../services/userService';
import { useCartStore } from '../../store/cartStore';
import { useWishlistStore } from '../../store/wishlistStore';
import { Star, ShoppingCart, ShieldCheck, Truck, RotateCcw, Plus, Minus, Check, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import ReviewList from '../../components/reviews/ReviewList';

const ProductDetailPage = () => {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [reviewStats, setReviewStats] = useState({ count: 0, average: 0 });
  const { addToCart } = useCartStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();

  const handleReviewStats = useCallback((stats) => {
    setReviewStats(stats);
  }, []);

  // React StrictMode double-invokes effects in dev. Without this guard the
  // PDP would POST /recently-viewed twice in parallel for the same product,
  // racing the quest progress counter on the server.
  const recordedViewIds = useRef(new Set());

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const data = await productService.getProductBySlug(slug);
        setProduct(data);

        // Initialize selected options if product has variants
        if (data.variants && data.variants.length > 0) {
          const firstVariant = data.variants[0];
          const initialOptions = {};
          firstVariant.option_values.forEach(ov => {
            const option = data.options.find(o =>
              o.values.some(v => v.id === ov.id)
            );
            if (option) initialOptions[option.name] = ov.value;
          });
          setSelectedOptions(initialOptions);
        }

        if (!recordedViewIds.current.has(data.id)) {
          recordedViewIds.current.add(data.id);
          userService.addToRecentlyViewed(data.id).catch(err => console.error("Failed to record view", err));
        }
      } catch (error) {
        console.error('Failed to fetch product:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [slug]);

  const handleOptionSelect = (optionName, value) => {
    setSelectedOptions(prev => ({
      ...prev,
      [optionName]: value
    }));
  };

  if (loading) return <div className="p-20 text-center text-gray-400">Loading details...</div>;
  if (!product) return <div className="p-20 text-center">Product not found</div>;

  const currentVariant = product.variants && product.variants.length > 0 
    ? product.variants.find(v =>
        v.option_values.every(ov =>
          Object.entries(selectedOptions).some(([name, val]) =>
            product.options.find(opt => opt.name === name && opt.values.some(ov_val => ov_val.id === ov.id && ov_val.value === val))
          )
        )
      ) || product.variants[0]
    : null;

  const displayPrice = currentVariant?.price ?? product.price;
  const displayOriginalPrice = currentVariant?.original_price ?? product.original_price;

  const handleAddToCart = async () => {
    if (product.variants && product.variants.length > 0 && !currentVariant) {
      alert("Please select a product variation");
      return;
    }
    setAdding(true);
    try {
      await addToCart(product.id, currentVariant?.id, quantity, {
        id: product.id,
        title: product.title,
        slug: product.slug,
        price: displayPrice,
        images: product.images || [],
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (error) {
      console.error(error);
    } finally {
      setAdding(false);
    }
  };

  const mainImage = product.images.find(img => img.is_main)?.url || product.images[0]?.url;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-20">
        
        {/* Left: Images */}
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="aspect-square rounded-[48px] overflow-hidden bg-gray-50 border border-gray-100"
          >
            <img src={mainImage} className="w-full h-full object-cover" />
          </motion.div>
          <div className="grid grid-cols-4 gap-4">
            {product.images.map((img, idx) => (
              <div key={idx} className="aspect-square rounded-2xl overflow-hidden border-2 border-transparent hover:border-[#fb7701] cursor-pointer bg-gray-50">
                <img src={img.url} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Info */}
        <div className="flex flex-col">
          <nav className="text-sm text-gray-400 font-medium mb-6">
            Home / Electronics / <span className="text-gray-900">{product.title}</span>
          </nav>

          <h1 className="text-4xl font-extrabold text-gray-900 leading-tight mb-4">{product.title}</h1>
          
          <div className="flex items-center gap-4 mb-8">
            {reviewStats.count > 0 ? (
              <>
                <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full">
                  <Star size={16} className="text-yellow-400" fill="currentColor" />
                  <span className="font-bold text-yellow-700">{reviewStats.average.toFixed(1)}</span>
                </div>
                <span className="text-gray-400 font-medium">{reviewStats.count} {reviewStats.count === 1 ? 'Review' : 'Reviews'}</span>
                <span className="text-gray-200">|</span>
              </>
            ) : (
              <>
                <span className="text-gray-400 font-medium">No reviews yet</span>
                <span className="text-gray-200">|</span>
              </>
            )}
            <span className="text-green-600 font-bold">In Stock</span>
          </div>

          <div className="bg-gray-50 rounded-[32px] p-8 mb-8">
            <div className="flex items-baseline gap-4 mb-2">
              <span className="text-5xl font-black text-[#fb7701]">${displayPrice}</span>
              {displayOriginalPrice && (
                <span className="text-xl text-gray-400 line-through">${displayOriginalPrice}</span>
              )}
            </div>
            <p className="text-green-600 font-bold text-sm">Save ${(displayOriginalPrice - displayPrice || 0).toFixed(2)} today!</p>
          </div>

          {product.options && product.options.length > 0 && (
            <div className="space-y-8 mb-10">
              {product.options.map((option) => (
                <div key={option.id} className="space-y-3">
                  <label className="text-sm font-bold text-gray-900 uppercase tracking-wider">{option.name}</label>
                  <div className="flex flex-wrap gap-3">
                    {option.values.map((val) => (
                      <button
                        key={val.id}
                        onClick={() => handleOptionSelect(option.name, val.value)}
                        className={`px-6 py-3 rounded-full text-sm font-bold transition-all border-2 ${
                          selectedOptions[option.name] === val.value
                            ? 'bg-white border-[#fb7701] text-[#fb7701] shadow-sm'
                            : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
                        }`}
                      >
                        {val.value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-gray-600 leading-relaxed mb-10 text-lg">{product.description}</p>

          {/* Quantity & Add to Cart */}
          <div className="flex items-center gap-6 mb-10">
            <div className="flex items-center border-2 border-gray-100 rounded-full p-2 bg-white shadow-sm">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-full text-gray-500"
              >
                <Minus size={20} />
              </button>
              <span className="w-12 text-center font-black text-xl text-gray-900">{quantity}</span>
              <button 
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-full text-gray-500"
              >
                <Plus size={20} />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={adding || (typeof product.stock === 'number' && product.stock <= 0)}
              className={`flex-1 btn-primary py-5 text-xl flex items-center justify-center gap-3 transition-all ${
                success ? 'bg-green-500 border-green-500' : ''
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {typeof product.stock === 'number' && product.stock <= 0 ? (
                'Out of Stock'
              ) : adding ? (
                <span className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : success ? (
                <><Check size={24} /> Added to Cart</>
              ) : (
                <><ShoppingCart size={24} /> Add to Cart</>
              )}
            </button>

            <button 
              onClick={() => toggleWishlist(product)}
              className={`p-5 border-2 rounded-full transition-all ${
                isInWishlist(product.id) 
                ? 'bg-red-50 border-red-200 text-red-500 shadow-sm' 
                : 'border-gray-100 text-gray-400 hover:bg-red-50 hover:border-red-100 hover:text-red-500'
              }`}
            >
              <Heart size={28} fill={isInWishlist(product.id) ? "currentColor" : "none"} />
            </button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-gray-100">
            <div className="flex items-center gap-3 text-gray-500">
              <Truck size={20} className="text-[#fb7701]" />
              <span className="text-sm font-bold">Free Shipping</span>
            </div>
            <div className="flex items-center gap-3 text-gray-500">
              <RotateCcw size={20} className="text-[#fb7701]" />
              <span className="text-sm font-bold">90-Day Returns</span>
            </div>
            <div className="flex items-center gap-3 text-gray-500">
              <ShieldCheck size={20} className="text-[#fb7701]" />
              <span className="text-sm font-bold">Secure Payment</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section - Outside the grid for full width */}
      <div className="pt-16 border-t border-gray-100">
        <ReviewList productId={product.id} onStats={handleReviewStats} />
      </div>
    </div>
  );
};

export default ProductDetailPage;
