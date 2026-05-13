import React, { useState, useEffect } from 'react';
import { ChevronDown, LayoutGrid, Sparkles, Zap, Star } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { productService } from '../../services/productService';
import { motion, AnimatePresence } from 'framer-motion';

const CategoryDropdown = () => {
  const [categories, setCategories] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await productService.getCategories();
        setCategories(data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };
    fetchCategories();
  }, []);

  const handleCategoryClick = (categoryId) => {
    setIsOpen(false);
    const queryParams = new URLSearchParams(location.search);
    if (categoryId) {
      queryParams.set('category_id', categoryId);
    } else {
      queryParams.delete('category_id');
    }
    navigate(`${location.pathname}?${queryParams.toString()}`);
  };

  return (
    <div className="relative" onMouseLeave={() => setIsOpen(false)}>
      <button 
        onMouseEnter={() => setIsOpen(true)}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 text-sm font-black uppercase tracking-tighter h-10 px-6 rounded-full transition-all duration-300 ${
          isOpen ? 'bg-[#fb7701] text-white shadow-lg shadow-orange-200' : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <LayoutGrid size={18} />
        <span className="hidden lg:block">Categories</span>
        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-12 left-0 w-[480px] bg-white border border-gray-100 shadow-2xl rounded-[32px] p-6 z-50 overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 mb-4 flex items-center justify-between px-2">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Shop by Category</h3>
                <button 
                  onClick={() => handleCategoryClick(null)}
                  className="text-xs font-bold text-[#fb7701] hover:underline"
                >
                  View All
                </button>
              </div>

              {/* Quick Links */}
              <button
                onClick={() => { navigate('/deals'); setIsOpen(false); }}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-red-50 text-left transition-colors group"
              >
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
                  <Zap size={20} fill="currentColor" />
                </div>
                <div>
                  <div className="text-sm font-black text-gray-900">Flash Sales</div>
                  <div className="text-[10px] text-gray-500 font-medium">Up to 90% off</div>
                </div>
              </button>

              <button
                onClick={() => { navigate('/new-arrivals'); setIsOpen(false); }}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-blue-50 text-left transition-colors group"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                  <Sparkles size={20} fill="currentColor" />
                </div>
                <div>
                  <div className="text-sm font-black text-gray-900">New Arrivals</div>
                  <div className="text-[10px] text-gray-500 font-medium">Fresh drops daily</div>
                </div>
              </button>

              <div className="col-span-2 my-2 border-t border-gray-50" />

              {/* Dynamic Categories */}
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-orange-50 text-left transition-all group"
                >
                  <div className="w-10 h-10 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center group-hover:bg-white transition-colors">
                    {cat.image_url ? (
                      <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      <Star size={18} className="text-gray-300" />
                    )}
                  </div>
                  <div className="text-sm font-bold text-gray-700 group-hover:text-[#fb7701] transition-colors truncate">
                    {cat.name}
                  </div>
                </button>
              ))}
            </div>

            {/* Decorative footer */}
            <div className="mt-6 bg-gradient-to-r from-[#fb7701] to-orange-400 -mx-6 -mb-6 p-4 text-center">
              <p className="text-[10px] font-black text-white uppercase tracking-widest">Temu Exclusive Collections</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CategoryDropdown;
