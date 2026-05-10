import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Store, TrendingUp, ShieldCheck } from 'lucide-react';
import { adminService } from '../../services/adminService';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

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

      {/* User Management Table */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">User Management</h3>
          <span className="text-sm text-gray-400 font-medium">Platform users</span>
        </div>
        <UserTable />
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

export default AdminDashboard;
