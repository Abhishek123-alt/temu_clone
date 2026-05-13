import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { productService } from '../../services/productService';
import ProductCard from '../../components/products/ProductCard';
import { motion } from 'framer-motion';
import { Gift, Zap, Star, Sparkles } from 'lucide-react';
import SpinWheel from '../../components/gamification/SpinWheel';
import MarketingCarousel from '../../components/marketing/MarketingCarousel';
import FlashSaleSection from '../../components/marketing/FlashSaleSection';

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWheelOpen, setIsWheelOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const activeCategoryId = queryParams.get('category_id');

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const search = queryParams.get('search') || '';
        const category_id = queryParams.get('category_id');
        const new_arrivals = queryParams.get('new_arrivals') === 'true';
        
        const [productsData, categoriesData] = await Promise.all([
          productService.getProducts(0, 50, search, false, true, category_id, new_arrivals),
          productService.getCategories()
        ]);
        
        setProducts(productsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [location.search]);

  if (loading && products.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-[#fb7701] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Dynamic Marketing Hero */}
      <div className="mb-12">
        <MarketingCarousel />
      </div>

      {/* Flash Sale Section */}
      <FlashSaleSection />

      <div id="product-feed" className="mb-8 flex items-center justify-between scroll-mt-24">
        <h2 className="text-2xl font-extrabold text-gray-900">
          {queryParams.get('new_arrivals') === 'true' ? 'New Arrivals' : 'Recommended for You'}
        </h2>
        <a href="#" className="text-[#fb7701] font-bold hover:underline">View All</a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-20">
          <p className="text-xl font-bold text-gray-400">No products found matching your search.</p>
          <button
            onClick={() => navigate('/')}
            className="text-[#fb7701] font-bold mt-4 hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Floating Spin Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsWheelOpen(true)}
        className="fixed bottom-8 right-8 w-20 h-20 bg-[#fb7701] text-white rounded-full shadow-2xl shadow-orange-500/40 flex flex-col items-center justify-center z-50 border-4 border-white group"
      >
        <Gift className="group-hover:animate-bounce" size={28} />
        <span className="text-[10px] font-black uppercase tracking-tighter mt-1">Spin & Win</span>
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white">1</div>
      </motion.button>

      <SpinWheel isOpen={isWheelOpen} onClose={() => setIsWheelOpen(false)} />
    </div>
  );
};

export default HomePage;
