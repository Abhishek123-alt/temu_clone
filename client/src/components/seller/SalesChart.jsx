import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SalesChart = ({ data = [] }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Sample data if none provided
  const chartData = data.length > 0 ? data : [
    { day: 'Mon', sales: 1200 },
    { day: 'Tue', sales: 1900 },
    { day: 'Wed', sales: 1500 },
    { day: 'Thu', sales: 2400 },
    { day: 'Fri', sales: 1800 },
    { day: 'Sat', sales: 2800 },
    { day: 'Sun', sales: 2100 },
  ];

  const maxSales = Math.max(...chartData.map(d => d.sales), 1); // Avoid division by zero
  const height = 200;

  return (
    <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Weekly Revenue</h3>
          <p className="text-sm text-gray-400 font-medium">Interactive sales performance</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#fb7701]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sales</span>
          </div>
        </div>
      </div>

      <div className="relative h-[240px] flex items-end justify-between gap-2 px-2">
        {chartData.map((d, i) => {
          const barHeight = (d.sales / maxSales) * height;
          return (
            <div 
              key={i} 
              className="flex-1 flex flex-col items-center group/bar"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="relative w-full flex flex-col items-center">
                <AnimatePresence>
                  {hoveredIndex === i && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.5 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.5 }}
                      className="absolute -top-12 bg-gray-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold z-10 whitespace-nowrap shadow-xl"
                    >
                      ${d.sales.toLocaleString()}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: barHeight }}
                  transition={{ type: 'spring', damping: 20, stiffness: 100, delay: i * 0.1 }}
                  className={`w-full max-w-[40px] rounded-t-2xl transition-all duration-300 ${
                    hoveredIndex === i ? 'bg-[#fb7701] shadow-lg shadow-orange-100' : 'bg-orange-50 group-hover/bar:bg-orange-100'
                  }`}
                />
              </div>
              <span className={`mt-4 text-[10px] font-black uppercase tracking-widest transition-colors ${
                hoveredIndex === i ? 'text-[#fb7701]' : 'text-gray-400'
              }`}>
                {d.day}
              </span>
            </div>
          );
        })}

        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-[0.03]">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-full h-px bg-gray-900" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SalesChart;
