import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Package, MapPin, CreditCard, ChevronRight, Truck, CheckCircle2, Clock, AlertCircle, RotateCcw } from 'lucide-react';
import api from '../../services/api';
import ReviewModal from '../../components/reviews/ReviewModal';

const OrderDetailPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewProductId, setReviewProductId] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState("");
  const [otherReason, setOtherReason] = useState("");

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setOrder(response.data);
    } catch (error) {
      console.error("Failed to fetch order details:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const handleReturnRequest = async () => {
    const finalReason = returnReason === 'other' ? `Other: ${otherReason}` : returnReason;
    if (!finalReason || returnItems.length === 0) return;
    
    try {
      await api.post(`/orders/${orderId}/returns`, {
        reason: finalReason,
        items: returnItems.map(id => ({ order_item_id: id, quantity: 1 }))
      });
      setShowReturnModal(false);
      setReturnReason("");
      setOtherReason("");
      fetchOrder(); 
    } catch (error) {
      console.error("Return failed:", error);
      alert(error.response?.data?.detail || "Failed to request return. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-[#fb7701] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20 bg-gray-50 min-h-screen">
        <div className="bg-white p-10 rounded-3xl shadow-sm inline-block">
          <AlertCircle size={48} className="text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Order not found</h2>
          <button onClick={() => navigate('/orders')} className="mt-6 text-[#fb7701] font-bold">Return to orders</button>
        </div>
      </div>
    );
  }

  const baseSteps = [
    { status: 'pending', label: 'Placed', icon: Clock },
    { status: 'paid', label: 'Paid', icon: CreditCard },
    { status: 'packed', label: 'Packed', icon: Package },
    { status: 'shipped', label: 'In Transit', icon: Truck },
    { status: 'delivered', label: 'Delivered', icon: CheckCircle2 },
  ];

  const returnFlowSteps = [
    { status: 'delivered', label: 'Delivered', icon: CheckCircle2 },
    { status: 'return_requested', label: 'Return Req.', icon: RotateCcw },
    { status: 'return_approved', label: 'Approved', icon: CheckCircle2 },
    { status: 'returned', label: 'Returned', icon: Package },
    { status: 'refunded', label: 'Refunded', icon: CreditCard },
  ];

  const isReturnFlow = ['return_requested', 'return_approved', 'return_rejected', 'returned', 'refunded'].includes(order.status);
  const steps = isReturnFlow ? returnFlowSteps : baseSteps;
  const currentStepIndex = steps.findIndex(s => s.status === order.status);
  const isCancelled = order.status === 'cancelled' || order.status === 'payment_failed' || order.status === 'return_rejected';

  return (
    <div className="bg-gray-50 min-h-screen pb-20 pt-6">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <button 
          onClick={() => navigate('/orders')}
          className="group flex items-center gap-2 text-gray-400 hover:text-gray-900 mb-8 font-bold transition-all"
        >
          <div className="w-8 h-8 bg-white rounded-full shadow-sm flex items-center justify-center group-hover:bg-[#fb7701] group-hover:text-white transition-all">
            <ArrowLeft size={16} />
          </div>
          Back to My Orders
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Real-time Tracking Header */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Truck size={120} />
              </div>
              
              <div className="flex justify-between items-start mb-10 relative z-10">
                <div>
                  <h1 className="text-3xl font-black text-gray-900 tracking-tight">Track Order</h1>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-gray-400 text-sm font-medium">Order ID:</span>
                    <span className="bg-gray-100 px-2 py-0.5 rounded-md text-xs font-mono text-gray-600">{order.id}</span>
                  </div>
                </div>
                {!isCancelled && (
                   <div className="bg-green-50 text-green-600 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Live Updates
                  </div>
                )}
              </div>

              {/* Stepper */}
              <div className="relative z-10">
                {isCancelled ? (
                  <div className="bg-red-50 p-6 rounded-2xl flex items-center gap-4 text-red-600 border border-red-100">
                    <AlertCircle size={24} />
                    <div>
                      <p className="font-black uppercase tracking-tight text-sm">Order {order.status.replace('_', ' ')}</p>
                      <p className="text-sm opacity-80">
                        {order.status === 'return_rejected' 
                          ? "Your return request was not approved by the seller." 
                          : "This order will not be processed further."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center relative px-2">
                    {/* Progress Bar Background */}
                    <div className="absolute h-1 bg-gray-100 top-1/2 -translate-y-1/2 left-10 right-10 z-0" />
                    {/* Active Progress Bar */}
                    <motion.div 
                      className="absolute h-1 bg-[#fb7701] top-1/2 -translate-y-1/2 left-10 z-0"
                      initial={{ width: 0 }}
                      animate={{ width: `${(currentStepIndex / (steps.length - 1)) * 80}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />

                    {steps.map((step, idx) => {
                      const Icon = step.icon;
                      const isCompleted = idx <= currentStepIndex;
                      const isCurrent = idx === currentStepIndex;
                      
                      return (
                        <div key={step.status} className="flex flex-col items-center gap-3 relative z-10">
                          <motion.div 
                            className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-colors ${
                              isCompleted ? 'bg-[#fb7701] border-white text-white shadow-lg shadow-[#fb7701]/20' : 'bg-white border-gray-100 text-gray-300'
                            }`}
                            initial={isCurrent ? { scale: 1 } : { scale: 1 }}
                            animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                            transition={{ repeat: isCurrent ? Infinity : 0, duration: 2 }}
                          >
                            <Icon size={20} />
                          </motion.div>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'text-gray-900' : 'text-gray-300'}`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Shipment Info if Available */}
              {order.shipments && order.shipments.length > 0 && (
                <div className="mt-12 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Carrier</p>
                      <p className="font-bold text-gray-900">{order.shipments[0].carrier}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tracking Number</p>
                      <p className="font-mono text-sm font-bold text-[#fb7701]">{order.shipments[0].tracking_number}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 font-medium">Last Location: <span className="text-gray-900 font-bold">{order.shipments[0].last_location || 'Warehouse'}</span></p>
                  </div>
                </div>
              )}
            </div>

            {/* Items Card */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
              <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                <Package size={22} className="text-gray-400" /> Order Items
              </h3>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-6 items-center p-5 bg-gray-50 rounded-3xl hover:bg-gray-100 transition-colors group">
                    <div className="w-20 h-20 bg-white rounded-2xl overflow-hidden border border-gray-100 p-1 shadow-sm group-hover:scale-105 transition-transform">
                      {item.product_image ? (
                        <img src={item.product_image} alt={item.product_title} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">
                          <Package size={28} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{item.product_title || `Product #${item.product_id.slice(0, 8)}`}</p>
                      <p className="text-sm text-gray-500 font-medium mt-1">Qty: {item.quantity} × ${item.price.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-gray-900 text-lg">${(item.price * item.quantity).toFixed(2)}</p>
                        <div className="flex flex-col gap-2 mt-2">
                           {order.status === 'delivered' && (
                             <button
                               onClick={() => {
                                 setReturnItems([item.id]);
                                 setShowReturnModal(true);
                               }}
                               className="bg-white border-2 border-gray-100 text-gray-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all active:scale-95 shadow-sm"
                             >
                               Return Item
                             </button>
                           )}
                           <button
                             onClick={() => {
                               setReviewProductId(item.product_id);
                               setShowReviewModal(true);
                             }}
                             className="bg-[#fb7701] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all active:scale-95 shadow-sm"
                           >
                             Write Review
                           </button>
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Delivery Info */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
              <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                <MapPin size={16} className="text-[#fb7701]" /> Delivery Address
              </h3>
              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <p className="text-sm text-gray-700 font-medium leading-relaxed">
                  {order.shipping_address}
                </p>
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
              <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                <CreditCard size={16} className="text-[#fb7701]" /> Payment Summary
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-medium">Subtotal</span>
                  <span className="text-gray-900 font-bold">${order.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-medium">Shipping</span>
                  <span className="text-green-600 font-black uppercase text-[10px] tracking-widest bg-green-50 px-2 py-1 rounded">Free</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-medium">Tax</span>
                  <span className="text-gray-900 font-bold">$0.00</span>
                </div>
                <div className="pt-4 border-t border-gray-100 flex justify-between items-baseline">
                  <span className="font-black text-gray-900 uppercase text-xs">Total</span>
                  <span className="text-3xl font-black text-[#fb7701]">${order.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Support/Actions */}
            <div className="bg-[#fb7701] p-8 rounded-[2rem] shadow-lg shadow-[#fb7701]/20 text-white relative overflow-hidden">
               <div className="absolute -bottom-4 -right-4 opacity-10">
                <RotateCcw size={100} />
              </div>
              <h3 className="font-black text-white mb-2 relative z-10">Need Help?</h3>
              <p className="text-sm text-white/80 mb-6 relative z-10">Our support team is available 24/7 to help with your delivery.</p>
              <button className="w-full bg-white text-[#fb7701] py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-100 transition-colors relative z-10">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Return Modal */}
      <AnimatePresence>
        {showReturnModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReturnModal(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-[#fb7701]" />
              <h2 className="text-2xl font-black text-gray-900 mb-2">Request Return</h2>
              <p className="text-gray-500 text-sm mb-8 font-medium">Please let us know why you want to return this item.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Reason for return</label>
                  <select 
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold text-gray-700 focus:border-[#fb7701] outline-none transition-all appearance-none"
                  >
                    <option value="">Select a reason...</option>
                    <option value="damaged">Damaged or defective</option>
                    <option value="wrong_item">Received wrong item</option>
                    <option value="no_longer_needed">No longer needed</option>
                    <option value="found_better_price">Found better price</option>
                    <option value="other">Other</option>
                  </select>

                  {returnReason === 'other' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4"
                    >
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Please specify</label>
                      <textarea 
                        value={otherReason}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold text-gray-700 focus:border-[#fb7701] outline-none transition-all min-h-[100px]"
                        placeholder="Type your reason here..."
                        onChange={(e) => setOtherReason(e.target.value)}
                      />
                    </motion.div>
                  )}
                </div>

                <div className="flex gap-4">
                   <button 
                    onClick={() => setShowReturnModal(false)}
                    className="flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleReturnRequest}
                    disabled={!returnReason}
                    className="flex-1 bg-[#fb7701] py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-lg shadow-[#fb7701]/20 disabled:opacity-50 disabled:shadow-none transition-all"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {showReviewModal && (
          <ReviewModal 
            productId={reviewProductId} 
            onClose={() => setShowReviewModal(false)}
            onReviewSubmitted={() => {
              setShowReviewModal(false);
              fetchOrder();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrderDetailPage;
