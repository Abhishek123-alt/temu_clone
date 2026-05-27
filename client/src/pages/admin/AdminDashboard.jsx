import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Store, TrendingUp, ShieldCheck, Plus, Edit2, Trash2, X, FolderTree, Gavel, Flag, Megaphone, Search, UserCheck, UserX, LifeBuoy, Send, CheckCircle2, Clock, AlertCircle, RefreshCw, Percent, CreditCard, Landmark } from 'lucide-react';
import { adminService } from '../../services/adminService';
import api from '../../services/api';
import { toast } from '../../utils/toast';
import ConfirmModal from '../../components/common/ConfirmModal';
import SalesChart from '../../components/seller/SalesChart';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'categories', 'disputes', 'campaigns', 'support'
  const [openTicketCount, setOpenTicketCount] = useState(0);

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

  // Poll for open ticket count — drives the badge on the Support tab. Runs
  // every 30s so admins see new requests without a manual refresh.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const { count } = await adminService.getOpenTicketCount();
        if (!cancelled) setOpenTicketCount(count);
      } catch {
        // 403 means non-admin (impossible here) or token expired; ignore.
      }
    };
    refresh();
    const id = setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (loading) return <div className="p-20 text-center font-bold text-gray-400">Loading platform stats...</div>;

  const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const grossSales = stats.gross_sales ?? stats.total_sales;
  const totalRefunds = stats.total_refunds ?? 0;
  const netSales = stats.net_sales ?? stats.total_sales;
  const commissionIncome = stats.commission_income ?? 0;
  const platformFeeIncome = stats.platform_fee_income ?? 0;
  const taxCollected = stats.tax_collected ?? 0;
  const adminRevenue = stats.admin_revenue ?? (commissionIncome + platformFeeIncome);

  const statCards = [
    { label: 'Total Customers', value: stats.total_customers, icon: <Users className="text-blue-500" /> },
    { label: 'Active Sellers', value: stats.total_sellers, icon: <Store className="text-orange-500" /> },
    { label: 'Total Products', value: stats.total_products, icon: <TrendingUp className="text-green-500" /> },
    {
      label: 'Marketplace Sales',
      value: `$${fmt(netSales)}`,
      icon: <ShieldCheck className="text-purple-500" />,
      subtext: `Gross $${fmt(grossSales)} − Refunds $${fmt(totalRefunds)} (sellers' revenue, not ours)`,
    },
    {
      label: 'Platform Earnings',
      value: `$${fmt(adminRevenue)}`,
      icon: <CreditCard className="text-emerald-500" />,
      subtext: `= Commission $${fmt(commissionIncome)} + Transaction fees $${fmt(platformFeeIncome)}`,
    },
    {
      label: 'Commission (10% of items)',
      value: `$${fmt(commissionIncome)}`,
      icon: <Percent className="text-orange-500" />,
      subtext: 'Charged to sellers on items sold (refund-adjusted)',
    },
    {
      label: 'Transaction Fees',
      value: `$${fmt(platformFeeIncome)}`,
      icon: <CreditCard className="text-purple-500" />,
      subtext: 'Flat $0.30 + 2% per order (Stripe-style)',
    },
    {
      label: 'Tax to Remit',
      value: `$${fmt(taxCollected)}`,
      icon: <Landmark className="text-gray-500" />,
      subtext: 'Held for the government — passthrough, not earnings',
    },
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
            {stat.subtext && (
              <p className="text-[10px] font-bold text-gray-400 mt-2">{stat.subtext}</p>
            )}
          </motion.div>
        ))}
      </div>

      <PlatformSalesChart />

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
          Campaign
        </button>
        <button
          onClick={() => setActiveTab('sellers')}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'sellers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Seller Onboard Req.
        </button>
        <button
          onClick={() => setActiveTab('support')}
          className={`relative px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'support' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Support
          {openTicketCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow">
              {openTicketCount > 99 ? '99+' : openTicketCount}
            </span>
          )}
        </button>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
        {activeTab === 'users' && <UserTable />}
        {activeTab === 'categories' && <CategoryManagement />}
        {activeTab === 'disputes' && <DisputeManagement />}
        {activeTab === 'campaigns' && <CampaignControl />}
        {activeTab === 'sellers' && <SellerApprovalManagement />}
        {activeTab === 'support' && (
          <SupportTicketsManagement
            onTicketCountChange={setOpenTicketCount}
          />
        )}
      </div>
    </div>
  );
};

const PlatformSalesChart = () => {
  const [sellers, setSellers] = useState([]);
  const [sellerId, setSellerId] = useState('ALL');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  useEffect(() => {
    adminService.getSellers().then(setSellers).catch((e) => console.error('Failed to fetch sellers', e));
  }, []);

  useEffect(() => {
    setLoading(true);
    adminService
      .getSalesOrders(sellerId === 'ALL' ? null : sellerId)
      .then(setOrders)
      .catch((e) => console.error('Failed to fetch sales orders', e))
      .finally(() => setLoading(false));
  }, [sellerId]);

  const getSalesData = () => {
    const now = new Date();
    let startDate = new Date();
    let grouping = 'day';

    switch (timeRange) {
      case '1m':
        startDate.setMonth(now.getMonth() - 1);
        grouping = 'day';
        break;
      case '3m':
        startDate.setMonth(now.getMonth() - 3);
        grouping = 'week';
        break;
      case '6m':
        startDate.setMonth(now.getMonth() - 6);
        grouping = 'week';
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        grouping = 'month';
        break;
      case 'custom':
        if (customRange.start) startDate = new Date(customRange.start);
        grouping = 'day';
        break;
      default:
        startDate.setDate(now.getDate() - 7);
        grouping = 'day';
    }
    startDate.setHours(0, 0, 0, 0);

    const endDate = timeRange === 'custom' && customRange.end ? new Date(customRange.end) : now;
    endDate.setHours(23, 59, 59, 999);

    if (timeRange === 'custom' && startDate > endDate) return [];

    const filtered = orders.filter((o) => {
      const d = new Date(o.created_at);
      return d >= startDate && d <= endDate;
    });

    if (grouping === 'day') {
      const data = [];
      const curr = new Date(startDate);
      while (curr <= endDate) {
        const label = curr.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const sales = filtered
          .filter((o) => new Date(o.created_at).toDateString() === curr.toDateString())
          .reduce((sum, o) => sum + (o.net_amount ?? o.total_amount), 0);
        data.push({ label, sales });
        curr.setDate(curr.getDate() + 1);
      }
      return data;
    }

    if (grouping === 'month') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const data = [];
      const curr = new Date(startDate);
      while (curr <= endDate) {
        const m = curr.getMonth();
        const y = curr.getFullYear();
        const label = `${months[m]} ${y}`;
        const sales = filtered
          .filter((o) => {
            const d = new Date(o.created_at);
            return d.getMonth() === m && d.getFullYear() === y;
          })
          .reduce((sum, o) => sum + (o.net_amount ?? o.total_amount), 0);
        data.push({ label, sales });
        curr.setMonth(curr.getMonth() + 1);
      }
      return data;
    }

    if (grouping === 'week') {
      const data = [];
      const curr = new Date(startDate);
      while (curr <= endDate) {
        const startOfWeek = new Date(curr);
        const endOfWeek = new Date(curr);
        endOfWeek.setDate(curr.getDate() + 6);
        const label = `Wk ${Math.ceil(curr.getDate() / 7)} ${curr.toLocaleDateString(undefined, { month: 'short' })}`;
        const sales = filtered
          .filter((o) => {
            const d = new Date(o.created_at);
            return d >= startOfWeek && d <= endOfWeek;
          })
          .reduce((sum, o) => sum + (o.net_amount ?? o.total_amount), 0);
        data.push({ label, sales });
        curr.setDate(curr.getDate() + 7);
      }
      return data;
    }
    return [];
  };

  const selectedSeller = sellers.find((s) => s.id === sellerId);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 }}
      className="mb-12"
    >
      <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Revenue Analysis</h3>
            <p className="text-sm text-gray-400 font-medium">
              {sellerId === 'ALL'
                ? 'Platform-wide sales performance over time'
                : `Sales for ${selectedSeller?.full_name || 'seller'}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className="px-4 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none focus:border-[#fb7701]"
            >
              <option value="ALL">All Sellers</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
            {['7d', '1m', '3m', '6m', '1y', 'custom'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  timeRange === range ? 'bg-[#fb7701] text-white shadow-lg shadow-orange-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}
              >
                {range === '1y' ? 'Year' : range === '1m' ? 'Month' : range}
              </button>
            ))}
          </div>
        </div>

        {timeRange === 'custom' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-6 p-4 bg-orange-50 rounded-2xl border border-orange-100"
          >
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase text-orange-400">Start Date</label>
              <input
                type="date"
                value={customRange.start}
                onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                className="bg-transparent text-sm font-bold text-orange-900 outline-none"
              />
            </div>
            <div className="text-orange-200">→</div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase text-orange-400">End Date</label>
              <input
                type="date"
                value={customRange.end}
                min={customRange.start}
                onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                className="bg-transparent text-sm font-bold text-orange-900 outline-none"
              />
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="h-[240px] flex items-center justify-center text-gray-400 font-bold">Loading sales data...</div>
        ) : (
          <SalesChart data={getSalesData()} />
        )}
      </div>
    </motion.div>
  );
};

