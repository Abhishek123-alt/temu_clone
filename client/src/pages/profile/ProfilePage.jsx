import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { motion } from 'framer-motion';
import { User, MapPin, Package, CreditCard, LogOut, ChevronRight, Gift, Sparkles } from 'lucide-react';

const ProfilePage = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const menuItems = [
    { icon: <Package size={20} />, label: 'Your Orders', sub: 'Track and manage purchases', path: '/orders' },
    { icon: <CreditCard size={20} />, label: 'Payment Methods', sub: 'Manage cards and credits', path: '/payment' },
    { icon: <MapPin size={20} />, label: 'Addresses', sub: 'Update shipping details', path: '/profile/addresses' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: User Card */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-1"
        >
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center text-[#fb7701] mb-6">
              <User size={48} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{user?.full_name}</h2>
            <p className="text-gray-500 font-medium mt-1">{user?.email}</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-4">Role: {user?.role}</p>
            
            <button 
              onClick={logout}
              className="mt-8 flex items-center gap-2 text-red-500 font-bold hover:bg-red-50 px-6 py-2 rounded-full transition-colors"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </motion.div>

        {/* Right Column: Details & Menu */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 space-y-8"
        >
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
                <button className="text-[#fb7701] font-bold text-sm mt-2 hover:underline">+ Add New Address</button>
              </div>
            )}
          </div>

          {/* My Rewards Section */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Gift size={24} className="text-[#fb7701]" /> My Rewards
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {user?.rewards?.length > 0 ? (
                user.rewards.map((reward) => (
                  <div key={reward.id} className="relative overflow-hidden bg-orange-50 border-2 border-orange-100 rounded-2xl p-6 group">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Sparkles size={48} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#fb7701] mb-1">
                      {reward.reward_type}
                    </p>
                    <p className="text-2xl font-black text-gray-900 mb-2">{reward.value}</p>
                    <p className="text-xs font-mono bg-white inline-block px-2 py-1 rounded border border-orange-100">
                      {reward.code}
                    </p>
                    {reward.is_used && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-[1px]">
                        <span className="bg-gray-900 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase">Used</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-full py-10 bg-gray-50 rounded-2xl text-center border border-dashed border-gray-200">
                  <p className="text-gray-400 font-medium">No rewards won yet. Go spin the wheel!</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default ProfilePage;
