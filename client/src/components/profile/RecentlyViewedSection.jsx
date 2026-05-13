import React, { useEffect, useState } from 'react';
import { History, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { userService } from '../../services/userService';

const RecentlyViewedSection = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRecentlyViewed = async () => {
      try {
        const data = await userService.getRecentlyViewed(5);
        setItems(data);
      } catch (error) {
        console.error("Failed to fetch recently viewed:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecentlyViewed();
  }, []);

  if (loading) return <div className="animate-pulse h-32 bg-gray-50 rounded-3xl" />;
  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <History size={24} className="text-[#fb7701]" /> Recently Viewed
      </h3>
      
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {items.map((item) => (
          <motion.button
            key={item.id}
            whileHover={{ y: -5 }}
            onClick={() => navigate(`/product/${item.product.slug}`)}
            className="flex-shrink-0 w-28 text-left"
          >
            <img 
              src={item.product.images[0]?.url || 'https://via.placeholder.com/150'} 
              alt={item.product.title}
              className="w-28 h-28 object-cover rounded-2xl mb-2"
            />
            <p className="text-xs font-bold text-gray-900 line-clamp-1">{item.product.title}</p>
            <p className="text-[#fb7701] font-black text-sm">${item.product.price.toFixed(2)}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default RecentlyViewedSection;
