import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { productService } from '../../services/productService';
import { useCartStore } from '../../store/cartStore';
import { Star, ShoppingCart, ShieldCheck, Truck, RotateCcw, Plus, Minus, Check } from 'lucide-react';
import { motion } from 'framer-motion';

const ProductDetailPage = () => {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState(false);
  const { addToCart } = useCartStore();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const data = await productService.getProductBySlug(slug);
        setProduct(data);
      } catch (error) {
        console.error('Failed to fetch product:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [slug]);

  const handleAddToCart = async () => {
    setAdding(true);
    try {
      await addToCart(product.id, quantity);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (error) {
      console.error(error);
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <div className="p-20 text-center text-gray-400">Loading details...</div>;
  if (!product) return <div className="p-20 text-center">Product not found</div>;

  const mainImage = product.images.find(img => img.is_main)?.url || product.images[0]?.url;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        
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
            <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full">
              <Star size={16} className="text-yellow-400" fill="currentColor" />
              <span className="font-bold text-yellow-700">{product.rating}</span>
            </div>
            <span className="text-gray-400 font-medium">{product.review_count} Reviews</span>
            <span className="text-gray-200">|</span>
            <span className="text-green-600 font-bold">In Stock</span>
          </div>

          <div className="bg-gray-50 rounded-[32px] p-8 mb-8">
            <div className="flex items-baseline gap-4 mb-2">
              <span className="text-5xl font-black text-[#fb7701]">${product.price}</span>
              {product.original_price && (
                <span className="text-xl text-gray-400 line-through">${product.original_price}</span>
              )}
            </div>
            <p className="text-green-600 font-bold text-sm">Save ${(product.original_price - product.price).toFixed(2)} today!</p>
          </div>

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
              disabled={adding}
              className={`flex-1 btn-primary py-5 text-xl flex items-center justify-center gap-3 transition-all ${
                success ? 'bg-green-500 border-green-500' : ''
              }`}
            >
              {adding ? (
                <span className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : success ? (
                <><Check size={24} /> Added to Cart</>
              ) : (
                <><ShoppingCart size={24} /> Add to Cart</>
              )}
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
    </div>
  );
};

export default ProductDetailPage;
