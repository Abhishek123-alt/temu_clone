import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, Gift, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const SpinWheel = ({ isOpen, onClose }) => {
  const { user, setUser } = useAuthStore();
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const wheelRef = useRef(null);

  // Refresh user data when wheel opens to ensure correct spins_left
  useEffect(() => {
    if (isOpen) {
      api.get('/user/me').then(res => setUser(res.data)).catch(() => {});
    }
  }, [isOpen]);

  const spinsLeft = user?.spins_left ?? 0;

  const prizes = [
    { label: '10% OFF', color: '#fb7701', value: 'coupon10' },
    { label: '$5 CREDIT', color: '#333333', value: 'credit5' },
    { label: 'FREE GIFT', color: '#fb7701', value: 'gift' },
    { label: 'TRY AGAIN', color: '#333333', value: 'none' },
    { label: '20% OFF', color: '#fb7701', value: 'coupon20' },
    { label: '$10 CREDIT', color: '#333333', value: 'credit10' },
    { label: 'BOGO DEAL', color: '#fb7701', value: 'bogo' },
    { label: 'FREE SHIP', color: '#333333', value: 'freeship' },
  ];

  const spin = async () => {
    if (isSpinning || spinsLeft <= 0) return;
    
    setIsSpinning(true);
    setResult(null);

    // Get outcome from server first
    try {
      const response = await api.post('/user/use-spin');
      const { prize_index, prize_label, spins_left } = response.data;
      
      const angle = 360 / prizes.length;
      const extraSpins = 1800; // 5 full rotations
      // Calculate final rotation to land on the center of the won slice
      const targetRotation = extraSpins + (360 - (prize_index * angle)) - (angle / 2);
      
      if (wheelRef.current) {
        wheelRef.current.style.transition = 'transform 4s cubic-bezier(0.15, 0, 0.15, 1)';
        wheelRef.current.style.transform = `rotate(${targetRotation}deg)`;
      }

      setTimeout(async () => {
        setResult(prizes[prize_index]);
        setIsSpinning(false);
        
        // Refresh user to update rewards and spins_left
        const updatedUser = await api.get('/user/me');
        setUser(updatedUser.data);

        if (prizes[prize_index].value !== 'none') {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#fb7701', '#333333', '#ffffff']
          });
        }
      }, 4000);

    } catch (err) {
      setIsSpinning(false);
      alert("Failed to spin. Please try again.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="bg-white rounded-[40px] p-8 max-w-md w-full relative overflow-hidden shadow-2xl border-4 border-[#fb7701]/20"
          >
            {/* Background Sparkles */}
            <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
              <div className="absolute top-10 left-10"><Sparkles size={40} /></div>
              <div className="absolute bottom-10 right-10"><Sparkles size={40} /></div>
            </div>

            <button 
              onClick={onClose}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <X size={24} />
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-gray-900 flex items-center justify-center gap-2">
                Spin & Win <Trophy className="text-[#fb7701]" />
              </h2>
              <p className="text-gray-500 font-bold mt-1 uppercase tracking-widest text-xs">One spin, multiple prizes!</p>
            </div>

            {/* The Wheel */}
            <div className="relative w-72 h-72 mx-auto mb-10 flex items-center justify-center">
              {/* Pointer */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30 text-[#fb7701] drop-shadow-lg">
                <div className="w-0 h-0 border-l-[18px] border-l-transparent border-r-[18px] border-r-transparent border-t-[30px] border-t-current"></div>
              </div>

              {/* Wheel Body */}
              <div 
                ref={wheelRef}
                className="w-full h-full rounded-full border-8 border-gray-900 shadow-2xl relative overflow-hidden transition-transform z-10"
              >
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  {prizes.map((prize, i) => {
                    const angle = 360 / prizes.length;
                    const rotation = i * angle;
                    const rad = (angle * Math.PI) / 180;
                    const x = 50 + 50 * Math.cos(rad);
                    const y = 50 + 50 * Math.sin(rad);
                    
                    return (
                      <g key={i} transform={`rotate(${rotation} 50 50)`}>
                        <path
                          d={`M 50 50 L 100 50 A 50 50 0 0 1 ${x} ${y} Z`}
                          fill={prize.color}
                          stroke="#00000040"
                          strokeWidth="0.2"
                        />
                        {/* Intelligent Label: Flips 180 if in bottom half so it's never upside down */}
                        <g transform={`rotate(${angle / 2} 50 50)`}>
                          <text
                            x="75"
                            y="50"
                            fill="white"
                            fontSize="4.5"
                            fontWeight="900"
                            transform={(rotation + angle/2 > 90 && rotation + angle/2 < 270) ? "rotate(180 75 50)" : ""}
                            className="uppercase tracking-tight"
                            textAnchor="middle"
                            dominantBaseline="central"
                            style={{ textShadow: '0px 1px 3px rgba(0,0,0,0.8)' }}
                          >
                            {prize.label}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </svg>
              </div>
              
              {/* Center Cap */}
              <div className="absolute w-14 h-14 bg-white rounded-full z-20 shadow-xl flex items-center justify-center border-4 border-gray-900">
                <Gift className="text-[#fb7701]" size={24} />
              </div>
            </div>

            <div className="space-y-4">
              {!result ? (
                <button
                  onClick={spin}
                  disabled={isSpinning || spinsLeft <= 0}
                  className="w-full bg-[#fb7701] text-white py-5 rounded-full font-black text-xl shadow-lg shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSpinning ? 'Good Luck...' : `SPIN NOW (${spinsLeft} LEFT)`}
                </button>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <div className="bg-orange-50 p-6 rounded-3xl border-2 border-orange-100 mb-6">
                    <h3 className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">Congratulations!</h3>
                    <p className="text-4xl font-black text-[#fb7701]">
                      {result.value === 'none' ? "SO CLOSE!" : result.label}
                    </p>
                    <p className="text-sm text-gray-500 mt-2 font-medium">
                      {result.value === 'none' ? "Better luck next time!" : "Your prize has been added to your profile."}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-full bg-gray-900 text-white py-4 rounded-full font-bold"
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SpinWheel;
