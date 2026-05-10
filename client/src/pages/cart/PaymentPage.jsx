import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Smartphone, ShieldCheck, CheckCircle2, ArrowLeft } from 'lucide-react';
import api from '../../services/api';

const PaymentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId, amount } = location.state || {};
  
  const [upiId, setUpiId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!upiId.includes('@')) return alert("Please enter a valid UPI ID (e.g., user@upi)");

    setProcessing(true);
    // Simulate payment processing
    setTimeout(async () => {
      try {
        // Update the order status to PAID in the backend
        await api.put(`/orders/${orderId}/status?status=paid`); 
        
        setSuccess(true);
        setTimeout(() => {
          navigate('/orders');
        }, 2000);
      } catch (error) {
        console.error("Payment update failed:", error);
        alert("Payment was successful but could not update order status.");
      } finally {
        setProcessing(false);
      }
    }, 2000);
  };

  if (!orderId) {
    return <div className="text-center py-20">Invalid Payment Session</div>;
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
            <CheckCircle2 size={60} />
          </div>
          <h1 className="text-3xl font-black mb-2">Payment Successful!</h1>
          <p className="text-gray-500">Redirecting to your orders...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9fa] min-h-screen py-12">
      <div className="max-w-md mx-auto px-4">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 font-bold transition-colors"
        >
          <ArrowLeft size={20} /> Back
        </button>

        <div className="bg-white rounded-[32px] shadow-xl overflow-hidden">
          <div className="bg-[#fb7701] p-8 text-white text-center">
            <p className="text-orange-100 text-sm font-bold uppercase tracking-widest mb-1">Total Amount</p>
            <h2 className="text-4xl font-black">${amount?.toFixed(2)}</h2>
          </div>

          <form onSubmit={handlePayment} className="p-8">
            <div className="flex items-center gap-4 mb-8 p-4 bg-orange-50 rounded-2xl border border-orange-100">
              <Smartphone className="text-[#fb7701]" size={24} />
              <div>
                <p className="text-sm font-bold text-gray-900">UPI Payment</p>
                <p className="text-xs text-gray-500">Pay using any UPI app (GPay, PhonePe, etc.)</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Enter UPI ID</label>
                <input
                  type="text"
                  placeholder="yourname@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] focus:ring-0 transition-all font-bold text-lg"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full bg-[#fb7701] text-white py-4 rounded-full font-bold text-lg hover:bg-[#e06a01] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Processing...
                  </>
                ) : `Pay $${amount?.toFixed(2)}`}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 font-medium">
                <ShieldCheck size={16} className="text-green-500" />
                Secure 256-bit SSL Encrypted Payment
              </div>
            </div>
          </form>

          <div className="bg-gray-50 p-6 border-t border-gray-100">
            <div className="flex justify-center gap-6 grayscale opacity-50">
              <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" className="h-4" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" className="h-4" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg" className="h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
