import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, MapPin, CreditCard, ChevronRight } from 'lucide-react';
import api from '../../services/api';

const OrderDetailPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-10 h-10 border-4 border-[#fb7701] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!order) {
    return <div className="text-center py-20">Order not found</div>;
  }

  return (
    <div className="bg-gray-50 min-h-screen py-10">
      <div className="max-w-4xl mx-auto px-4">
        <button 
          onClick={() => navigate('/orders')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 font-bold transition-colors"
        >
          <ArrowLeft size={20} /> Back to Orders
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h1 className="text-2xl font-black text-gray-900">Order Details</h1>
                  <p className="text-gray-400 text-sm font-medium mt-1">ID: {order.id}</p>
                </div>
                <div className="bg-orange-50 text-[#fb7701] px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest">
                  {order.status}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Package size={20} className="text-gray-400" /> Items
                </h3>
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-4 items-center p-4 bg-gray-50 rounded-2xl">
                    <div className="w-16 h-16 bg-white rounded-xl overflow-hidden border border-gray-100">
                      {/* Note: In a real app we'd fetch product image here too */}
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                        <Package size={24} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">Product #{item.product_id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity} × ${item.price}</p>
                    </div>
                    <p className="font-black text-gray-900">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <MapPin size={18} className="text-gray-400" /> Shipping
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl">
                {order.shipping_address}
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <CreditCard size={18} className="text-gray-400" /> Summary
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>${order.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Shipping</span>
                  <span className="text-green-600 font-bold">FREE</span>
                </div>
                <div className="pt-3 border-t border-gray-50 flex justify-between items-baseline">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="text-xl font-black text-[#fb7701]">${order.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;
