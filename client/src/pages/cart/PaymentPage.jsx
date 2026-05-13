import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Smartphone, ShieldCheck, CheckCircle2, ArrowLeft, CreditCard } from 'lucide-react';
import api from '../../services/api';
import { toast } from '../../utils/toast';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';

const PaymentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCartStore();
  const { setUser } = useAuthStore();
  const { amount, paymentMethod, checkoutDetails } = location.state || {};
  
  const [upiId, setUpiId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePayment = async (e) => {
    e.preventDefault();
    
    // Validate if UPI is being used
    if (!paymentMethod && !upiId.includes('@')) {
      return toast.error("Please enter a valid UPI ID (e.g., user@upi)");
    }

    setProcessing(true);
    // Simulate payment processing
    setTimeout(async () => {
      try {
        // 1. Create the actual order now that payment is "done"
        const response = await api.post('/orders/', checkoutDetails);
        const orderId = response.data.id;

        // 2. Update the order status to PAID in the backend
        await api.put(`/orders/${orderId}/status`, { status: 'paid' }); 
        
        // 3. Clear frontend cart
        clearCart();

        // 4. Refresh User Data (for coupons used)
        const userRes = await api.get('/user/me');
        setUser(userRes.data);
        
        setSuccess(true);
        toast.success("Payment successful!");
        setTimeout(() => {
          navigate('/orders');
        }, 2000);
      } catch (error) {
        console.error("Payment flow failed:", error);
        toast.error("Order creation failed after payment. Please contact support.");
      } finally {
        setProcessing(false);
      }
    }, 2000);
  };

  if (!checkoutDetails) {
    return <div className="text-center py-20 font-bold text-gray-400">Invalid Payment Session</div>;
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
          <p className="text-gray-500 font-medium">Redirecting to your orders...</p>
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

        <div className="bg-white rounded-[32px] shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-[#fb7701] p-10 text-white text-center relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-orange-100 text-xs font-black uppercase tracking-[0.2em] mb-2">Total Amount</p>
              <h2 className="text-5xl font-black">${amount?.toFixed(2)}</h2>
            </div>
            {/* Decorative background element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          </div>

          <form onSubmit={handlePayment} className="p-8">
            {paymentMethod && paymentMethod.type !== 'upi' ? (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Selected Card</h3>
                  <button 
                    type="button"
                    onClick={() => navigate('/checkout')}
                    className="text-[10px] font-black text-[#fb7701] hover:underline uppercase tracking-widest"
                  >
                    Change
                  </button>
                </div>
                <div className="flex items-center gap-4 p-5 bg-blue-50 rounded-[24px] border border-blue-100">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900 uppercase tracking-wider">{paymentMethod.brand} Card</p>
                    <p className="text-xs text-blue-600 font-bold">•••• •••• •••• {paymentMethod.last4}</p>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-6 rounded-[24px] space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 font-bold">Account Holder</span>
                    <span className="text-gray-900 font-black">Verified Customer</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 font-bold">Expires</span>
                    <span className="text-gray-900 font-black">{paymentMethod.exp_month}/{paymentMethod.exp_year}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-5 bg-orange-50 rounded-[24px] border border-orange-100">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#fb7701] shadow-sm">
                    <Smartphone size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900 uppercase tracking-wider">UPI Payment</p>
                    <p className="text-xs text-orange-600 font-bold">Pay via GPay, PhonePe, etc.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Enter UPI ID</label>
                  <input
                    type="text"
                    placeholder="yourname@upi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-[24px] focus:border-[#fb7701] focus:ring-0 transition-all font-bold text-lg"
                    required
                  />
                </div>
              </div>
            )}

            <div className="mt-8 space-y-6">
              <button
                type="submit"
                disabled={processing}
                className="w-full bg-[#fb7701] text-white py-5 rounded-full font-black text-xl hover:bg-[#e06a01] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl shadow-orange-100 disabled:opacity-50"
              >
                {processing ? (
                  <>
                    <span className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></span>
                    Processing...
                  </>
                ) : (
                  paymentMethod ? `Confirm Pay $${amount?.toFixed(2)}` : `Pay $${amount?.toFixed(2)}`
                )}
              </button>

              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-xs text-green-600 font-black uppercase tracking-widest">
                  <ShieldCheck size={16} />
                  Secure SSL Encrypted
                </div>
                <p className="text-[10px] text-gray-400 font-bold text-center px-4">
                  By clicking Pay, you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>
            </div>
          </form>

          <div className="bg-gray-50 p-8 border-t border-gray-100">
            <div className="flex justify-center gap-8 grayscale opacity-30">
              <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" className="h-4" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" className="h-4" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" className="h-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
