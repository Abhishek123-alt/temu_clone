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

  const maxSales = Math.max(...chartData.map(d => d.sales), 1);
  const chartWidth = 800;
  const chartHeight = 200;
  const padding = 40;

  const getPoints = () => {
    return chartData.map((d, i) => {
      const divisor = chartData.length > 1 ? chartData.length - 1 : 1;
      const x = (i / divisor) * (chartWidth - padding * 2) + padding;
      const y = chartHeight - (d.sales / maxSales) * (chartHeight - padding) - padding;
      return { x, y, sales: d.sales, label: d.label };
    });
  };

  const points = getPoints();
  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

  return (
    <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Revenue Analysis</h3>
          <p className="text-sm text-gray-400 font-medium">Sales performance over time</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#fb7701]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sales</span>
          </div>
        </div>
      </div>

      <div className="relative h-[240px] w-full">
        <svg 
          viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb7701" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#fb7701" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area under the line */}
          <motion.path
            initial={{ d: `M ${points[0].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`, opacity: 0 }}
            animate={{ d: areaPath, opacity: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            fill="url(#areaGradient)"
          />

          {/* The Line */}
          <motion.path
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            d={linePath}
            fill="none"
            stroke="#fb7701"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interaction Points */}
          {points.map((p, i) => (
            <g key={i} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} className="cursor-pointer">
              <circle
                cx={p.x}
                cy={p.y}
                r="6"
                fill="white"
                stroke="#fb7701"
                strokeWidth="2"
                className={`transition-all duration-300 ${hoveredIndex === i ? 'r-8 stroke-[4px]' : 'opacity-0 group-hover:opacity-100'}`}
              />
              {/* Invisible touch area */}
              <circle cx={p.x} cy={p.y} r="20" fill="transparent" />
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {hoveredIndex !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ 
                opacity: 1, 
                y: 0, 
                scale: 1,
                left: `${(points[hoveredIndex].x / chartWidth) * 100}%`,
                top: `${(points[hoveredIndex].y / chartHeight) * 100 - 15}%`
              }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="absolute -translate-x-1/2 -translate-y-full bg-gray-900 text-white px-4 py-2 rounded-2xl text-xs font-black z-50 shadow-2xl pointer-events-none"
            >
              <div className="text-[8px] uppercase tracking-tighter opacity-50 mb-0.5">{points[hoveredIndex].label}</div>
              ${points[hoveredIndex].sales.toLocaleString()}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* X-Axis Labels */}
        <div className="absolute bottom-0 left-0 w-full flex justify-between px-[5%] translate-y-8">
          {points.map((p, i) => {
            const showLabel = chartData.length > 10 ? (i % Math.ceil(chartData.length / 8) === 0) : true;
            return (
              <span 
                key={i} 
                className={`text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                  hoveredIndex === i ? 'text-[#fb7701] scale-110' : 'text-gray-400'
                }`}
                style={{ opacity: showLabel || hoveredIndex === i ? 1 : 0 }}
              >
                {p.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SalesChart;
