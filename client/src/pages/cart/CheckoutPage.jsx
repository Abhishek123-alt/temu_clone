import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { motion } from 'framer-motion';
import { CreditCard, MapPin, ShieldCheck, ArrowRight, Loader2, Gift } from 'lucide-react';
import api from '../../services/api';

const CheckoutPage = () => {
  const { items, clearCart } = useCartStore();
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState(user?.addresses?.[0]?.street || '');
  const [selectedReward, setSelectedReward] = useState(null);

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shipping = subtotal > 20 ? 0 : 5.99;
  const tax = subtotal * 0.08;
  
  // Calculate Discount
  let discount = 0;
  if (selectedReward) {
    if (selectedReward.reward_type === 'coupon') {
      const percent = parseInt(selectedReward.value) || 0;
      discount = (subtotal * percent) / 100;
    } else if (selectedReward.reward_type === 'credit') {
      discount = parseFloat(selectedReward.value.replace('$', '')) || 0;
    } else if (selectedReward.reward_type === 'freeship') {
      discount = shipping;
    }
  }

  const total = Math.max(0, subtotal + shipping + tax - discount);

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!address.trim()) return alert("Please enter your shipping address");

    setLoading(true);
    try {
      // 1. Create order in backend
      const response = await api.post('/orders/', {
        shipping_address: address,
        total_amount: total,
        reward_id: selectedReward ? selectedReward.id : undefined
      });

      // 2. Clear frontend cart (local state only, backend is already cleared by order service)
      clearCart();

      // 3. Refresh User Data to remove the used coupon from state
      const userRes = await api.get('/user/me');
      setUser(userRes.data);

      // 4. Go to Payment
      navigate('/payment', { 
        state: { 
          orderId: response.data.id, 
          amount: total 
        } 
      });
    } catch (error) {
      console.error("Order failed:", error);
      alert("Checkout failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Your cart is empty</h2>
        <button onClick={() => navigate('/')} className="mt-4 text-[#fb7701] font-bold">Continue Shopping</button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-10">
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-3xl font-extrabold mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Address */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-[#fb7701]">
                    <MapPin size={20} />
                  </div>
                  <h2 className="text-xl font-bold">Shipping Address</h2>
                </div>
                {user?.addresses?.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => setAddress('')}
                    className="text-xs font-bold text-[#fb7701] hover:underline"
                  >
                    Use New Address
                  </button>
                )}
              </div>

              {user?.addresses?.length > 0 && !address.startsWith('CUSTOM:') && (
                <div className="grid grid-cols-1 gap-3 mb-6">
                  {user.addresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => setAddress(addr.street)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        address === addr.street 
                          ? 'border-[#fb7701] bg-orange-50' 
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <p className="font-bold text-sm">{user.full_name}</p>
                      <p className="text-xs text-gray-500 mt-1">{addr.street}</p>
                      <p className="text-[10px] text-gray-400">{addr.city}, {addr.state} {addr.zip}</p>
                    </button>
                  ))}
                </div>
              )}

              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter your full address (Street, City, Zip, Country)"
                className="w-full p-4 bg-gray-50 border-gray-200 rounded-xl focus:ring-[#fb7701] focus:border-[#fb7701] min-h-[120px]"
              />
            </div>

            {/* Payment Method */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                  <CreditCard size={20} />
                </div>
                <h2 className="text-xl font-bold">Payment Method</h2>
              </div>
              <div className="border-2 border-[#fb7701] bg-orange-50 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 bg-white rounded border flex items-center justify-center text-[10px] font-bold">STRIPE</div>
                  <div>
                    <p className="font-bold">Pay via Stripe</p>
                    <p className="text-xs text-gray-500">Supports Credit Card, Apple Pay, Google Pay</p>
                  </div>
                </div>
                <div className="w-5 h-5 rounded-full border-4 border-[#fb7701] bg-white"></div>
              </div>
              <p className="mt-4 text-xs text-gray-500 flex items-center gap-1">
                <ShieldCheck size={14} className="text-green-500" />
                Your payment information is encrypted and secure.
              </p>
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-6">
          {/* Rewards & Coupons Selection */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Gift size={20} className="text-[#fb7701]" /> Coupons & Offers
            </h3>
            
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {user?.rewards?.filter(r => !r.is_used).length > 0 ? (
                user.rewards.filter(r => !r.is_used).map((reward) => (
                  <button
                    key={reward.id}
                    onClick={() => setSelectedReward(selectedReward?.id === reward.id ? null : reward)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                      selectedReward?.id === reward.id 
                        ? 'border-[#fb7701] bg-orange-50' 
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-black text-[#fb7701] uppercase tracking-wider">{reward.reward_type}</p>
                        <p className="font-bold text-gray-900">{reward.value}</p>
                        <p className="text-[10px] font-mono text-gray-400 mt-1">{reward.code}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedReward?.id === reward.id ? 'border-[#fb7701]' : 'border-gray-200'
                      }`}>
                        {selectedReward?.id === reward.id && <div className="w-2.5 h-2.5 bg-[#fb7701] rounded-full" />}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">No coupons available. Go spin the wheel!</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 sticky top-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Order Summary</h2>
            <div className="space-y-4 text-gray-600 font-medium">
              <div className="flex justify-between">
                <span>Subtotal ({items.length} items)</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="text-green-600 font-bold">{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Tax</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600 font-bold">
                  <span>Discount</span>
                  <span>-${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xl font-bold text-gray-900">Order Total</span>
                <span className="text-3xl font-black text-[#fb7701]">${total.toFixed(2)}</span>
              </div>
            </div>
              <button
                onClick={handlePlaceOrder}
                disabled={loading}
                className="w-full mt-6 bg-[#fb7701] text-white py-4 rounded-full font-bold text-lg hover:bg-[#e06a01] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    Place Order <ArrowRight size={20} />
                  </>
                )}
              </button>

              <div className="mt-6 space-y-4">
                <div className="bg-green-50 p-3 rounded-lg flex items-start gap-3">
                  <ShieldCheck size={18} className="text-green-600 mt-0.5" />
                  <p className="text-[10px] text-green-800">
                    <strong>Temu Purchase Protection</strong><br/>
                    Shop with confidence. Your order is protected from checkout to delivery.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
