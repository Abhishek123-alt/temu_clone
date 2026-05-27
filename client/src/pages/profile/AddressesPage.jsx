import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { motion } from 'framer-motion';
import { MapPin, Plus, Trash2, Home, Briefcase, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import ConfirmModal from '../../components/common/ConfirmModal';
import { toast } from '../../utils/toast';

const AddressesPage = () => {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newAddress, setNewAddress] = useState({
    name: '', street: '', city: '', state: '', zip: '', country: 'India', is_default: false
  });
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, addressId: null });

  const handleAddAddress = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/user/addresses/${editingId}`, newAddress);
      } else {
        await api.post('/user/addresses', newAddress);
      }
      // Refresh user in store
      const updatedUser = await api.get('/user/me');
      setUser(updatedUser.data);
      setShowModal(false);
      setEditingId(null);
      setNewAddress({ name: '', street: '', city: '', state: '', zip: '', country: 'India', is_default: false });
    } catch (error) {
      console.error("Failed to save address:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (address) => {
    setEditingId(address.id);
    setNewAddress({
      name: address.name || '',
      street: address.street,
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      is_default: address.is_default
    });
    setShowModal(true);
  };

  const handleDelete = async (addressId) => {
    try {
      await api.delete(`/user/addresses/${addressId}`);
      // Refresh user in store
      const updatedUser = await api.get('/user/me');
      setUser(updatedUser.data);
      toast.success("Address removed");
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : "Failed to delete address");
    }
  };

  const handleSetDefault = async (address) => {
    try {
      await api.put(`/user/addresses/${address.id}`, {
        name: address.name || '',
        street: address.street,
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country,
        is_default: true,
      });
      const updatedUser = await api.get('/user/me');
      setUser(updatedUser.data);
      toast.success("Default address updated");
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : "Failed to update default address");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <button 
        onClick={() => navigate('/profile')}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 font-bold transition-colors"
      >
        <ArrowLeft size={20} /> Back to Profile
      </button>

      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-extrabold text-gray-900">Your Addresses</h1>
        {user?.addresses && user.addresses.length < 3 ? (
          <button 
            onClick={() => setShowModal(true)}
            className="bg-[#fb7701] text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-[#e06a01] transition-all shadow-lg shadow-orange-100"
          >
            <Plus size={20} /> Add New
          </button>
        ) : (
          <div className="bg-orange-50 text-[#fb7701] px-4 py-2 rounded-full text-xs font-bold border border-orange-100">
            Max 3 addresses reached
          </div>
        )}
      </div>

      {/* Add Address Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl"
          >
            <h2 className="text-2xl font-black mb-6">{editingId ? 'Edit Address' : 'Add New Address'}</h2>
            <form onSubmit={handleAddAddress} className="space-y-4">
              <input
                placeholder="Recipient Name"
                value={newAddress.name}
                onChange={(e) => setNewAddress({...newAddress, name: e.target.value})}
                className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#fb7701]"
                required
              />
              <input
                placeholder="Street Address"
                value={newAddress.street}
                onChange={(e) => setNewAddress({...newAddress, street: e.target.value})}
                className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#fb7701]"
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  placeholder="City"
                  value={newAddress.city}
                  onChange={(e) => setNewAddress({...newAddress, city: e.target.value})}
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#fb7701]"
                  required
                />
                <input
                  placeholder="State"
                  value={newAddress.state}
                  onChange={(e) => setNewAddress({...newAddress, state: e.target.value})}
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#fb7701]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input
                  placeholder="Zip Code"
                  value={newAddress.zip}
                  onChange={(e) => setNewAddress({...newAddress, zip: e.target.value})}
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#fb7701]"
                  required
                />
                <input
                  placeholder="Country"
                  value={newAddress.country}
                  onChange={(e) => setNewAddress({...newAddress, country: e.target.value})}
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#fb7701]"
                  required
                />
              </div>
              
              <div className="flex items-center gap-3 p-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={newAddress.is_default}
                  onChange={(e) => setNewAddress({...newAddress, is_default: e.target.checked})}
                  className="w-5 h-5 rounded border-gray-300 text-[#fb7701] focus:ring-[#fb7701]"
                />
                <label htmlFor="is_default" className="text-sm font-bold text-gray-600 cursor-pointer">
                  Set as default address
                </label>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                    setNewAddress({ name: '', street: '', city: '', state: '', zip: '', country: 'India', is_default: false });
                  }}
                  className="flex-1 py-4 bg-gray-100 rounded-full font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 py-4 bg-[#fb7701] text-white rounded-full font-bold"
                >
                  {loading ? "Saving..." : "Save Address"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {user?.addresses && user.addresses.length > 0 ? (
          user.addresses.map((address) => (
            <motion.div 
              key={address.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-3xl border-2 border-gray-100 hover:border-[#fb7701]/20 transition-all shadow-sm group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center text-[#fb7701]">
                  <Home size={20} />
                </div>
                <button 
                  onClick={() => setConfirmDelete({ isOpen: true, addressId: address.id })}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              
              <h3 className="font-bold text-lg text-gray-900 mb-1">{address.name || user.full_name}</h3>
              <p className="text-gray-600 mb-1">{address.street}</p>
              <p className="text-gray-500 text-sm font-medium">{address.city}, {address.state} {address.zip}</p>
              
              <div className="mt-6 pt-4 border-t border-gray-50 flex items-center gap-4">
                <button
                  onClick={() => handleEdit(address)}
                  className="text-xs font-bold text-[#fb7701] hover:underline"
                >
                  Edit
                </button>
                {address.is_default ? (
                  <span className="text-[10px] bg-green-50 text-green-600 px-2 py-1 rounded-full font-black uppercase">Default</span>
                ) : (
                  <button
                    onClick={() => handleSetDefault(address)}
                    className="text-xs font-bold text-gray-500 hover:text-[#fb7701] hover:underline"
                  >
                    Set as default
                  </button>
                )}
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 bg-gray-50 rounded-[40px] text-center border-2 border-dashed border-gray-100">
            <MapPin size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-bold">No addresses saved yet</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmModal 
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, addressId: null })}
        onConfirm={() => handleDelete(confirmDelete.addressId)}
        title="Remove Address?"
        message="Are you sure you want to delete this shipping address from your profile?"
        confirmText="Remove Address"
        type="primary"
      />
    </div>
  );
};

export default AddressesPage;
