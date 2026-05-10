import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { productService } from '../../services/productService';
import ProductCard from '../../components/products/ProductCard';
import { motion } from 'framer-motion';
import { Gift, Zap, Star, Sparkles } from 'lucide-react';
import SpinWheel from '../../components/gamification/SpinWheel';

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWheelOpen, setIsWheelOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams(location.search);
        const search = queryParams.get('search') || '';
        const data = await productService.getProducts(0, 50, search);
        setProducts(data);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [location.search]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-[#fb7701] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Banner/Hero placeholder */}
      <div className="bg-orange-50 rounded-[32px] p-8 md:p-16 mb-12 text-center md:text-left relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 leading-tight">
            Shop like a <br /><span className="text-[#fb7701]">Billionaire</span>
          </h1>
          <p className="text-gray-600 mt-4 text-lg font-medium max-w-md">
            Unbeatable prices on millions of quality items. Free shipping on all orders.
          </p>
          <button className="btn-primary mt-8 py-4 px-10 text-xl">
            Explore Deals
          </button>
        </div>
        <div className="absolute top-0 right-0 w-1/3 h-full bg-orange-100 hidden md:block rounded-l-full transform translate-x-12"></div>
      </div>

      {/* Product Feed */}
      <div className="mb-10 flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-gray-900">Recommended for You</h2>
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
