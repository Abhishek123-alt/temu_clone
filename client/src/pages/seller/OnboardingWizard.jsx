import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store,
  Building2,
  Truck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Upload,
  AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import { toast } from '../../utils/toast';
import { useAuthStore } from '../../store/authStore';

const OnboardingWizard = () => {
  const navigate = useNavigate();
  const { user, setUser, setAuth, logout } = useAuthStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    store_name: '',
    category: '',
    description: '',
    logo_url: '',
    banner_url: '',
    tax_id: '',
    business_type: 'Individual',
    warehouse_address: '',
    // Guest registration fields
    email: '',
    password: '',
    full_name: '',
  });

  React.useEffect(() => {
    const ensureSellerPending = async () => {
      if (user?.role === 'CUSTOMER') {
        try {
          const res = await api.post('/user/me/become-seller');
          setUser({ ...user, role: res.data.role });
        } catch (err) {
          toast.error("Failed to initialize seller profile");
          navigate('/profile');
        }
      } else if (user?.role === 'SELLER') {
        toast.info("You are already a seller!");
        navigate('/seller');
      } else if (user?.role === 'ADMIN') {
        navigate('/admin');
      }
    };

    if (user) ensureSellerPending();
  }, [user, setUser, navigate]);

  const businessTypes = ['Individual', 'Sole Proprietorship', 'LLC', 'Corporation'];

  const validateStep = () => {
    if (step === 1) {
      if (!user) {
        if (!formData.email || !formData.password || !formData.full_name) {
          toast.error("Please fill in all account details");
          return false;
        }
        if (formData.password.length < 6) {
          toast.error("Password must be at least 6 characters");
          return false;
        }
      }
      if (!formData.store_name || !formData.category || !formData.description) {
        toast.error("Please fill in all store identity details");
        return false;
      }
    } else if (step === 2) {
      if (!formData.tax_id || !formData.business_type) {
        toast.error("Please provide your business verification details");
        return false;
      }
      if (formData.tax_id.length < 5) {
        toast.error("Invalid Tax ID format");
        return false;
      }
    } else if (step === 3) {
      if (!formData.warehouse_address || formData.warehouse_address.length < 10) {
        toast.error("Please provide a complete warehouse address (min 10 characters)");
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep(s => s + 1);
    }
  };
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Only allow submission on the final review step
    if (step !== 4) return;
    
    setLoading(true);
    try {
      if (!user) {
        // Register and then submit application
        const regRes = await api.post('/auth/register', {
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          requested_role: 'SELLER_PENDING'
        });
        
        const { user: newUser, access_token: token } = regRes.data;
        
        // Use the token to submit the application, but DON'T log them into the app
        await api.post('/store/application', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        toast.success("Account created and application submitted!");
        setStep(5); // Move to a new 'Success' step
        return;
      } else {
        await api.post('/store/application', formData);
        
        // If they were a customer, they are now SELLER_PENDING and should be logged out
        // because they need to be inactive until approved.
        toast.success("Your store application has been submitted successfully!");
        logout(); // From authStore
        setStep(5);
        return;
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Application submission failed");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-[#f6f6f6] px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-3xl w-full bg-white rounded-[32px] shadow-xl p-10 border border-gray-50"
      >
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900">Store Onboarding</h2>
            <p className="text-gray-500 font-medium mt-1">Complete your business profile to start selling</p>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`w-3 h-3 rounded-full transition-all ${step === s ? 'bg-[#fb7701] w-6' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-6 text-gray-400">
                  <Store size={24} />
                  <span className="font-bold uppercase tracking-widest text-xs">Step 1: Store Identity</span>
                </div>

                {!user && (
                  <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 mb-10">
                    <h4 className="text-gray-900 font-bold mb-2 flex items-center gap-2">
                      <Building2 size={20} className="text-[#fb7701]" /> Business Account Setup
                    </h4>
                    <p className="text-gray-500 text-sm mb-8">Create your professional seller account to proceed with the application.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Full Name</label>
                        <input
                          name="full_name"
                          type="text"
                          autoComplete="off"
                          className="input-field bg-white"
                          placeholder="Legal business owner name"
                          value={formData.full_name}
                          onChange={handleInputChange}
                          required={!user}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Email Address</label>
                        <input
                          name="email"
                          type="email"
                          autoComplete="off"
                          className="input-field bg-white"
                          placeholder="business@example.com"
                          value={formData.email}
                          onChange={handleInputChange}
                          required={!user}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Account Password</label>
                        <input
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          className="input-field bg-white"
                          placeholder="Set a strong password for your shop"
                          value={formData.password}
                          onChange={handleInputChange}
                          required={!user}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Store Name</label>
                    <input
                      name="store_name"
                      type="text"
                      className="input-field"
                      placeholder="My Awesome Shop"
                      value={formData.store_name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Industry/Category</label>
                    <input
                      name="category"
                      type="text"
                      className="input-field"
                      placeholder="Electronics, Fashion, etc."
                      value={formData.category}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Store Description</label>
                  <textarea
                    name="description"
                    className="input-field h-32 resize-none"
                    placeholder="Tell customers about your store..."
                    value={formData.description}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Logo URL</label>
                    <div className="flex gap-2">
                      <input
                        name="logo_url"
                        type="text"
                        className="input-field"
                        placeholder="https://..."
                        value={formData.logo_url}
                        onChange={handleInputChange}
                      />
                      <button type="button" className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:text-[#fb7701] transition-colors">
                        <Upload size={20} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Banner URL</label>
                    <div className="flex gap-2">
                      <input
                        name="banner_url"
                        type="text"
                        className="input-field"
                        placeholder="https://..."
                        value={formData.banner_url}
                        onChange={handleInputChange}
                      />
                      <button type="button" className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:text-[#fb7701] transition-colors">
                        <Upload size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-6 text-gray-400">
                  <Building2 size={24} />
                  <span className="font-bold uppercase tracking-widest text-xs">Step 2: Business & Tax</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Tax ID / VAT Number</label>
                    <input
                      name="tax_id"
                      type="text"
                      className="input-field"
                      placeholder="Enter your tax identification number"
                      value={formData.tax_id}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Business Type</label>
                    <select
                      name="business_type"
                      className="input-field"
                      value={formData.business_type}
                      onChange={handleInputChange}
                    >
                      {businessTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3 text-blue-600 text-sm">
                  <AlertCircle size={18} className="shrink-0 mt-1" />
                  <p>Please ensure your Tax ID is accurate as it will be used for verification and payout processing.</p>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-6 text-gray-400">
                  <Truck size={24} />
                  <span className="font-bold uppercase tracking-widest text-xs">Step 3: Logistics & Shipping</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Warehouse Address</label>
                  <textarea
                    name="warehouse_address"
                    className="input-field h-32 resize-none"
                    placeholder="Full address of your primary shipping facility..."
                    value={formData.warehouse_address}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <h4 className="text-sm font-bold text-gray-900 mb-4">Shipping Preferences</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-[#fb7701] transition-all">
                      <input type="checkbox" className="w-4 h-4 accent-[#fb7701]" />
                      <span className="text-sm font-medium text-gray-600">Ship from multiple locations</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-[#fb7701] transition-all">
                      <input type="checkbox" className="w-4 h-4 accent-[#fb7701]" />
                      <span className="text-sm font-medium text-gray-600">Use platform's standard shipping labels</span>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-6 text-gray-400">
                  <CheckCircle2 size={24} />
                  <span className="font-bold uppercase tracking-widest text-xs">Step 4: Review & Submit</span>
                </div>

                <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Store Name</p>
                      <p className="font-bold text-gray-900">{formData.store_name || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Business Type</p>
                      <p className="font-bold text-gray-900">{formData.business_type}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Tax ID</p>
                      <p className="font-bold text-gray-900">{formData.tax_id || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Warehouse Address</p>
                      <p className="font-bold text-gray-900 truncate">{formData.warehouse_address || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-500 leading-relaxed">
                      By submitting this application, you agree to our <span className="text-[#fb7701] font-bold cursor-pointer hover:underline">Seller Terms of Service</span> and
                      confirm that all provided information is accurate.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 flex flex-col items-center text-center"
              >
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-8 border border-green-100">
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-4">Application Submitted!</h2>
                <p className="text-gray-500 max-w-md mx-auto mb-10 font-medium leading-relaxed">
                  Thank you for your interest in selling on Temu. Your account has been created and your application is now in our review queue. 
                  <br /><br />
                  You will receive an email once an administrator has approved your store. Until then, your account will remain inactive.
                </p>
                <button
                  onClick={() => window.location.href = '/'}
                  className="bg-gray-900 text-white px-10 py-4 rounded-full font-bold hover:bg-black transition-all shadow-xl shadow-gray-200"
                >
                  Return to Homepage
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {step < 5 && (
            <div className="flex justify-between items-center pt-10">
              <button
                type="button"
                onClick={prevStep}
                disabled={step === 1}
                className="px-6 py-3 rounded-2xl font-bold text-gray-400 hover:text-gray-600 disabled:opacity-30 flex items-center gap-2 transition-all"
              >
                <ChevronLeft size={20} /> Back
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-[#fb7701] text-white px-8 py-3 rounded-2xl font-bold hover:bg-[#e06a01] transition-all shadow-lg shadow-orange-100 flex items-center gap-2"
                >
                  Next <ChevronRight size={20} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-[#fb7701] text-white px-8 py-3 rounded-2xl font-bold hover:bg-[#e06a01] transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-2 min-w-[160px]"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : 'Submit Application'}
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingWizard;
