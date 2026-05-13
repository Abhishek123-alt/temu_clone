import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { productService } from '../../services/productService';
import ProductCard from '../../components/products/ProductCard';
import { Search, SlidersHorizontal, ChevronDown, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SearchPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const query = queryParams.get('q') || '';
  const activeCategoryId = queryParams.get('category_id');

  const sortOptions = [
    { label: 'Relevance', value: '' },
    { label: 'Top Sales', value: 'top_sales' },
    { label: 'Price: Low to High', value: 'price_asc' },
    { label: 'Price: High to Low', value: 'price_desc' },
  ];

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const data = await productService.getProducts(0, 50, query, false, false, activeCategoryId, false, sortBy);
        setProducts(data);
      } catch (error) {
        console.error('Failed to fetch search data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [query, sortBy, activeCategoryId]);

  const handleSortChange = (value) => {
    setSortBy(value);
    setIsSortOpen(false);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Search Stats Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Back button */}
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-500 hover:text-[#fb7701] font-bold mb-6 transition-colors group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to Home
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Search size={20} className="text-gray-400" />
                Results for "<span className="text-[#fb7701]">{query}</span>"
              </h1>
              <p className="text-sm text-gray-500 mt-1">{products.length} items found</p>
            </div>

            {/* Filters & Sort */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  <SlidersHorizontal size={16} />
                  Sort: {sortOptions.find(o => o.value === sortBy)?.label}
                  <ChevronDown size={14} className={`transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isSortOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 shadow-xl rounded-2xl py-2 z-50"
                    >
                      {sortOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleSortChange(opt.value)}
                          className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                            sortBy === opt.value ? 'text-[#fb7701] bg-orange-50' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="product-feed" className="max-w-7xl mx-auto px-4 py-8 scroll-mt-40">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-80 animate-pulse border border-gray-100"></div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white rounded-[40px] shadow-sm border border-gray-100">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search size={40} className="text-gray-300" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">No products found</h2>
            <p className="text-gray-500 font-medium mb-8">Try adjusting your search or filters to find what you're looking for.</p>
            <button 
              onClick={() => navigate('/')}
              className="bg-[#fb7701] text-white px-8 py-3 rounded-full font-black uppercase tracking-widest hover:bg-[#e06a01] transition-all"
            >
              Back to Shopping
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
