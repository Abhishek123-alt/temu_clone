import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import ProductCard from '../products/ProductCard';

const FlashSaleSection = () => {
  const [sales, setSales] = useState([]);
  const [activeSaleIndex, setActiveSaleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState('');
  const [isHovered, setIsHovered] = useState(false);

  const fetchSales = React.useCallback(async () => {
    try {
      const res = await api.get('/flash-sales/active');
      setSales(res.data);
    } catch (error) {
      console.error('Failed to fetch flash sales:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSales();
    const pollInterval = setInterval(fetchSales, 10000);
    return () => clearInterval(pollInterval);
  }, [fetchSales]);

  // Ensure index is always valid if sales list changes
  useEffect(() => {
    if (activeSaleIndex >= sales.length && sales.length > 0) {
      setActiveSaleIndex(0);
    }
  }, [sales.length, activeSaleIndex]);

  useEffect(() => {
    if (sales.length <= 1 || isHovered) return;
    const rotationTimer = setInterval(() => {
      setActiveSaleIndex((prev) => (prev + 1) % sales.length);
    }, 3000);
    return () => clearInterval(rotationTimer);
  }, [sales, isHovered]);

  useEffect(() => {
    if (sales.length === 0) return;
    const currentSale = sales[activeSaleIndex];
    if (!currentSale) return;

    const updateTimer = () => {
      const end = new Date(currentSale.end_time);
      const now = new Date();
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        // Refresh sales to remove the expired one
        fetchSales();
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [sales, activeSaleIndex]);

  if (loading || sales.length === 0) return null;

  const currentSale = sales[activeSaleIndex];

  return (
    <div 
      className="mb-20 relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Selection Dots for Campaigns */}
      <div className="flex justify-center gap-2 mb-6">
        {sales.map((_, idx) => (
          <button 
            key={idx}
            onClick={() => setActiveSaleIndex(idx)}
            className={`h-1.5 rounded-full transition-all ${activeSaleIndex === idx ? 'w-8 bg-red-600' : 'w-2 bg-gray-200'}`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentSale.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5 }}
          className="bg-red-50 rounded-[48px] p-8 md:p-14 border-2 border-red-100 relative overflow-hidden shadow-sm"
        >
          {/* Background Decorative Element */}
          <div className="absolute -top-20 -right-20 p-8 opacity-[0.03] text-red-600 pointer-events-none">
            <Zap size={400} />
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12 relative z-10">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                <Timer size={14} /> Flash Sale Live
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight">{currentSale.name}</h2>
              <p className="text-xl text-gray-600 font-medium max-w-2xl">{currentSale.description}</p>
            </div>

            <div className="flex flex-col items-center md:items-end">
              <div className="bg-white px-8 py-5 rounded-[32px] shadow-xl shadow-red-100/50 border border-red-100 flex flex-col items-center">
                <span className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-1">Offer Ends In</span>
                <span className="text-4xl font-black text-gray-900 tabular-nums">{timeLeft}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {(currentSale.products || []).filter(item => item.product).map((item, idx) => {
              const productWithDiscount = {
                ...item.product,
                original_price: item.product.price,
                price: item.discounted_price
              };
              return (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative"
                >
                  <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase shadow-md">
                    {Math.round((1 - item.discounted_price / item.product.price) * 100)}% OFF
                  </div>
                  <ProductCard product={productWithDiscount} />
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      {sales.length > 1 && (
        <>
          <button 
            onClick={() => setActiveSaleIndex(prev => (prev - 1 + sales.length) % sales.length)}
            className="absolute -left-6 top-1/2 -translate-y-1/2 w-14 h-14 bg-white border border-gray-100 rounded-full flex items-center justify-center shadow-xl text-gray-400 hover:text-red-600 hover:scale-110 transition-all z-20 opacity-0 group-hover:opacity-100"
          >
            <ChevronLeft size={28} />
          </button>
          <button 
            onClick={() => setActiveSaleIndex(prev => (prev + 1) % sales.length)}
            className="absolute -right-6 top-1/2 -translate-y-1/2 w-14 h-14 bg-white border border-gray-100 rounded-full flex items-center justify-center shadow-xl text-gray-400 hover:text-red-600 hover:scale-110 transition-all z-20 opacity-0 group-hover:opacity-100"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}
    </div>
  );
};

export default FlashSaleSection;
