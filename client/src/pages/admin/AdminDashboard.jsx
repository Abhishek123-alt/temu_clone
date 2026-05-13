import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Store, TrendingUp, ShieldCheck, Plus, Edit2, Trash2, X, FolderTree, Gavel, Flag, Megaphone } from 'lucide-react';
import { adminService } from '../../services/adminService';
import api from '../../services/api';
import { toast } from '../../utils/toast';
import ConfirmModal from '../../components/common/ConfirmModal';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'categories', 'disputes', 'campaigns'

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await adminService.getStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch admin stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-20 text-center font-bold text-gray-400">Loading platform stats...</div>;

  const statCards = [
    { label: 'Total Customers', value: stats.total_customers, icon: <Users className="text-blue-500" /> },
    { label: 'Active Sellers', value: stats.total_sellers, icon: <Store className="text-orange-500" /> },
    { label: 'Total Products', value: stats.total_products, icon: <TrendingUp className="text-green-500" /> },
    { label: 'Platform Sales', value: `$${stats.total_sales}`, icon: <ShieldCheck className="text-purple-500" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-gray-900">Admin Control Panel</h1>
        <p className="text-gray-500 mt-1">Platform-wide overview and management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {statCards.map((stat, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"
          >
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 text-2xl">
              {stat.icon}
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
            <p className="text-3xl font-black text-gray-900 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex gap-4 mb-8 bg-gray-100 p-1.5 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('users')}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'users' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Users
        </button>
        <button 
          onClick={() => setActiveTab('categories')}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'categories' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Categories
        </button>
        <button 
          onClick={() => setActiveTab('disputes')}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'disputes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Disputes
        </button>
        <button 
          onClick={() => setActiveTab('campaigns')}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'campaigns' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Campaigns
        </button>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
        {activeTab === 'users' && (
          <>
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">User Management</h3>
              <span className="text-sm text-gray-400 font-medium">Platform users</span>
            </div>
            <UserTable />
          </>
        )}
        {activeTab === 'categories' && <CategoryManagement />}
        {activeTab === 'disputes' && <DisputeManagement />}
        {activeTab === 'campaigns' && <CampaignControl />}
      </div>
    </div>
  );
};

const UserTable = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await adminService.getUsers();
        setUsers(data);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  if (loading) return <div className="p-10 text-center text-gray-400">Loading users...</div>;

  return (
    <table className="w-full text-left">
      <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-widest">
        <tr>
          <th className="px-8 py-4">Name</th>
          <th className="px-8 py-4">Email</th>
          <th className="px-8 py-4">Role</th>
          <th className="px-8 py-4">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {users.map((u) => (
          <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
            <td className="px-8 py-5 font-bold text-gray-900">{u.full_name}</td>
            <td className="px-8 py-5 text-gray-500 font-medium">{u.email}</td>
            <td className="px-8 py-5">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                u.role === 'Admin' ? 'bg-purple-100 text-purple-700' : 
                u.role === 'Seller' ? 'bg-orange-100 text-orange-700' : 
                'bg-blue-100 text-blue-700'
              }`}>
                {u.role}
              </span>
            </td>
            <td className="px-8 py-5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs font-bold text-gray-400">Active</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', parent_id: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, catId: null });

  const fetchCategories = async () => {
    try {
      const res = await api.get('/products/categories');
      setCategories(res.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenModal = (cat = null) => {
    if (cat) {
      setEditingCategory(cat);
      setFormData({ name: cat.name, description: cat.description || '', parent_id: cat.parent_id || '' });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', description: '', parent_id: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        parent_id: formData.parent_id === "" ? null : formData.parent_id
      };
      if (editingCategory) {
        await api.put(`/products/categories/${editingCategory.id}`, payload);
        toast.success("Category updated");
      } else {
        await api.post('/products/categories', payload);
        toast.success("Category created");
      }
      setIsModalOpen(false);
      fetchCategories();
    } catch (error) {
      toast.error("Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const { catId } = confirmDelete;
    try {
      await api.delete(`/products/categories/${catId}`);
      toast.success("Category deleted");
      fetchCategories();
    } catch (error) {
      toast.error("Failed to delete category");
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Loading categories...</div>;

  return (
    <div>
      <div className="p-8 border-b border-gray-50 flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-900">Category Management</h3>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-black transition-all"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      <table className="w-full text-left">
        <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <tr>
            <th className="px-8 py-4">Name</th>
            <th className="px-8 py-4">Description</th>
            <th className="px-8 py-4">Parent</th>
            <th className="px-8 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {categories.map((cat) => (
            <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-8 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                    <FolderTree size={16} />
                  </div>
                  <span className="font-bold text-gray-900">{cat.name}</span>
                </div>
              </td>
              <td className="px-8 py-5">
                <p className="text-xs text-gray-500 font-medium truncate max-w-[200px]">{cat.description || '-'}</p>
              </td>
              <td className="px-8 py-5 text-gray-500 font-medium">
                {categories.find(c => c.id === cat.parent_id)?.name || 'None'}
              </td>
              <td className="px-8 py-5 text-right">
                <div className="flex justify-end gap-2">
                  <button onClick={() => handleOpenModal(cat)} className="p-2 text-gray-400 hover:text-blue-500 rounded-lg transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => setConfirmDelete({ isOpen: true, catId: cat.id })} className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Category Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl p-10 w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-gray-900">{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Category Name</label>
                  <input 
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Description</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] outline-none font-bold min-h-[100px]"
                    placeholder="Brief description of the category..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Parent Category</label>
                  <select 
                    value={formData.parent_id}
                    onChange={(e) => setFormData({...formData, parent_id: e.target.value})}
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] outline-none font-bold"
                  >
                    <option value="">None (Top Level)</option>
                    {categories.filter(c => c.id !== editingCategory?.id).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={saving}
                    className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {editingCategory ? 'Save Changes' : 'Create Category'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, catId: null })}
        onConfirm={handleDelete}
        title="Delete Category?"
        message="Are you sure you want to remove this category? All products in this category might become unlinked."
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};

const DisputeManagement = () => {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [sellerFilter, setSellerFilter] = useState('All Sellers');
  const [customerFilter, setCustomerFilter] = useState('All Customers');
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [refundReason, setRefundReason] = useState('');

  const fetchDisputes = async () => {
    try {
      const res = await api.get('/orders/seller/returns'); 
      setDisputes(res.data);
    } catch (error) {
      console.error('Failed to fetch disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const uniqueSellers = ['All Sellers', ...new Set(disputes.map(d => d.seller_name).filter(Boolean))];
  const uniqueCustomers = ['All Customers', ...new Set(disputes.map(d => d.customer_name).filter(Boolean))];

  const handleProcessReturn = async (returnId, approved) => {
    setProcessing(true);
    try {
      await api.post(`/orders/returns/${returnId}/process?approved=${approved}&reason=${encodeURIComponent(refundReason)}`);
      toast.success(approved ? "Return approved" : "Return rejected");
      setSelectedDispute(null);
      setRefundReason('');
      fetchDisputes();
    } catch (error) {
      toast.error("Failed to process return");
    } finally {
      setProcessing(false);
    }
  };

  const filteredDisputes = disputes.filter(d => {
    const searchStr = filter.toLowerCase().trim().replace('#', '');
    const matchesSearch = !searchStr || (
      d.order_id?.toLowerCase().includes(searchStr) ||
      d.customer_name?.toLowerCase().includes(searchStr) ||
      d.seller_name?.toLowerCase().includes(searchStr) ||
      d.reason?.toLowerCase().includes(searchStr) ||
      d.status?.toLowerCase().includes(searchStr)
    );

    const matchesSeller = sellerFilter === 'All Sellers' || d.seller_name === sellerFilter;
    const matchesCustomer = customerFilter === 'All Customers' || d.customer_name === customerFilter;

    return matchesSearch && matchesSeller && matchesCustomer;
  });

  if (loading) return <div className="p-10 text-center text-gray-400">Loading disputes...</div>;

  return (
    <div>
      <div className="p-8 border-b border-gray-50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Platform Disputes</h3>
          <p className="text-sm text-gray-400 font-medium">Manage and review return requests</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <select 
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:border-[#fb7701]"
          >
            {uniqueCustomers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            value={sellerFilter}
            onChange={(e) => setSellerFilter(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:border-[#fb7701]"
          >
            {uniqueSellers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="relative flex-1 lg:w-64">
            <input 
              type="text" 
              placeholder="Search order ID or reason..." 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:border-[#fb7701] outline-none"
            />
          </div>
        </div>
      </div>

      <table className="w-full text-left">
        <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
          <tr>
            <th className="px-8 py-4">Order ID</th>
            <th className="px-8 py-4">Customer</th>
            <th className="px-8 py-4">Seller</th>
            <th className="px-8 py-4">Reason</th>
            <th className="px-8 py-4">Status</th>
            <th className="px-8 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filteredDisputes.map((d) => (
            <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-8 py-5 font-bold text-gray-900">#{d.order_id?.slice(0, 8)}</td>
              <td className="px-8 py-5 text-sm text-gray-700">{d.customer_name}</td>
              <td className="px-8 py-5 text-sm text-gray-500 font-medium">{d.seller_name}</td>
              <td className="px-8 py-5 text-xs text-gray-500 font-medium capitalize">{d.reason.replace('_', ' ')}</td>
              <td className="px-8 py-5">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  d.status === 'requested' ? 'bg-blue-100 text-blue-700' : 
                  d.status === 'approved' ? 'bg-green-100 text-green-700' : 
                  'bg-red-100 text-red-700'
                }`}>
                  {d.status}
                </span>
              </td>
              <td className="px-8 py-5 text-right">
                <button 
                  onClick={() => setSelectedDispute(d)}
                  className="text-xs font-black text-[#fb7701] uppercase tracking-widest hover:underline"
                >
                  Review Details
                </button>
              </td>
            </tr>
          ))}
          {filteredDisputes.length === 0 && (
            <tr>
              <td colSpan="6" className="px-8 py-10 text-center text-gray-400 font-medium">No active disputes found.</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedDispute && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDispute(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl p-10 w-full max-w-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">Return Request Details</h2>
                  <p className="text-sm text-gray-400 font-medium">Order #{selectedDispute.order_id}</p>
                </div>
                <button onClick={() => setSelectedDispute(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Customer Info</label>
                    <p className="font-bold text-gray-900">{selectedDispute.customer_name}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Return Reason</label>
                    <p className="font-medium text-gray-700 bg-orange-50 p-4 rounded-2xl border border-orange-100 capitalize">
                      {selectedDispute.reason.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Seller Info</label>
                    <p className="font-bold text-gray-900">{selectedDispute.seller_name}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Requested Amount</label>
                    <p className="text-2xl font-black text-gray-900">${selectedDispute.refund_amount.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-3">Items Requested for Return</label>
                <div className="bg-gray-50 rounded-3xl p-4 max-h-[150px] overflow-y-auto mb-6">
                  {selectedDispute.order?.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
                      <img src={item.product_image || 'https://via.placeholder.com/150'} alt="" className="w-12 h-12 rounded-xl object-cover" />
                      <div>
                        <p className="text-sm font-bold text-gray-900 line-clamp-1">{item.product_title}</p>
                        <p className="text-[10px] text-gray-400">Qty: {item.quantity} × ${item.price.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedDispute.status === 'requested' && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Admin Feedback / Reason</label>
                    <textarea 
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Explain why this return is being approved or rejected..."
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold text-gray-700 focus:border-[#fb7701] outline-none transition-all min-h-[100px]"
                    />
                  </div>
                )}
              </div>

              {selectedDispute.status === 'requested' ? (
                <div className="flex gap-4">
                  <button 
                    disabled={processing}
                    onClick={() => handleProcessReturn(selectedDispute.id, false)}
                    className="flex-1 px-8 py-4 border-2 border-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all disabled:opacity-50"
                  >
                    Reject Return
                  </button>
                  <button 
                    disabled={processing}
                    onClick={() => handleProcessReturn(selectedDispute.id, true)}
                    className="flex-1 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {processing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Approve & Refund
                  </button>
                </div>
              ) : (
                <div className={`p-4 rounded-2xl text-center font-bold uppercase tracking-widest text-xs ${
                  selectedDispute.status === 'approved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  This request has been {selectedDispute.status}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CampaignControl = () => {
  const [flashSales, setFlashSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const res = await api.get('/products/flash-sales');
        setFlashSales(res.data);
      } catch (error) {
        console.error('Failed to fetch campaigns:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, []);

  if (loading) return <div className="p-10 text-center text-gray-400">Loading campaigns...</div>;

  return (
    <div>
      <div className="p-8 border-b border-gray-50 flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-900">Active Campaigns</h3>
        <button className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-black transition-all">
          <Megaphone size={16} /> New Campaign
        </button>
      </div>
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {flashSales.map((fs) => (
          <div key={fs.id} className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white rounded-2xl text-[#fb7701] shadow-sm">
                <Megaphone size={20} />
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                fs.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
              }`}>
                {fs.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <h4 className="text-lg font-bold text-gray-900 mb-2">{fs.title}</h4>
            <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
              <span>{new Date(fs.start_time).toLocaleDateString()}</span>
              <span>→</span>
              <span>{new Date(fs.end_time).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        {flashSales.length === 0 && (
          <div className="col-span-full py-10 text-center text-gray-400 font-medium">No marketing campaigns active.</div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

