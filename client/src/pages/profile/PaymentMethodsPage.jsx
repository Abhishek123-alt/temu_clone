import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Plus, Trash2, ArrowLeft, ShieldCheck, Loader2, Edit2, X, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { toast } from '../../utils/toast';

const PaymentMethodsPage = () => {
  const navigate = useNavigate();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCardId, setEditingCardId] = useState(null);
  const [cardData, setCardData] = useState({
    brand: 'Visa',
    last4: '',
    exp_month: '',
    exp_year: '',
    is_default: false
  });
  const [submitting, setSubmitting] = useState(false);
  
  // Rich Delete Modal State
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      const res = await api.get('/user/payment-methods');
      setPaymentMethods(res.data);
    } catch (err) {
      toast.error("Failed to load payment methods");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCardId(null);
    setCardData({ brand: 'Visa', last4: '', exp_month: '', exp_year: '', is_default: false });
    setShowForm(true);
  };

  const handleOpenEdit = (method) => {
    setEditingCardId(method.id);
    setCardData({
      brand: method.brand,
      last4: method.last4,
      exp_month: method.exp_month.toString(),
      exp_year: method.exp_year.toString(),
      is_default: method.is_default
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cardData.last4.length !== 4) return toast.error("Last 4 digits must be 4 digits");
    
    setSubmitting(true);
    try {
      if (editingCardId) {
        await api.put(`/user/payment-methods/${editingCardId}`, cardData);
        toast.success("Card updated!");
      } else {
        await api.post('/user/payment-methods', cardData);
        toast.success("Card added!");
      }
      setShowForm(false);
      fetchPaymentMethods();
    } catch (err) {
      toast.error("Failed to save card");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/user/payment-methods/${deleteId}`);
      toast.success("Card removed");
      setPaymentMethods(prev => prev.filter(p => p.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      toast.error("Failed to remove card");
    }
  };

  const cardBrands = ['Visa', 'Mastercard', 'American Express', 'Discover'];

  return (
    <div className="bg-[#f8f9fa] min-h-screen py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 font-bold transition-colors"
        >
          <ArrowLeft size={20} /> Back to Profile
        </button>

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Payment Methods</h1>
            <p className="text-gray-500 font-medium">Manage your saved cards for faster checkout</p>
          </div>
          {paymentMethods && paymentMethods.length < 3 ? (
            <button
              onClick={handleOpenAdd}
              className="bg-[#fb7701] text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-[#e06a01] transition-all shadow-lg shadow-orange-200"
            >
              <Plus size={20} /> Add New Card
            </button>
          ) : paymentMethods && paymentMethods.length >= 3 ? (
            <div className="bg-orange-50 text-[#fb7701] px-4 py-2 rounded-full text-xs font-bold border border-orange-100 flex items-center gap-2">
              <ShieldCheck size={14} /> Maximum cards reached (3/3)
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence mode='popLayout'>
            {loading ? (
              <div className="col-span-full flex justify-center py-20">
                <Loader2 className="animate-spin text-[#fb7701]" size={40} />
              </div>
            ) : paymentMethods.length > 0 ? (
              paymentMethods.map((method) => (
                <motion.div
                  key={method.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 relative group overflow-hidden"
                >
                  <div className="flex justify-between items-start relative z-10">
                    <div className="space-y-4">
                      <div className="bg-gray-50 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-400 w-fit">
                        {method.brand}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center">
                          <CreditCard className="text-gray-400" size={20} />
                        </div>
                        <div className="text-xl font-mono font-bold tracking-tighter">
                          •••• •••• •••• {method.last4}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-gray-400">
                        Expires {method.exp_month.toString().padStart(2, '0')}/{method.exp_year}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleOpenEdit(method)}
                        className="p-2 text-gray-300 hover:text-[#fb7701] transition-colors"
                      >
                        <Edit2 size={20} />
                      </button>
                      <button
                        onClick={() => setDeleteId(method.id)}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                  {method.is_default && (
                    <div className="mt-4 flex items-center gap-1.5 text-[10px] font-black text-green-600 uppercase tracking-widest">
                      <ShieldCheck size={12} /> Default Method
                    </div>
                  )}
                  
                  {/* Decorative background circle */}
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-gray-50 rounded-full group-hover:scale-150 transition-transform duration-500" />
                </motion.div>
              ))
            ) : !showForm && (
              <div className="col-span-full bg-white rounded-[40px] py-20 text-center border-2 border-dashed border-gray-100">
                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CreditCard className="text-[#fb7701]" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Cards Saved</h3>
                <p className="text-gray-500 mb-8 max-w-xs mx-auto">Add a payment method to enjoy a seamless shopping experience.</p>
                <button
                  onClick={handleOpenAdd}
                  className="text-[#fb7701] font-black hover:underline"
                >
                  Add your first card now
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Add/Edit Modal */}
        <AnimatePresence>
          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowForm(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-[40px] w-full max-w-lg p-10 relative z-10 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-black">{editingCardId ? 'Edit Card' : 'Add New Card'}</h2>
                  <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-full">
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Card Brand</label>
                      <div className="grid grid-cols-2 gap-2">
                        {cardBrands.map(brand => (
                          <button
                            key={brand}
                            type="button"
                            onClick={() => setCardData({...cardData, brand})}
                            className={`p-3 rounded-2xl border-2 font-bold text-sm transition-all ${
                              cardData.brand === brand 
                                ? 'border-[#fb7701] bg-orange-50 text-[#fb7701]' 
                                : 'border-gray-100 hover:border-gray-200 text-gray-500'
                            }`}
                          >
                            {brand}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="col-span-full">
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Last 4 Digits</label>
                      <input
                        type="text"
                        maxLength="4"
                        placeholder="••••"
                        className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] focus:ring-0 transition-all font-mono font-bold text-xl"
                        value={cardData.last4}
                        onChange={(e) => setCardData({...cardData, last4: e.target.value.replace(/\D/g, '')})}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Exp Month</label>
                      <input
                        type="text"
                        placeholder="MM"
                        maxLength="2"
                        className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] focus:ring-0 transition-all font-bold"
                        value={cardData.exp_month}
                        onChange={(e) => setCardData({...cardData, exp_month: e.target.value.replace(/\D/g, '')})}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Exp Year</label>
                      <input
                        type="text"
                        placeholder="YYYY"
                        maxLength="4"
                        className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] focus:ring-0 transition-all font-bold"
                        value={cardData.exp_year}
                        onChange={(e) => setCardData({...cardData, exp_year: e.target.value.replace(/\D/g, '')})}
                        required
                      />
                    </div>

                    <div className="col-span-full flex items-center gap-3 mt-4">
                      <input
                        type="checkbox"
                        id="default-card"
                        className="w-5 h-5 rounded-lg border-2 border-gray-200 text-[#fb7701] focus:ring-[#fb7701]"
                        checked={cardData.is_default}
                        onChange={(e) => setCardData({...cardData, is_default: e.target.checked})}
                      />
                      <label htmlFor="default-card" className="text-sm font-bold text-gray-600">Set as default payment method</label>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="flex-1 px-8 py-4 rounded-full font-bold text-gray-500 hover:bg-gray-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-[2] bg-[#fb7701] text-white py-4 rounded-full font-bold text-lg hover:bg-[#e06a01] transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 className="animate-spin" /> : editingCardId ? "Update Card" : "Save Card"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Rich Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteId && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDeleteId(null)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-[40px] w-full max-w-sm p-10 relative z-10 shadow-2xl text-center"
              >
                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 text-[#fb7701]">
                  <AlertTriangle size={40} />
                </div>
                <h2 className="text-2xl font-black mb-4">Remove Card?</h2>
                <p className="text-gray-500 mb-8 font-medium">This card will be permanently deleted from your account. This action cannot be undone.</p>
                
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleDelete}
                    className="w-full bg-[#fb7701] text-white py-4 rounded-full font-bold hover:bg-[#e06a01] transition-all shadow-lg shadow-orange-100"
                  >
                    Yes, Delete Card
                  </button>
                  <button
                    onClick={() => setDeleteId(null)}
                    className="w-full bg-gray-50 text-gray-500 py-4 rounded-full font-bold hover:bg-gray-100 transition-all"
                  >
                    No, Keep it
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PaymentMethodsPage;
