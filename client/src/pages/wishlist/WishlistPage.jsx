import React from 'react';
import WishlistSection from '../../components/profile/WishlistSection';
import { motion } from 'framer-motion';

const WishlistPage = () => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <WishlistSection />
      </motion.div>
    </div>
  );
};

export default WishlistPage;
