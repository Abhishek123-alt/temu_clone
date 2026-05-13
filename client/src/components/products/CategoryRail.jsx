import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, LayoutGrid } from 'lucide-react';

const CategoryRail = ({ categories, activeCategoryId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll);
      handleScroll();
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [categories]);

  const handleCategoryClick = (categoryId) => {
    const queryParams = new URLSearchParams(location.search);
    if (categoryId) {
      queryParams.set('category_id', categoryId);
    } else {
      queryParams.delete('category_id');
    }
    
    // Maintain other search params but update category
    navigate(`${location.pathname}?${queryParams.toString()}#product-feed`);
    
    // Scroll the clicked item into view
    const element = document.getElementById(`cat-${categoryId || 'all'}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - 300 : scrollLeft + 300;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <div className="sticky top-16 lg:top-20 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 -mx-4 px-4 mb-8">
      <div className="max-w-7xl mx-auto relative group py-3">
        {/* Navigation Buttons */}
        <AnimatePresence>
          {showLeftArrow && (
            <motion.button 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 bg-white border border-gray-200 rounded-full shadow-md z-20 flex items-center justify-center text-gray-600 hover:text-[#fb7701] transition-all"
            >
              <ChevronLeft size={18} />
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showRightArrow && (
            <motion.button 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 bg-white border border-gray-200 rounded-full shadow-md z-20 flex items-center justify-center text-gray-600 hover:text-[#fb7701] transition-all"
            >
              <ChevronRight size={18} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Categories Scrollable Container */}
        <div 
          ref={scrollRef}
          className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth"
        >
          <button
            id="cat-all"
            onClick={() => handleCategoryClick(null)}
            className={`flex flex-col items-center min-w-[70px] gap-1.5 p-1 rounded-xl transition-all duration-300 ${
              !activeCategoryId 
                ? 'text-[#fb7701]' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
              !activeCategoryId 
                ? 'bg-[#fb7701] text-white shadow-lg shadow-orange-100 rotate-3' 
                : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'
            }`}>
              <LayoutGrid size={24} />
            </div>
            <span className={`text-[11px] font-bold uppercase tracking-tight whitespace-nowrap`}>All</span>
            {!activeCategoryId && (
              <motion.div layoutId="active-pill" className="h-0.5 w-4 bg-[#fb7701] rounded-full" />
            )}
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              id={`cat-${cat.id}`}
              onClick={() => handleCategoryClick(cat.id)}
              className={`flex flex-col items-center min-w-[80px] gap-1.5 p-1 rounded-xl transition-all duration-300 ${
                activeCategoryId === String(cat.id)
                  ? 'text-[#fb7701]'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-300 ${
                activeCategoryId === String(cat.id)
                  ? 'bg-orange-50 ring-2 ring-[#fb7701] ring-offset-2 shadow-lg shadow-orange-50 -rotate-3'
                  : 'bg-gray-50 group-hover:bg-gray-100'
              }`}>
                {cat.image_url ? (
                  <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-black opacity-20">{cat.name[0]}</span>
                )}
              </div>
              <span className={`text-[11px] font-bold uppercase tracking-tight whitespace-nowrap truncate max-w-[80px]`}>
                {cat.name}
              </span>
              {activeCategoryId === String(cat.id) && (
                <motion.div layoutId="active-pill" className="h-0.5 w-4 bg-[#fb7701] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default CategoryRail;
