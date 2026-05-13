import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Package, Truck, CheckCircle, Clock, ChevronRight, XCircle, RotateCcw, X, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { toast } from '../../utils/toast';
import ConfirmModal from '../../components/common/ConfirmModal';

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [returnReason, setReturnReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const fetchOrders = async () => {
    try {
      const response = await api.get('/orders/');
      setOrders(response.data);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Set up real-time polling (every 5 seconds)
    const interval = setInterval(() => {
      fetchOrders();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleCancelOrder = async () => {
    setIsProcessing(true);
    try {
      await api.put(`/orders/${selectedOrderId}/status`, { status: 'cancelled', reason: 'User cancelled' });
      toast.success("Order cancelled successfully");
      setIsCancelModalOpen(false);
      fetchOrders();
    } catch (error) {
      toast.error("Failed to cancel order");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestReturn = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await api.post(`/orders/${selectedOrderId}/returns`, { reason: returnReason });
      toast.success("Return requested successfully");
      setIsReturnModalOpen(false);
      setReturnReason('');
      fetchOrders();
    } catch (error) {
      toast.error("Failed to request return");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return <Clock className="text-blue-500" />;
      case 'shipped': return <Truck className="text-orange-500" />;
      case 'delivered': return <CheckCircle className="text-green-500" />;
      case 'cancelled': return <XCircle className="text-red-500" />;
      default: return <Package className="text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-10 h-10 border-4 border-[#fb7701] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold mb-8">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-3xl">
          <Package size={64} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">You haven't placed any orders yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <motion.div 
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden group"
            >
              <div className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(order.status)}
                    <div>
                      <p className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                        Order Status: {order.status}
                      </p>
                      <p className="text-xs text-gray-500">
                        Placed on {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className="px-4 py-2 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all flex items-center gap-2"
                    >
                      View Details <ChevronRight size={14} />
                    </button>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">Order ID</p>
                      <p className="text-xs font-mono font-bold text-gray-400">{order.id.slice(0, 8)}...</p>
                    </div>
                    {order.status === 'paid' && (
                      <button 
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          setIsCancelModalOpen(true);
                        }}
                        className="px-4 py-2 border-2 border-red-100 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-50 transition-all flex items-center gap-2"
                      >
                        <XCircle size={14} /> Cancel Order
                      </button>
                    )}
                    {order.status === 'delivered' && (
                      <button 
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          setIsReturnModalOpen(true);
                        }}
                        className="px-4 py-2 border-2 border-orange-100 text-[#fb7701] text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-50 transition-all flex items-center gap-2"
                      >
                        <RotateCcw size={14} /> Request Return
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-end border-t border-gray-50 pt-6">
                  <div className="text-sm text-gray-600">
                    <p className="font-bold text-gray-900 mb-1">Shipping to:</p>
                    <p className="line-clamp-1 max-w-xs">{order.shipping_address}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 mb-1">Total Amount</p>
                    <p className="text-xl font-extrabold text-[#fb7701]">${order.total_amount.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-6 py-4 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500">{order.items.length} items</span>
                <button 
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="text-[#fb7701] text-xs font-bold flex items-center gap-1 hover:underline"
                >
                  View Details <ChevronRight size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      <ConfirmModal 
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleCancelOrder}
        title="Cancel this order?"
        message="Are you sure you want to cancel this order? This action cannot be undone and your payment will be refunded."
        confirmText={isProcessing ? "Processing..." : "Yes, Cancel Order"}
        cancelText="No, Keep Order"
        type="danger"
      />
      <AnimatePresence>
        {isReturnModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReturnModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl p-10 w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-gray-900">Request Return</h2>
                <button onClick={() => setIsReturnModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleRequestReturn} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Reason for Return</label>
                  <select 
                    required
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] outline-none font-bold"
                  >
                    <option value="" disabled>Select a reason</option>
                    <option value="wrong_item">Wrong Item Received</option>
                    <option value="damaged">Damaged or Defective</option>
                    <option value="not_as_described">Not as Described</option>
                    <option value="better_price">Found Better Price Elsewhere</option>
                    <option value="changed_mind">No Longer Needed / Changed Mind</option>
                  </select>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={isProcessing}
                    className="w-full bg-[#fb7701] text-white py-4 rounded-2xl font-bold hover:bg-[#e06a01] transition-all shadow-xl shadow-orange-100 disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {isProcessing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Submit Request
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrdersPage;

