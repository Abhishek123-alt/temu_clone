import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const Toast = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (e) => {
      const { message, type = 'success', duration = 3000 } = e.detail;
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    };

    window.addEventListener('toast', handleToast);
    return () => window.removeEventListener('toast', handleToast);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`pointer-events-auto flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border ${
              toast.type === 'success' 
                ? 'bg-white/90 border-green-100 text-green-900' 
                : toast.type === 'error'
                ? 'bg-white/90 border-red-100 text-red-900'
                : 'bg-white/90 border-blue-100 text-blue-900'
            }`}
          >
            <div className={`p-2 rounded-full ${
              toast.type === 'success' ? 'bg-green-100 text-green-600' :
              toast.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
            }`}>
              {toast.type === 'success' && <CheckCircle2 size={20} />}
              {toast.type === 'error' && <AlertCircle size={20} />}
              {toast.type === 'info' && <Info size={20} />}
            </div>
            
            <p className="font-bold text-sm leading-tight">{toast.message}</p>
            
            <button 
              onClick={() => removeToast(toast.id)}
              className="ml-2 p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
            >
              <X size={16} />
            </button>
            
            <motion.div 
              initial={{ width: '100%' }}
              animate={{ width: 0 }}
              transition={{ duration: 3, ease: 'linear' }}
              className={`absolute bottom-0 left-0 h-1 ${
                toast.type === 'success' ? 'bg-green-500' :
                toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
              }`}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Toast;
