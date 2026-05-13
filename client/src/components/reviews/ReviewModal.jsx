import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, X } from 'lucide-react';
import api from '../../services/api';

const ReviewModal = ({ productId, onClose, onReviewSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Please select a rating.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/reviews/`, {
        product_id: productId,
        rating: rating,
        comment: comment,
      });
      onReviewSubmitted();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative z-10 overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-[#fb7701]" />
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-gray-900">Write a Review</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Rating</label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => setRating(num)}
                  className={`transition-all transform hover:scale-110 ${rating >= num ? 'text-yellow-400' : 'text-gray-200'}`}
                >
                  <Star size={32} fill={rating >= num ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Your Experience</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you like or dislike about the product?"
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-medium text-gray-700 focus:border-[#fb7701] outline-none transition-all min-h-[120px]"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-[#fb7701] py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-lg shadow-[#fb7701]/20 disabled:opacity-50 transition-all active:scale-95"
          >
            {submitting ? "Submitting..." : "Post Review"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ReviewModal;
