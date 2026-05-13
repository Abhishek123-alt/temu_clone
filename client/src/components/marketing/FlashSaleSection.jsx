import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Timer, Zap, Tag, ShoppingBag } from 'lucide-react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import ProductCard from '../products/ProductCard';

const FlashSaleSection = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState('');
 
   useEffect(() => {
     const fetchSales = async () => {
       try {
         const res = await api.get('/flash-sales/active');
         setSales(res.data);
       } catch (error) {
         console.error('Failed to fetch flash sales:', error);
       } finally {
         setLoading(false);
       }
     };
     fetchSales();
   }, []);
 
   useEffect(() => {
     if (sales.length === 0) return;
     
     const currentSale = sales[0];
     const updateTimer = () => {
       const end = new Date(currentSale.end_time);
       const now = new Date();
       const diff = end - now;
 
       if (diff <= 0) {
         setTimeLeft('EXPIRED');
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
   }, [sales]);
 
   if (loading) return null;
   if (sales.length === 0) return null;
 
   const currentSale = sales[0];

  return (
    <div className="mb-12 bg-red-50 rounded-[32px] p-6 md:p-8 border-2 border-red-100 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10 text-red-500">
        <Zap size={120} />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative z-10">
        <div>
          <div className="flex items-center gap-2 text-red-600 font-black uppercase tracking-widest text-xs mb-2">
            <Timer size={16} /> Limited Time Offer
          </div>
          <h2 className="text-3xl font-black text-gray-900">{currentSale.name}</h2>
          <p className="text-gray-600 font-medium">{currentSale.description}</p>
        </div>

        <button 
          onClick={() => navigate('/deals')}
          className="bg-red-600 text-white px-6 py-3 rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-red-200 hover:bg-red-700 transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-bold uppercase tracking-tighter opacity-80">Ends In</span>
          <span className="text-2xl font-black tabular-nums">{timeLeft}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {(currentSale.products || []).filter(item => item.product).map((item) => {
          const productWithDiscount = {
            ...item.product,
            original_price: item.product.price,
            price: item.discounted_price
          };
          return (
            <div key={item.id} className="relative group">
              <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase">
                Save ${(item.product.price - item.discounted_price).toFixed(2)}
              </div>
              <ProductCard product={productWithDiscount} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FlashSaleSection;
