import React, { useEffect } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';

const CartPage = () => {
  const { items, fetchCart, updateQuantity, removeItem, getTotalPrice, getTotalItems } = useCartStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) fetchCart();
  }, [isAuthenticated]);

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigate('/login?next=/checkout');
      return;
    }
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
          <ShoppingBag size={48} />
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900">Your cart is empty</h2>
        <p className="text-gray-500 mt-2 mb-8">Items you add to your cart will appear here.</p>
        <Link to="/" className="btn-primary py-4 px-10">Start Shopping</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-6">Shopping Cart ({getTotalItems()})</h1>

      {!isAuthenticated && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-orange-100 bg-orange-50 p-5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-100">
              <Lock size={18} className="text-[#fb7701]" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[#fb7701]">
                Sign in to checkout
              </p>
              <p className="mt-1 text-sm font-medium text-orange-700">
                Your items are saved on this device. Create a free account or sign in to complete your purchase.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              to="/login?next=/checkout"
              className="rounded-full bg-[#fb7701] px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600 transition-all"
            >
              Sign In
            </Link>
            <Link
              to="/register?next=/checkout"
              className="rounded-full border border-orange-200 bg-white px-5 py-2.5 text-sm font-bold text-[#fb7701] hover:bg-orange-50 transition-all"
            >
              Join Free
            </Link>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Cart Items List */}
        <div className="lg:col-span-2 space-y-6">
          {items.map((item) => (
            <motion.div 
              key={item.id}
              layout
              className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex gap-6"
            >
              <div className="w-32 h-32 rounded-2xl overflow-hidden bg-gray-50 shrink-0">
                <img 
                  src={item.product.images[0]?.url} 
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-gray-900 text-lg line-clamp-1">{item.product.title}</h3>
                    <button 
                      onClick={() => removeItem(item.product.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">Ships from: Temu Express</p>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center border border-gray-200 rounded-full p-1">
                    <button 
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 rounded-full text-gray-500"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-10 text-center font-bold text-gray-900">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 rounded-full text-gray-500"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-gray-900">${(item.product.price * item.quantity).toFixed(2)}</p>
                    <p className="text-xs text-gray-400 font-bold">${item.product.price} each</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 sticky top-32">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h3>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-gray-500 font-medium">
                <span>Subtotal</span>
                <span>${getTotalPrice()}</span>
              </div>
              <div className="flex justify-between text-gray-500 font-medium">
                <span>Shipping</span>
                <span className="text-green-500 font-bold">FREE</span>
              </div>
              <div className="flex justify-between text-gray-500 font-medium">
                <span>Estimated Tax</span>
                <span>$0.00</span>
              </div>
              <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Total</span>
                <span className="text-3xl font-black text-[#fb7701]">${getTotalPrice()}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-2"
            >
              {isAuthenticated ? (
                <>Checkout Now <ArrowRight size={20} /></>
              ) : (
                <><Lock size={18} /> Sign in to Checkout</>
              )}
            </button>

            <div className="mt-6 flex flex-wrap gap-2 justify-center opacity-40 grayscale">
              <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" className="h-4" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" className="h-4" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" className="h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
