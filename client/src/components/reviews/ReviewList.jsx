import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import api from '../../services/api';

const ReviewList = ({ productId, onStats }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!productId) return;
      try {
        const response = await api.get(`/reviews/product/${productId}`);
        setReviews(response.data);
        if (onStats) {
          const count = response.data.length;
          const average = count
            ? response.data.reduce((sum, r) => sum + r.rating, 0) / count
            : 0;
          onStats({ count, average });
        }
      } catch (error) {
        console.error("Failed to fetch reviews:", error);
        if (onStats) onStats({ count: 0, average: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, [productId, onStats]);

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <h3 className="text-3xl font-black text-gray-900 tracking-tight">Customer Reviews</h3>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2 bg-[#fb7701]/10 px-4 py-2 rounded-full">
            <Star size={16} className="text-[#fb7701]" fill="currentColor" />
            <span className="font-bold text-[#fb7701]">{reviews.length} total reviews</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-200">
          <div className="w-12 h-12 border-4 border-[#fb7701] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Loading reviews...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-200">
          <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">No reviews yet. Be the first to share your experience!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {reviews.map((review) => (
          <div key={review.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                  {review.user_avatar ? (
                    <img src={review.user_avatar} alt={review.user_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 text-xs font-bold">
                      {review.user_name?.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{review.user_name}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Verified Purchase</p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-full">
                <Star size={12} className="text-yellow-400" fill="currentColor" />
                <span className="text-xs font-bold text-yellow-700">{review.rating}</span>
              </div>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed italic">"{review.comment || "No comment provided."}"</p>
            <p className="text-[10px] text-gray-400 mt-4 font-medium">
              {new Date(review.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
        </div>
      )}
    </div>
  );
};

export default ReviewList;
