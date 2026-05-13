import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Zap, Timer, Tag } from 'lucide-react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';

const MarketingCarousel = () => {
  const [banners, setBanners] = useState([
    {
      id: '1',
      title: 'Mega Summer Sale!',
      description: 'Up to 70% OFF on all electronics. Limited time only!',
      image: 'https://images.unsplash.com/photo-1498049796873-ba26082ele-123',
      link: '/deals',
      color: 'bg-orange-500'
    },
    {
      id: '2',
      title: 'New Arrivals',
      description: 'Fresh styles for the new season. Explore now.',
      image: 'https://images.unsplash.com/photo-1441986300917-64674bd30ad6',
      link: '/new-arrivals',
      color: 'bg-blue-500'
    },
    {
      id: '3',
      title: 'Join the Club',
      description: 'Get exclusive rewards and early access to deals.',
      image: 'https://images.unsplash.com/photo-1556742044-177767391c2d',
      link: '/profile/quests',
      color: 'bg-purple-500'
    }
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const next = () => setCurrentIndex((prev) => (prev + 1) % banners.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);

  return (
    <div className="relative w-full h-[300px] md:h-[450px] rounded-[32px] overflow-hidden shadow-2xl group">
      <AnimatePresence mode="wait">
        <motion.div
          key={banners[currentIndex].id}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`absolute inset-0 flex flex-col md:flex-row items-center justify-center p-8 md:p-16 text-white ${banners[currentIndex].color}`}
        >
          <div className="relative z-10 text-center md:text-left max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">
              <Sparkles size={14} /> Limited Offer
            </div>
            <h2 className="text-4xl md:text-7xl font-black leading-tight">
              {banners[currentIndex].title}
            </h2>
            <p className="text-lg md:text-xl font-medium opacity-90 max-w-md">
              {banners[currentIndex].description}
            </p>
            <button
              onClick={() => navigate(banners[currentIndex].link)}
              className="bg-white text-gray-900 px-8 py-4 rounded-full font-black text-lg hover:scale-105 transition-transform shadow-xl"
            >
              Shop Now
            </button>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />
          <img
            src={banners[currentIndex].image}
            alt={banners[currentIndex].title}
            className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
          />
        </motion.div>
      </AnimatePresence>

      <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/40">
        <ChevronLeft size={24} />
      </button>
      <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/40">
        <ChevronRight size={24} />
      </button>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {banners.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${i === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/50'}`}
          />
        ))}
      </div>
    </div>
  );
};

// Dummy component for Sparkles to avoid import errors if not found
const Sparkles = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a12.025 12.025 0 0 1-9.243 0L3 7.5"/><path d="m12 3 1.912 5.813a12.025 12.025 0 0 0 9.243 0L21 7.5"/><path d="m12 21-1.912-5.813a12.025 12.025 0 0 0-9.243 0L3 16.5"/><path d="m12 21 1.912-5.813a12.025 12.025 0 0 1 9.243 0L21 16.5"/></svg>
);

export default MarketingCarousel;