const UserTable = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [togglingId, setTogglingId] = useState(null);
  const [confirmToggle, setConfirmToggle] = useState({ isOpen: false, user: null });

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

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggle = async () => {
    const user = confirmToggle.user;
    if (!user) return;
    setTogglingId(user.id);
    try {
      const updated = await adminService.toggleUserActive(user.id);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: updated.is_active } : u)));
      toast.success(updated.is_active ? 'User activated' : 'User deactivated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user');
    } finally {
      setTogglingId(null);
      setConfirmToggle({ isOpen: false, user: null });
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.is_active) ||
      (statusFilter === 'INACTIVE' && !u.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) return <div className="p-10 text-center text-gray-400">Loading users...</div>;

  return (
    <div>
      <div className="p-8 border-b border-gray-50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">User Management</h3>
          <p className="text-sm text-gray-400 font-medium">{filteredUsers.length} of {users.length} users</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:border-[#fb7701]"
          >
            <option value="ALL">All Roles</option>
            <option value="CUSTOMER">Customer</option>
            <option value="SELLER">Seller</option>
            <option value="SELLER_PENDING">Seller (Pending)</option>
            <option value="ADMIN">Admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:border-[#fb7701]"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <div className="relative flex-1 lg:w-64">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:border-[#fb7701] outline-none"
            />
          </div>
        </div>
      </div>

      <table className="w-full text-left">
        <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <tr>
            <th className="px-8 py-4">Name</th>
            <th className="px-8 py-4">Email</th>
            <th className="px-8 py-4">Role</th>
            <th className="px-8 py-4">Status</th>
            <th className="px-8 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filteredUsers.map((u) => {
            const isAdmin = u.role === 'ADMIN';
            return (
              <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-8 py-5 font-bold text-gray-900">{u.full_name}</td>
                <td className="px-8 py-5 text-gray-500 font-medium">{u.email}</td>
                <td className="px-8 py-5">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                    u.role === 'SELLER' ? 'bg-orange-100 text-orange-700' :
                    u.role === 'SELLER_PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <span className={`text-xs font-bold ${u.is_active ? 'text-gray-700' : 'text-gray-400'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </td>
                <td className="px-8 py-5 text-right">
                  {isAdmin ? (
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Protected</span>
                  ) : (
                    <button
                      disabled={togglingId === u.id}
                      onClick={() => setConfirmToggle({ isOpen: true, user: u })}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 ${
                        u.is_active
                          ? 'text-red-500 hover:bg-red-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {filteredUsers.length === 0 && (
            <tr>
              <td colSpan="5" className="px-8 py-10 text-center text-gray-400 font-medium">No users match the current filters.</td>
            </tr>
          )}
        </tbody>
      </table>

      <ConfirmModal
        isOpen={confirmToggle.isOpen}
        onClose={() => setConfirmToggle({ isOpen: false, user: null })}
        onConfirm={handleToggle}
        title={confirmToggle.user?.is_active ? 'Deactivate User?' : 'Activate User?'}
        message={
          confirmToggle.user?.is_active
            ? `${confirmToggle.user?.full_name} will no longer be able to log in or place orders. You can reactivate them later.`
            : `${confirmToggle.user?.full_name} will regain access to the platform.`
        }
        confirmText={confirmToggle.user?.is_active ? 'Deactivate' : 'Activate'}
        type={confirmToggle.user?.is_active ? 'danger' : 'primary'}
      />
    </div>
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
          <p className="text-sm text-gray-400 font-medium">Review return requests the seller has rejected</p>
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

                {selectedDispute.status === 'rejected' && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Admin Feedback / Reason</label>
                    <textarea
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Explain why the seller's rejection is being overridden or upheld..."
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold text-gray-700 focus:border-[#fb7701] outline-none transition-all min-h-[100px]"
                    />
                  </div>
                )}
              </div>

              {selectedDispute.status === 'rejected' ? (
                <div className="flex gap-4">
                  <button
                    disabled={processing}
                    onClick={() => handleProcessReturn(selectedDispute.id, false)}
                    className="flex-1 px-8 py-4 border-2 border-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all disabled:opacity-50"
                  >
                    Uphold Rejection
                  </button>
                  <button
                    disabled={processing}
                    onClick={() => handleProcessReturn(selectedDispute.id, true)}
                    className="flex-1 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {processing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Override & Approve Refund
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_time: '',
    end_time: '',
    is_active: true,
    selected_products: [] // { product_id, discounted_price }
  });
  const [saving, setSaving] = useState(false);

  const [editingCampaign, setEditingCampaign] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null });

  const fetchCampaigns = async () => {
    try {
      const res = await api.get('/flash-sales/all'); 
      setFlashSales(res.data);
    } catch (error) {
      const res = await api.get('/flash-sales/active'); 
      setFlashSales(res.data);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchProducts();
  }, []);

  const handleOpenModal = (campaign = null) => {
    if (campaign) {
      setEditingCampaign(campaign);
      // Format dates for datetime-local input (YYYY-MM-DDTHH:MM)
      const start = new Date(campaign.start_time);
      const end = new Date(campaign.end_time);
      setFormData({
        name: campaign.name,
        description: campaign.description || '',
        start_time: new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        end_time: new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        is_active: campaign.is_active,
        selected_products: campaign.products.map(p => ({
          product_id: p.product_id,
          discounted_price: p.discounted_price
        }))
      });
    } else {
      setEditingCampaign(null);
      setFormData({
        name: '',
        description: '',
        start_time: '',
        end_time: '',
        is_active: true,
        selected_products: []
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    const { id } = confirmDelete;
    try {
      await api.delete(`/flash-sales/admin/${id}`);
      toast.success("Campaign deleted");
      setConfirmDelete({ isOpen: false, id: null });
      fetchCampaigns();
    } catch (error) {
      toast.error("Failed to delete campaign");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const start = new Date(formData.start_time);
    const end = new Date(formData.end_time);
    const now = new Date();

    if (start < now) {
      toast.error("Start time cannot be in the past");
      return;
    }
    if (end <= start) {
      toast.error("End time must be after start time");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        is_active: formData.is_active,
        products: formData.selected_products
      };
      
      if (editingCampaign) {
        await api.put(`/flash-sales/admin/${editingCampaign.id}`, payload);
        toast.success("Campaign updated successfully!");
      } else {
        await api.post('/flash-sales/admin', payload);
        toast.success("Campaign launched successfully!");
      }
      
      setIsModalOpen(false);
      fetchCampaigns();
    } catch (error) {
      toast.error(editingCampaign ? "Failed to update campaign" : "Failed to launch campaign");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Loading campaigns...</div>;

  return (
    <div>
      <div className="p-8 border-b border-gray-50 flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-900">Active Campaigns</h3>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-black transition-all"
        >
          <Megaphone size={16} /> New Campaign
        </button>
      </div>
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {flashSales.map((fs) => (
          <div key={fs.id} className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl text-[#fb7701]">
                  <Megaphone size={24} />
                </div>
                <div>
                  <h4 className="text-xl font-black text-gray-900 leading-tight">{fs.name}</h4>
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mt-1">Marketing Event</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                fs.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
              }`}>
                {fs.is_active ? 'Active' : 'Paused'}
              </span>
            </div>
            
            <div className="flex items-center justify-between py-4 border-y border-gray-50 mb-6">
              <div className="text-center">
                <p className="text-[8px] font-black uppercase text-gray-400 mb-1">Start Date</p>
                <p className="text-xs font-bold text-gray-700">{new Date(fs.start_time).toLocaleDateString()}</p>
              </div>
              <div className="text-gray-200">→</div>
              <div className="text-center">
                <p className="text-[8px] font-black uppercase text-gray-400 mb-1">End Date</p>
                <p className="text-xs font-bold text-gray-700">{new Date(fs.end_time).toLocaleDateString()}</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] font-black uppercase text-gray-400 mb-1">Products</p>
                <p className="text-xs font-black text-[#fb7701]">{fs.products?.length || 0}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => handleOpenModal(fs)}
                className="flex-1 px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
              >
                <Edit2 size={14} /> Edit
              </button>
              <button 
                onClick={() => setConfirmDelete({ isOpen: true, id: fs.id })}
                className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
        {flashSales.length === 0 && (
          <div className="col-span-full py-10 text-center text-gray-400 font-medium">No marketing campaigns active.</div>
        )}
      </div>

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
              className="relative bg-white rounded-[40px] shadow-2xl p-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-gray-900">{editingCampaign ? 'Update Campaign' : 'Launch New Campaign'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-full">
                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Campaign Name</label>
                    <input 
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold outline-none focus:border-[#fb7701]"
                      placeholder="e.g. Summer Flash Sale"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Start Time</label>
                    <input 
                      type="datetime-local"
                      required
                      value={formData.start_time}
                      onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold outline-none focus:border-[#fb7701]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">End Time</label>
                    <input 
                      type="datetime-local"
                      required
                      value={formData.end_time}
                      onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold outline-none focus:border-[#fb7701]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-4">Select Products & Set Prices</label>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {products.map(p => {
                      const isSelected = formData.selected_products.find(sp => sp.product_id === p.id);
                      return (
                        <div key={p.id} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${isSelected ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>
                          <img src={p.images?.[0]?.url || 'https://via.placeholder.com/150'} alt="" className="w-12 h-12 rounded-xl object-cover" />
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">{p.title}</p>
                            <p className="text-xs text-gray-400 font-medium">Standard: ${p.price}</p>
                          </div>
                          {isSelected ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-orange-400">$</span>
                              <input 
                                type="number"
                                step="0.01"
                                value={isSelected.discounted_price}
                                onChange={(e) => {
                                  const newVal = parseFloat(e.target.value);
                                  setFormData({
                                    ...formData,
                                    selected_products: formData.selected_products.map(sp => 
                                      sp.product_id === p.id ? { ...sp, discounted_price: newVal } : sp
                                    )
                                  });
                                }}
                                className="w-20 bg-white border border-orange-200 rounded-lg p-2 text-xs font-bold outline-none"
                              />
                              <button 
                                type="button"
                                onClick={() => setFormData({
                                  ...formData,
                                  selected_products: formData.selected_products.filter(sp => sp.product_id !== p.id)
                                })}
                                className="p-1 text-red-400 hover:bg-red-50 rounded-lg"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <button 
                              type="button"
                              onClick={() => setFormData({
                                ...formData,
                                selected_products: [...formData.selected_products, { product_id: p.id, discounted_price: p.price * 0.8 }]
                              })}
                              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase hover:border-[#fb7701] hover:text-[#fb7701] transition-all"
                            >
                              Add to Sale
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={saving || formData.selected_products.length === 0}
                    className="w-full bg-[#fb7701] text-white py-4 rounded-2xl font-bold hover:bg-[#e06a01] transition-all shadow-xl shadow-orange-100 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? 'Processing...' : editingCampaign ? 'Save Changes' : 'Launch Campaign'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Campaign?"
        message="Are you sure you want to remove this marketing event? This will stop all associated product discounts immediately."
        confirmText="Delete Campaign"
        type="danger"
      />
    </div>
  );
};

const SellerApprovalManagement = () => {
  const [pendingSellers, setPendingSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchPending = async () => {
    try {
      const data = await adminService.getPendingSellers();
      setPendingSellers(data);
    } catch (error) {
      console.error('Failed to fetch pending sellers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleReview = async (userId, decision) => {
    setProcessingId(`${userId}-${decision}`);
    try {
      await adminService.reviewSeller(userId, decision);
      toast.success(`Seller ${decision === 'approve' ? 'Approved' : 'Rejected'} successfully`);
      fetchPending();
    } catch (error) {
      toast.error(`Failed to ${decision} seller`);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Loading pending applications...</div>;

  return (
    <div>
      <div className="p-8 border-b border-gray-50 flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-900">Seller Applications</h3>
        <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-100">
          {pendingSellers.length} Pending
        </span>
      </div>

      <table className="w-full text-left">
        <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
          <tr>
            <th className="px-8 py-4">Applicant</th>
            <th className="px-8 py-4">Store Details</th>
            <th className="px-8 py-4">Tax ID</th>
            <th className="px-8 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {pendingSellers.map((ps) => (
            <tr key={ps.user_id} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-8 py-6">
                <div>
                  <p className="font-bold text-gray-900">{ps.full_name}</p>
                  <p className="text-xs text-gray-500">{ps.email}</p>
                </div>
              </td>
              <td className="px-8 py-6">
                {ps.store ? (
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{ps.store.store_name}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{ps.store.business_type}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1 italic">"{ps.store.description}"</p>
                  </div>
                ) : (
                  <span className="text-xs text-gray-300 italic">No store details provided</span>
                )}
              </td>
              <td className="px-8 py-6">
                <span className="font-mono text-xs text-gray-600">{ps.store?.tax_id || 'N/A'}</span>
              </td>
              <td className="px-8 py-6 text-right">
                <div className="flex justify-end gap-3">
                  <button
                    disabled={!!processingId}
                    onClick={() => handleReview(ps.user_id, 'reject')}
                    className="px-4 py-2 text-xs font-black uppercase text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {processingId === `${ps.user_id}-reject` && <div className="w-3 h-3 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />}
                    Reject
                  </button>
                  <button
                    disabled={!!processingId}
                    onClick={() => handleReview(ps.user_id, 'approve')}
                    className="bg-gray-900 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-gray-100 disabled:opacity-50 flex items-center gap-2"
                  >
                    {processingId === `${ps.user_id}-approve` && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Approve
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {pendingSellers.length === 0 && (
            <tr>
              <td colSpan="4" className="px-8 py-20 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                  <ShieldCheck size={32} />
                </div>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No pending applications</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// Support Tickets — admin view of contact-support requests raised from the
// login page (Account Restricted → Contact Support). Lists tickets, lets the
// admin filter by status, open a ticket, mark resolved/dismissed, add notes,
// reactivate the linked user in one click, and reply over email.
// ============================================================================

const STATUS_META = {
  OPEN:        { label: 'Open',        bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
  IN_PROGRESS: { label: 'In progress', bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  RESOLVED:    { label: 'Resolved',    bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500' },
  DISMISSED:   { label: 'Dismissed',   bg: 'bg-gray-100',  text: 'text-gray-600',   dot: 'bg-gray-400' },
};

const StatusPill = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.OPEN;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${meta.bg} ${meta.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
};

const SupportTicketsManagement = ({ onTicketCountChange }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [selectedTicket, setSelectedTicket] = useState(null);

  const fetchTickets = async (filter = statusFilter) => {
    setLoading(true);
    try {
      const data = await adminService.listSupportTickets(filter || undefined);
      setTickets(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const refreshCount = async () => {
    try {
      const { count } = await adminService.getOpenTicketCount();
      onTicketCountChange?.(count);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchTickets(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleTicketUpdated = (updated) => {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTicket(updated);
    refreshCount();
  };

  // After a destination-changing action (status change / reactivate), close
  // the drawer and jump the filter to the new bucket so the admin sees where
  // the ticket landed. fetchTickets re-runs automatically because statusFilter
  // is in the effect's dep array.
  const handleActionComplete = (updated, jumpToStatus) => {
    refreshCount();
    setSelectedTicket(null);
    if (jumpToStatus && jumpToStatus !== statusFilter) {
      setStatusFilter(jumpToStatus);
    } else {
      // Same bucket → still refresh the row in place.
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center">
            <LifeBuoy size={20} className="text-[#fb7701]" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">Support Tickets</h2>
            <p className="text-xs text-gray-500 font-medium">
              Requests raised from the login page Contact Support flow
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchTickets(statusFilter)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-6 bg-gray-50 p-1.5 rounded-2xl w-fit">
        {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', ''].map((s) => (
          <button
            key={s || 'ALL'}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {s ? STATUS_META[s].label : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400 font-bold">Loading tickets…</div>
      ) : tickets.length === 0 ? (
        <div className="py-16 text-center">
          <CheckCircle2 size={40} className="text-green-400 mx-auto mb-3" />
          <p className="text-gray-500 font-bold">No tickets match this filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">When</th>
                <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">From</th>
                <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Subject</th>
                <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Context</th>
                <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4 text-sm text-gray-600 font-medium whitespace-nowrap">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-sm">
                    <div className="font-bold text-gray-900">{t.from_email}</div>
                    {t.linked_user && (
                      <div className="text-[11px] text-gray-400 font-medium">
                        {t.linked_user.role} · {t.linked_user.is_active ? 'active' : 'inactive'}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700 font-medium max-w-xs truncate">
                    {t.subject}
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-500 font-medium whitespace-nowrap">
                    {t.context || '—'}
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill status={t.status} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setSelectedTicket(t)}
                      className="text-xs font-bold text-[#fb7701] hover:underline"
                    >
                      Open →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {selectedTicket && (
          <TicketDetailDrawer
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            onUpdated={handleTicketUpdated}
            onActionComplete={handleActionComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const TicketDetailDrawer = ({ ticket, onClose, onUpdated, onActionComplete }) => {
  const [replyText, setReplyText] = useState('');
  const [notesText, setNotesText] = useState(ticket.admin_notes || '');
  const [busy, setBusy] = useState(null); // 'reply' | 'reactivate' | 'status' | 'notes'

  const canReactivate =
    ticket.linked_user && !ticket.linked_user.is_active && ticket.linked_user.role !== 'ADMIN';

  const run = async (label, fn) => {
    setBusy(label);
    try {
      return await fn();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const handleReactivate = () =>
    run('reactivate', async () => {
      const updated = await adminService.reactivateUserFromTicket(ticket.id);
      toast.success('User reactivated. Ticket marked resolved.');
      // Closes the drawer and jumps the filter to RESOLVED so the admin sees
      // where the ticket landed.
      onActionComplete(updated, 'RESOLVED');
    });

  const handleSetStatus = (status) =>
    run('status', async () => {
      const updated = await adminService.patchSupportTicket(ticket.id, { status });
      toast.success(`Status set to ${status}.`);
      onActionComplete(updated, status);
    });

  const handleSaveNotes = () =>
    run('notes', async () => {
      const updated = await adminService.patchSupportTicket(ticket.id, { admin_notes: notesText });
      toast.success('Notes saved.');
      // Notes don't change which bucket the ticket lives in — keep the drawer
      // open so the admin can keep editing.
      onUpdated(updated);
    });

  const handleSendReply = () =>
    run('reply', async () => {
      if (!replyText.trim()) return;
      await adminService.replyToTicket(ticket.id, replyText.trim());
      toast.success('Reply sent.');
      // Replying flips OPEN → IN_PROGRESS server-side. Re-fetch to mirror, then
      // close the drawer (jumps filter to IN_PROGRESS if we weren't already).
      const updated = await adminService.getSupportTicket(ticket.id);
      setReplyText('');
      onActionComplete(updated, updated.status);
    });

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 240 }}
        className="relative w-full max-w-lg h-full bg-white overflow-y-auto shadow-2xl"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
              <LifeBuoy size={16} className="text-[#fb7701]" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Ticket
              </p>
              <p className="text-sm font-bold text-gray-900 font-mono">
                #{ticket.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <StatusPill status={ticket.status} />
              <span className="text-xs text-gray-400 font-medium">
                {new Date(ticket.created_at).toLocaleString()}
              </span>
            </div>
            <h3 className="text-xl font-black text-gray-900 leading-tight">
              {ticket.subject}
            </h3>
            <p className="text-sm text-gray-500 font-medium">
              from <span className="text-gray-700 font-bold">{ticket.from_email}</span>
              {ticket.context && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                  {ticket.context}
                </span>
              )}
            </p>
          </div>

          {ticket.linked_user && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                Linked account
              </p>
              <p className="text-sm font-bold text-gray-900">{ticket.linked_user.full_name || ticket.linked_user.email}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 font-medium">
                <span>{ticket.linked_user.role}</span>
                <span>·</span>
                <span className={ticket.linked_user.is_active ? 'text-green-600' : 'text-red-600'}>
                  {ticket.linked_user.is_active ? 'Active' : 'Inactive'}
                </span>
                <span>·</span>
                <span>joined {new Date(ticket.linked_user.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Message
            </p>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {ticket.message}
            </div>
          </div>

          {canReactivate && (
            <button
              onClick={handleReactivate}
              disabled={busy !== null}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white rounded-2xl font-bold transition-all shadow-lg shadow-green-100 active:scale-95"
            >
              <UserCheck size={16} />
              {busy === 'reactivate' ? 'Reactivating…' : 'Reactivate this account'}
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleSetStatus('IN_PROGRESS')}
              disabled={busy !== null || ticket.status === 'IN_PROGRESS'}
              className="px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Clock size={14} />
              In Progress
            </button>
            <button
              onClick={() => handleSetStatus('RESOLVED')}
              disabled={busy !== null || ticket.status === 'RESOLVED'}
              className="px-4 py-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={14} />
              Resolved
            </button>
            <button
              onClick={() => handleSetStatus('OPEN')}
              disabled={busy !== null || ticket.status === 'OPEN'}
              className="px-4 py-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <AlertCircle size={14} />
              Reopen
            </button>
            <button
              onClick={() => handleSetStatus('DISMISSED')}
              disabled={busy !== null || ticket.status === 'DISMISSED'}
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <X size={14} />
              Dismiss
            </button>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Reply via email
            </p>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
              placeholder="Type your reply — sent over SMTP to the customer."
              className="w-full rounded-2xl border border-gray-200 p-3 text-sm font-medium resize-none focus:outline-none focus:border-[#fb7701]"
              disabled={busy === 'reply'}
            />
            <button
              onClick={handleSendReply}
              disabled={busy !== null || !replyText.trim()}
              className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#fb7701] hover:bg-[#e06a01] disabled:opacity-60 text-white rounded-2xl font-bold transition-all shadow-lg shadow-orange-100 active:scale-95"
            >
              <Send size={14} />
              {busy === 'reply' ? 'Sending…' : 'Send Reply'}
            </button>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Internal notes
            </p>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              rows={5}
              placeholder="Notes only visible to admins…"
              className="w-full rounded-2xl border border-gray-200 p-3 text-sm font-medium resize-none focus:outline-none focus:border-[#fb7701]"
              disabled={busy === 'notes'}
            />
            <button
              onClick={handleSaveNotes}
              disabled={busy !== null || notesText === (ticket.admin_notes || '')}
              className="mt-2 w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-60 text-gray-700 rounded-2xl font-bold text-sm transition-all active:scale-95"
            >
              {busy === 'notes' ? 'Saving…' : 'Save Notes'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;

