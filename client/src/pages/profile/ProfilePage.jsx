import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MapPin, Package, CreditCard, LogOut, ChevronRight, Gift, Sparkles, Heart, History, Edit2, X, Trophy, UserPlus, Copy, Check, Store } from 'lucide-react';
import RecentlyViewedSection from '../../components/profile/RecentlyViewedSection';
import WishlistSection from '../../components/profile/WishlistSection';
import api from '../../services/api';
import { toast } from '../../utils/toast';

const ProfilePage = () => {
  const { user, logout, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    full_name: user?.full_name || '',
    phone_number: user?.phone_number || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [referralCode, setReferralCode] = useState(null);
  const [referralLoading, setReferralLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  const handleRedeemCode = async (e) => {
    e.preventDefault();
    if (!redeemCode.trim()) return;
    setIsRedeeming(true);
    try {
      const res = await api.post(`/user/me/redeem-referral?code=${redeemCode.trim()}`);
      toast.success(res.data.message || "Referral code redeemed successfully!");
      setRedeemCode('');
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to redeem code");
    } finally {
      setIsRedeeming(false);
    }
  };

  useEffect(() => {
    const fetchReferralCode = async () => {
      try {
        const res = await api.get('/user/me/referral');
        setReferralCode(res.data.referral_code);
      } catch (error) {
        console.error("Failed to fetch referral code:", error);
      } finally {
        setReferralLoading(false);
      }
    };

    fetchReferralCode();
  }, []);

  const handleCopyReferralCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast.success("Referral code copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy referral code");
    }
  };


  const menuItems = [
    { icon: <Package size={20} />, label: 'Your Orders', sub: 'Track and manage purchases', path: '/orders' },
    { icon: <CreditCard size={20} />, label: 'Payment Methods', sub: 'Manage cards and credits', path: '/profile/payment-methods' },
    { icon: <MapPin size={20} />, label: 'Addresses', sub: 'Update shipping details', path: '/profile/addresses' },
    { icon: <Trophy size={20} />, label: 'Quests & Rewards', sub: 'Complete tasks, earn prizes', path: '/profile/quests' },
  ];

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await api.put('/user/me', editFormData);
      setUser(res.data);
      toast.success("Profile updated successfully");
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: User Card & Personal Sections */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-1 space-y-8"
        >
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center text-center relative overflow-hidden group">
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="p-2 bg-gray-50 text-gray-400 hover:text-[#fb7701] rounded-full transition-colors"
              >
                <Edit2 size={16} />
              </button>
            </div>
            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center text-[#fb7701] mb-6">
              <User size={48} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{user?.full_name}</h2>
            <p className="text-gray-500 font-medium mt-1">{user?.email}</p>
            {user?.phone_number && <p className="text-sm text-gray-400 mt-1">{user.phone_number}</p>}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-4">Role: {user?.role}</p>
            
            <div className="w-full h-px bg-gray-50 my-8" />
            
            <button 
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 text-red-500 font-bold hover:bg-red-50 py-3 rounded-2xl transition-colors"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>

          {/* Refer a Friend Section */}
          {user?.role !== 'SELLER' && user?.role !== 'ADMIN' && user?.role !== 'SELLER_PENDING' && (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-6">
                <UserPlus size={24} className="text-[#fb7701]" />
                <h3 className="text-xl font-bold text-gray-900">Refer a Friend</h3>
              </div>

              <p className="text-gray-500 text-sm mb-6">
                Share your unique code with friends. When they make their first purchase, you'll both get <span className="text-[#fb7701] font-bold">$5 credit!</span>
              </p>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <div className="flex-1 font-mono font-bold text-gray-700 text-center text-lg truncate">
                  {referralLoading ? (
                    <span className="text-gray-300 animate-pulse">Loading...</span>
                  ) : (
                    referralCode || 'Unavailable'
                  )}
                </div>
                <button
                  onClick={handleCopyReferralCode}
                  disabled={!referralCode || referralLoading}
                  className="bg-white px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold text-xs hover:text-[#fb7701] transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <h4 className="text-sm font-bold text-gray-900 mb-3">Got a referral code?</h4>
                <form onSubmit={handleRedeemCode} className="flex gap-2">
                  <input
                    type="text"
                    value={redeemCode}
                    onChange={(e) => setRedeemCode(e.target.value)}
                    placeholder="Enter friend's code"
                    className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 text-sm font-bold focus:border-[#fb7701] outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!redeemCode.trim() || isRedeeming}
                    className="bg-gray-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isRedeeming ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Redeem'
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* My Rewards Section */}
          {user?.role !== 'SELLER' && user?.role !== 'ADMIN' && user?.role !== 'SELLER_PENDING' && (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Gift size={24} className="text-[#fb7701]" /> My Rewards
              </h3>
              
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {user?.rewards?.length > 0 ? (
                  user.rewards.map((reward) => (
                    <div key={reward.id} className="relative bg-gradient-to-br from-orange-50 to-white border-2 border-orange-100 rounded-2xl p-5 group overflow-hidden">
                      {/* Coupon Cutouts */}
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border-2 border-orange-100 rounded-full" />
                      <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border-2 border-orange-100 rounded-full" />
                      
                      <div className="flex justify-between items-start relative z-10">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#fb7701] mb-1">
                            {reward.reward_type}
                          </p>
                          <p className="text-2xl font-black text-gray-900">{reward.value}</p>
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-[10px] font-mono bg-white px-2 py-1 rounded border border-orange-100 text-gray-500">
                              {reward.code}
                            </span>
                          </div>
                        </div>
                        <div className="text-orange-200 group-hover:text-orange-300 transition-colors">
                          <Sparkles size={32} />
                        </div>
                      </div>

                      {reward.is_used && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-[2px] z-20">
                          <span className="bg-gray-900 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">Already Used</span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-12 bg-gray-50 rounded-2xl text-center border border-dashed border-gray-200">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
                      <Gift size={20} />
                    </div>
                    <p className="text-gray-400 font-medium">No rewards yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* Right Column: Details & Menu */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 space-y-8"
        >
          {user?.role !== 'SELLER' && user?.role !== 'ADMIN' && (
            <>
              {/* Account Settings Menu */}
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50">
                  <h3 className="text-xl font-bold text-gray-900">Account Settings</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {menuItems.map((item, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => item.path !== '#' && navigate(item.path)}
                      className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4 text-left">
                        <div className="text-gray-400">{item.icon}</div>
                        <div>
                          <p className="font-bold text-gray-900">{item.label}</p>
                          <p className="text-sm text-gray-400 font-medium">{item.sub}</p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-gray-300" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Shipping Addresses Section */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Default Shipping Address</h3>
                  <button 
                    onClick={() => navigate('/profile/addresses')}
                    className="text-[#fb7701] font-bold text-sm hover:underline"
                  >
                    Manage All
                  </button>
                </div>
                
                {user?.addresses?.length > 0 ? (
                  <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                    <div className="flex items-start gap-4">
                      <MapPin size={20} className="text-[#fb7701] mt-1" />
                      <div>
                        <p className="font-bold text-gray-900">{user?.full_name}</p>
                        <p className="text-gray-600 mt-1">{user?.addresses[0].street}</p>
                        <p className="text-gray-500 text-sm font-medium">{user?.addresses[0].city}, {user?.addresses[0].state} {user?.addresses[0].zip}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-gray-400 font-medium">No addresses saved yet</p>
                    {user?.addresses?.length < 3 && (
                      <button onClick={() => navigate('/profile/addresses')} className="text-[#fb7701] font-bold text-sm mt-2 hover:underline">+ Add New Address</button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}


          {user?.role === 'SELLER_PENDING' && (
            <div className="bg-white rounded-3xl p-12 shadow-sm border border-orange-100 flex flex-col items-center justify-center text-center h-full relative overflow-hidden">
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center text-orange-400 mb-6 border border-orange-100">
                <Sparkles size={40} className="animate-pulse" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Application in Progress</h3>
              <p className="text-gray-500 max-w-sm mb-8 font-medium">You've started your seller application. Complete the onboarding wizard to submit it for review.</p>
              <button
                onClick={() => navigate('/seller/onboarding')}
                className="bg-[#fb7701] text-white px-8 py-4 rounded-full font-bold hover:bg-[#e06a01] transition-all shadow-xl shadow-orange-100"
              >
                Continue Onboarding
              </button>
              <div className="absolute top-0 right-0 p-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 bg-orange-50 px-3 py-1 rounded-full border border-orange-100">Pending Setup</span>
              </div>
            </div>
          )}

          {user?.role === 'SELLER' && (
            <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center h-full">
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center text-[#fb7701] mb-6">
                <Package size={40} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Seller Workspace</h3>
              <p className="text-gray-500 max-w-sm mb-8">Head over to Seller Central to manage your products, track orders, and view your performance metrics.</p>
              <button
                onClick={() => navigate('/seller')}
                className="bg-[#fb7701] text-white px-8 py-4 rounded-full font-bold hover:bg-[#e06a01] transition-all shadow-xl shadow-orange-100"
              >
                Go to Seller Central
              </button>
            </div>
          )}

          {user?.role === 'ADMIN' && (
            <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center h-full">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-900 mb-6">
                <User size={40} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h3>
              <p className="text-gray-500 max-w-sm mb-8">Access the admin panel to manage users, monitor platform health, and configure global settings.</p>
              <button 
                onClick={() => navigate('/admin')}
                className="bg-gray-900 text-white px-8 py-4 rounded-full font-bold hover:bg-black transition-all shadow-xl shadow-gray-200"
              >
                Go to Admin Panel
              </button>
            </div>
          )}

          {/* Wishlist Section */}
          {user?.role !== 'SELLER' && user?.role !== 'ADMIN' && (
            <WishlistSection />
          )}


          {/* Recently Viewed Section (Hidden for Sellers & Admins) */}
          {user?.role !== 'SELLER' && user?.role !== 'ADMIN' && (
            <RecentlyViewedSection />
          )}
        </motion.div>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl p-10 w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-gray-900">Edit Profile</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Full Name</label>
                  <input 
                    type="text"
                    required
                    value={editFormData.full_name}
                    onChange={(e) => setEditFormData({...editFormData, full_name: e.target.value})}
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Phone Number</label>
                  <input 
                    type="tel"
                    value={editFormData.phone_number}
                    onChange={(e) => setEditFormData({...editFormData, phone_number: e.target.value})}
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] outline-none font-bold"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-[#fb7701] text-white py-4 rounded-2xl font-bold hover:bg-[#e06a01] transition-all shadow-xl shadow-orange-100 disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Save Changes
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

export default ProfilePage;

