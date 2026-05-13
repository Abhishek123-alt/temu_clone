import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { productService } from '../../services/productService';
import ProductCard from '../../components/products/ProductCard';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import CategoryRail from '../../components/products/CategoryRail';

const NewArrivalsPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const activeCategoryId = queryParams.get('category_id');

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const category_id = queryParams.get('category_id');
        const [productsData, categoriesData] = await Promise.all([
          productService.getProducts(0, 50, '', false, true, category_id, true),
          productService.getCategories()
        ]);
        setProducts(productsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [location.search]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-[#fb7701] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Back Navigation */}
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-500 hover:text-[#fb7701] font-bold mb-8 transition-colors group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Back to Home
        </button>

        {/* Header Hero */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[40px] p-12 mb-16 text-white relative overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-2xl">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-6"
            >
              <Sparkles size={14} className="animate-pulse" /> Just Arrived
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-black mb-6 leading-tight"
            >
              The Newest <br/> <span className="text-blue-300 italic">Styles</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl font-medium opacity-90 leading-relaxed"
            >
              Fresh drops, trending designs, and the latest innovations. <br className="hidden md:block" /> 
              Be the first to own the season's hottest items.
            </motion.p>
          </div>

          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-1/3 h-full bg-white/5 skew-x-12 transform translate-x-20" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl" />
        </div>

        {/* Category Rail */}
        <CategoryRail 
          categories={categories} 
          activeCategoryId={activeCategoryId} 
        />

        {/* Product Grid */}
        <div id="product-feed" className="space-y-12 scroll-mt-40">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Fresh Drops</h2>
            <div className="text-sm font-bold text-gray-400 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
              {products.length} Items Found
            </div>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {products.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-32 bg-white rounded-[40px] shadow-sm border border-gray-100">
              <div className="text-gray-300 mb-4 flex justify-center">
                <Sparkles size={64} strokeWidth={1} />
              </div>
              <p className="text-xl font-bold text-gray-400">No new arrivals just yet.</p>
              <button
                onClick={() => navigate('/')}
                className="mt-6 text-[#fb7701] font-black hover:underline px-8 py-3 bg-orange-50 rounded-full"
              >
                Discover Recommendations
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Trust Badges */}
      <div className="bg-white border-t border-gray-100 py-16 mt-20">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { label: 'Fast Shipping', desc: 'Arrives in 5-7 days' },
            { label: 'Secure Payment', desc: '100% Protected' },
            { label: 'Easy Returns', desc: '30-day window' },
            { label: 'Quality Gear', desc: 'Premium materials' }
          ].map((badge, i) => (
            <div key={i} className="text-center">
              <p className="font-black text-gray-900 uppercase tracking-tighter">{badge.label}</p>
              <p className="text-xs text-gray-500 font-medium">{badge.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NewArrivalsPage;
