import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Package, Truck, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import api from '../../services/api';

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
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
    fetchOrders();
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return <Clock className="text-blue-500" />;
      case 'shipped': return <Truck className="text-orange-500" />;
      case 'delivered': return <CheckCircle className="text-green-500" />;
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
              className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
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
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Order ID</p>
                    <p className="text-xs font-mono font-bold text-gray-400">{order.id.slice(0, 8)}...</p>
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
    </div>
  );
};

export default OrdersPage;
