import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", type = "danger" }) => {
  if (!isOpen) return null;

  const themes = {
    danger: {
      icon: <AlertCircle className="text-red-500" size={24} />,
      bg: "bg-red-50",
      button: "bg-red-500 hover:bg-red-600 shadow-red-100",
    },
    warning: {
      icon: <AlertCircle className="text-amber-500" size={24} />,
      bg: "bg-amber-50",
      button: "bg-amber-500 hover:bg-amber-600 shadow-amber-100",
    },
    info: {
      icon: <AlertCircle className="text-blue-500" size={24} />,
      bg: "bg-blue-50",
      button: "bg-blue-500 hover:bg-blue-600 shadow-blue-100",
    },
    primary: {
      icon: <AlertCircle className="text-[#fb7701]" size={24} />,
      bg: "bg-orange-50",
      button: "bg-[#fb7701] hover:bg-[#e06a01] shadow-orange-100",
    }
  };

  const theme = themes[type] || themes.danger;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        {/* Modal Card */}
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden border border-gray-100"
        >
          {/* Header/Icon */}
          <div className={`p-8 pb-4 flex flex-col items-center text-center`}>
            <div className={`w-16 h-16 ${theme.bg} rounded-full flex items-center justify-center mb-4`}>
              {theme.icon}
            </div>
            <h3 className="text-2xl font-black text-gray-900 leading-tight">
              {title}
            </h3>
            <p className="mt-3 text-gray-500 font-medium leading-relaxed px-4">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="p-8 pt-4 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-95"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-6 py-4 text-white rounded-2xl font-bold transition-all shadow-lg active:scale-95 ${theme.button}`}
            >
              {confirmText}
            </button>
          </div>

          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-900 rounded-full hover:bg-gray-50 transition-all"
          >
            <X size={20} />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConfirmModal;
