import React, { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { productService } from '../../services/productService';
import { Plus, Edit, Trash2, Package, RotateCcw, ShoppingCart, X, CreditCard } from 'lucide-react';
import ConfirmModal from '../../components/common/ConfirmModal';
import api from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import SalesChart from '../../components/seller/SalesChart';
import { toast } from '../../utils/toast';

const StatCard = ({ title, value, icon, trend }) => (
  <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-gray-50 rounded-2xl text-gray-400">
        {icon}
      </div>
      {trend && (
        <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${trend.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {trend}
        </span>
      )}
    </div>
    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{title}</p>
    <p className="text-3xl font-black text-gray-900">{value}</p>
  </div>
);

const SellerDashboard = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('products'); // 'products', 'returns', 'orders'
  const [products, setProducts] = useState([]);
  const [returns, setReturns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    // Fetch Categories
    try {
      const categoriesData = await productService.getCategories();
      setCategories(categoriesData);
    } catch (e) { console.error("Categories fetch failed", e); }

    // Fetch Products
    try {
      const myProducts = await api.get('/products/me');
      setProducts(myProducts.data);
    } catch (e) { console.error("Products fetch failed", e); }

    // Fetch Returns
    try {
      const returnRequests = await api.get('/orders/seller/returns');
      setReturns(returnRequests.data);
    } catch (e) { console.error("Returns fetch failed", e); }

    // Fetch Orders
    try {
      const orderRes = await api.get('/orders/seller/orders');
      setOrders(orderRes.data);
    } catch (e) { console.error("Orders fetch failed", e); }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    
    // Set up real-time polling (every 5 seconds)
    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, [user.id]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShipModalOpen, setIsShipModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [shipFormData, setShipFormData] = useState({
    carrier: 'FedEx',
    tracking_number: ''
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    stock: '',
    category_id: '',
    images: [],
    attributes: {}
  });
  const [categoryAttributes, setCategoryAttributes] = useState([]);
  // Which attribute keys the seller has explicitly added for this product
  const [activeAttrKeys, setActiveAttrKeys] = useState([]);
  const [attrPickerKey, setAttrPickerKey] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!formData.category_id) { setCategoryAttributes([]); return; }
    api.get(`/products/categories/${formData.category_id}/attributes`)
      .then(res => setCategoryAttributes(res.data))
      .catch(() => setCategoryAttributes([]));
  }, [formData.category_id]);

  // Cascading dropdown state — track each level the user picks
  const [catL1, setCatL1] = useState('');
  const [catL2, setCatL2] = useState('');

  const l1Categories = useMemo(() => categories.filter(c => !c.parent_id), [categories]);
  const l2Categories = useMemo(() => catL1 ? categories.filter(c => c.parent_id === catL1) : [], [catL1, categories]);
  const l3Categories = useMemo(() => catL2 ? categories.filter(c => c.parent_id === catL2) : [], [catL2, categories]);

  // When editing an existing product, walk up the tree to set L1/L2/L3 from category_id
  useEffect(() => {
    if (!formData.category_id || categories.length === 0) return;
    const cat = categories.find(c => c.id === formData.category_id);
    if (!cat) return;
    if (!cat.parent_id) { setCatL1(cat.id); setCatL2(''); return; }
    const parent = categories.find(c => c.id === cat.parent_id);
    if (!parent) return;
    if (!parent.parent_id) { setCatL1(parent.id); setCatL2(cat.id); return; }
    setCatL1(parent.parent_id); setCatL2(parent.id);
  }, [formData.category_id, categories]);

  const [processingIds, setProcessingIds] = useState(new Set());
  const [timeRange, setTimeRange] = useState('7d'); // '7d', '1m', '3m', '6m', '1y', 'custom'
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [customerFilter, setCustomerFilter] = useState('All Customers');
  const [selectedDetail, setSelectedDetail] = useState(null);

  // Custom Confirm State
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, productId: null });

  const handleDeleteProduct = async (productId) => {
    setProcessingIds(prev => new Set(prev).add(productId));
    try {
      await api.delete(`/products/${productId}`);
      fetchData(); // Refresh
      toast.success("Product deleted successfully");
    } catch (error) {
      console.error("Failed to delete product:", error);
      toast.error("Failed to delete product");
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    
    setImageUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const data = new FormData();
        data.append('file', file);
        const res = await api.post('/products/upload', data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data.url;
      });
      
      const newUrls = await Promise.all(uploadPromises);
      setFormData(prev => ({
        ...prev,
        images: [...(Array.isArray(prev.images) ? prev.images : []), ...newUrls]
      }));
      toast.success("Images uploaded successfully");
    } catch (error) {
      console.error("Failed to upload images:", error);
      toast.error("Failed to upload images");
    } finally {
      setImageUploading(false);
    }
  };

  const handleOpenModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      const attrs = product.attributes || {};
      setActiveAttrKeys(Object.keys(attrs));
      setFormData({
        title: product.title,
        description: product.description || '',
        price: product.price,
        stock: product.stock,
        category_id: product.category_id,
        images: product.images ? product.images.map(img => img.url) : [],
        attributes: attrs
      });
    } else {
      setEditingProduct(null);
      setCatL1('');
      setCatL2('');
      setActiveAttrKeys([]);
      setAttrPickerKey('');
      setFormData({
        title: '',
        description: '',
        price: '',
        stock: '',
        category_id: '',
        images: [],
        attributes: {}
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData
      };
      
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        toast.success("Product updated successfully");
      } else {
        await api.post('/products/', payload);
        toast.success("Product added successfully");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Failed to save product:", error);
      toast.error("Failed to save product details");
    } finally {
      setSaving(false);
    }
  };

  const handleProcessReturn = async (returnId, approved) => {
    setProcessingIds(prev => new Set(prev).add(returnId));
    try {
      await api.post(`/orders/returns/${returnId}/process?approved=${approved}`);
      fetchData(); // Refresh list
      toast.success(approved ? "Return approved" : "Return rejected");
    } catch (error) {
      console.error("Failed to process return:", error);
      const msg = error.response?.data?.detail || error.message;
      toast.error("Failed to process return: " + msg);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(returnId);
        return next;
      });
    }
  };

  const handleShipOrder = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/orders/${selectedOrder.id}/shipments`, {
        carrier: shipFormData.carrier,
        tracking_number: shipFormData.tracking_number,
        tracking_url: `https://www.google.com/search?q=${shipFormData.tracking_number}`
      });
      // Also update order status to shipped
      await api.put(`/orders/${selectedOrder.id}/status`, { status: 'shipped' });
      
      toast.success("Order marked as shipped");
      setIsShipModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Failed to ship order:", error);
      toast.error("Failed to ship order");
    } finally {
      setSaving(false);
    }
  };

  // All per-seller figures come from the backend (compute_seller_share) so
  // every dashboard sees the same slice of the order pie.
  const orderGrossAmount = (o) =>
    o.seller_subtotal != null ? o.seller_subtotal : (o.total_amount || 0);
  const orderFee = (o) => o.seller_fee ?? 0;
  const orderRefund = (o) => {
    if (o.seller_refund != null) return o.seller_refund;
    return (o.returns || [])
      .filter(r => r.status === 'approved' || r.status === 'refunded')
      .reduce((s, r) => s + (r.refund_amount || 0), 0);
  };
  const orderNetAmount = (o) =>
    o.seller_net != null ? o.seller_net : Math.max(0, orderGrossAmount(o) - orderFee(o) - orderRefund(o));

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
      default: // 7d
        startDate.setDate(now.getDate() - 7);
        grouping = 'day';
    }
    startDate.setHours(0, 0, 0, 0);

    const endDate = timeRange === 'custom' && customRange.end ? new Date(customRange.end) : now;
    endDate.setHours(23, 59, 59, 999);

    if (timeRange === 'custom' && startDate > endDate) {
      return []; // Invalid range
    }

    const filteredOrders = orders.filter(o => {
      const d = new Date(o.created_at);
      return d >= startDate && d <= endDate;
    });

    if (grouping === 'day') {
      const data = [];
      const curr = new Date(startDate);
      while (curr <= endDate) {
        const label = curr.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const sales = filteredOrders.filter(o => new Date(o.created_at).toDateString() === curr.toDateString())
          .reduce((sum, o) => sum + orderNetAmount(o), 0);
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
        const sales = filteredOrders.filter(o => {
          const d = new Date(o.created_at);
          return d.getMonth() === m && d.getFullYear() === y;
        }).reduce((sum, o) => sum + orderNetAmount(o), 0);
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
        const sales = filteredOrders.filter(o => {
          const d = new Date(o.created_at);
          return d >= startOfWeek && d <= endOfWeek;
        }).reduce((sum, o) => sum + orderNetAmount(o), 0);
        
        data.push({ label, sales });
        curr.setDate(curr.getDate() + 7);
      }
      return data;
    }

    return [];
  };

  const totalGross = orders.reduce((sum, o) => sum + orderGrossAmount(o), 0);
  const totalFees = orders.reduce((sum, o) => sum + orderFee(o), 0);
  const totalRefunds = orders.reduce((sum, o) => sum + orderRefund(o), 0);
  const totalRevenue = Math.max(0, totalGross - totalFees - totalRefunds);
  const totalOrders = orders.length;
  const activeProducts = products.length;

  if (loading && orders.length === 0 && products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px]">
        <div className="w-16 h-16 border-4 border-[#fb7701] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 flex justify-between items-end"
      >
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Seller Central</h1>
          <p className="text-gray-500 mt-1 font-medium italic">Welcome back, {user?.full_name}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Store Status</p>
          <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full border border-green-100">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-black text-green-600 uppercase tracking-widest">Live & Trading</span>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <StatCard
            title="Net Earnings"
            value={`$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            icon={<CreditCard size={24} />}
            trend={totalRefunds > 0 ? `-$${totalRefunds.toLocaleString(undefined, { minimumFractionDigits: 2 })} refunded` : null}
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
          <StatCard
            title="Total Orders"
            value={totalOrders}
            icon={<ShoppingCart size={24} />}
            trend={`+${orders.filter(o => new Date(o.created_at) > new Date(Date.now() - 86400000)).length} today`}
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
          <StatCard
            title="Active Products"
            value={activeProducts}
            icon={<Package size={24} />}
          />
        </motion.div>
      </div>

      {/* Tiny breakdown under the cards so the seller knows what was deducted */}
      <div className="mb-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-bold text-gray-400 px-1">
        <span title="Your items + shipping fees customers paid">Gross credited (items + shipping): <span className="text-gray-700">${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
        <span title="Platform commission on your items">− Commission: <span className="text-gray-700">${totalFees.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
        <span title="Refunds paid to customers (commission credited back)">− Refunds: <span className="text-gray-700">${totalRefunds.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
        <span>= Net to your account: <span className="text-emerald-600">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2"
        >
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group h-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Revenue Analysis</h3>
                <p className="text-sm text-gray-400 font-medium">Sales performance over time</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {['7d', '1m', '3m', '6m', '1y', 'custom'].map(range => (
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
                    onChange={(e) => setCustomRange({...customRange, start: e.target.value})}
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
                    onChange={(e) => setCustomRange({...customRange, end: e.target.value})}
                    className="bg-transparent text-sm font-bold text-orange-900 outline-none"
                  />
                </div>
              </motion.div>
            )}

            <SalesChart data={getSalesData()} />
          </div>
        </motion.div>
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm"
          >
            <h3 className="text-lg font-black text-gray-900 mb-6 uppercase tracking-widest">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => handleOpenModal()}
                className="bg-[#fb7701] text-white rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-[#e06a01] transition-all shadow-lg shadow-orange-100 group"
              >
                <Plus size={20} />
                <p className="text-[10px] font-black uppercase">Add Prod</p>
              </button>
              <button
                onClick={() => {
                  setActiveTab('orders');
                  setTimeout(() => {
                    document.getElementById('seller-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 0);
                }}
                className="bg-gray-900 text-white rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-black transition-all shadow-lg shadow-gray-100"
              >
                <ShoppingCart size={20} />
                <p className="text-[10px] font-black uppercase">Orders</p>
              </button>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-gradient-to-br from-orange-500 to-[#fb7701] p-8 rounded-[32px] text-white shadow-xl shadow-orange-100"
          >
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Seller Level</p>
            <h3 className="text-2xl font-black mb-4">Elite Merchant</h3>
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="w-3/4 h-full bg-white rounded-full" />
            </div>
            <p className="text-[10px] mt-4 font-bold opacity-80">Next reward: 1,500 points</p>
          </motion.div>
        </div>
      </div>

      <div id="seller-tabs" className="flex flex-wrap gap-4 mb-8 bg-gray-100 p-1.5 rounded-2xl w-fit scroll-mt-6">
        <button 
          onClick={() => setActiveTab('products')}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'products' ? 'bg-white text-[#fb7701] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Products {products.length > 0 && <span className="ml-2 text-[10px] bg-orange-100 px-2 py-0.5 rounded-full">{products.length}</span>}
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'orders' ? 'bg-white text-[#fb7701] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Orders {orders.length > 0 && <span className="ml-2 text-[10px] bg-orange-100 px-2 py-0.5 rounded-full">{orders.length}</span>}
        </button>
        <button 
          onClick={() => setActiveTab('returns')}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'returns' ? 'bg-white text-[#fb7701] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Returns {returns.length > 0 && <span className="ml-2 text-[10px] bg-orange-100 px-2 py-0.5 rounded-full">{returns.length}</span>}
        </button>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden max-h-[600px] overflow-y-auto">
        {activeTab === 'products' && (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-8 py-6">Product</th>
                <th className="px-8 py-6">Price</th>
                <th className="px-8 py-6">Stock</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50/30 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gray-50 rounded-2xl overflow-hidden flex-shrink-0 border border-gray-100">
                        <img src={product.images?.[0]?.url || 'https://via.placeholder.com/150'} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm leading-tight mb-1">{product.title}</p>
                        <p className="text-[10px] font-mono text-gray-400 uppercase">{product.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 font-black text-gray-900">${product.price.toFixed(2)}</td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${product.stock > 10 ? 'bg-green-500' : product.stock > 0 ? 'bg-orange-500' : 'bg-red-500'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-wider ${product.stock > 10 ? 'text-green-600' : product.stock > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                        {product.stock === 0 ? 'OUT OF STOCK' : `${product.stock} IN STOCK`}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => handleOpenModal(product)}
                        className="p-2.5 text-gray-400 hover:text-[#fb7701] hover:bg-orange-50 rounded-xl transition-all"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => setConfirmDelete({ isOpen: true, productId: product.id })}
                        disabled={processingIds.has(product.id)}
                        className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-30"
                      >
                        {processingIds.has(product.id) ? (
                          <div className="w-[18px] h-[18px] border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        
        {activeTab === 'returns' && (
          <div>
            <div className="px-8 py-4 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Return Requests</p>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase text-gray-400">Customer:</span>
                <select 
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="bg-white border border-gray-200 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase outline-none"
                >
                  <option>All Customers</option>
                  {Array.from(new Set(returns.map(r => r.customer_name))).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
            <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-8 py-6">Order / Item</th>
                <th className="px-8 py-6">Customer</th>
                <th className="px-8 py-6">Reason</th>
                <th className="px-8 py-6">Status</th>
                <th className="px-8 py-6 text-right">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {returns.filter(r => customerFilter === 'All Customers' || r.customer_name === customerFilter).map((ret) => (
                <tr key={ret.id} className="hover:bg-gray-50/30 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <p className="font-bold text-gray-900 text-sm">Order #{ret.order?.id?.slice(0, 8) || ret.order_id?.slice(0, 8)}</p>
                      <button 
                        onClick={() => setSelectedDetail({ type: 'return', data: ret })}
                        className="text-[10px] font-black text-[#fb7701] uppercase hover:underline text-left"
                      >
                        View Details
                      </button>
                    </div>
                  </td>
                  <td className="px-8 py-6 font-bold text-gray-900">{ret.customer_name}</td>
                  <td className="px-8 py-6">
                    <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1.5 rounded-xl capitalize">
                      {ret.reason.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                      ret.status === 'requested' ? 'bg-orange-50 text-orange-600' :
                      ret.status === 'approved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {ret.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    {ret.status === 'requested' && (
                      <div className="flex justify-end gap-3">
                        <button 
                          onClick={() => handleProcessReturn(ret.id, false)}
                          disabled={processingIds.has(ret.id)}
                          className="px-4 py-2 text-xs font-black uppercase text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button 
                          onClick={() => handleProcessReturn(ret.id, true)}
                          disabled={processingIds.has(ret.id)}
                          className="px-4 py-2 bg-green-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-green-600 shadow-lg shadow-green-100 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          {processingIds.has(ret.id) && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                          {processingIds.has(ret.id) ? 'Processing' : 'Approve'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {returns.length === 0 && !loading && (
                <tr>
                  <td colSpan="4" className="px-8 py-32 text-center">
                    <RotateCcw size={64} className="mx-auto mb-4 text-gray-200" />
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No return requests</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <div className="px-8 py-4 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Merchant Orders</p>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase text-gray-400">Customer:</span>
                <select 
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="bg-white border border-gray-200 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase outline-none"
                >
                  <option>All Customers</option>
                  {Array.from(new Set(orders.map(o => o.customer_name))).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
            <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-8 py-6">Order ID</th>
                <th className="px-8 py-6">Customer</th>
                <th className="px-8 py-6">Date</th>
                <th className="px-8 py-6">Status</th>
                <th className="px-8 py-6 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.filter(o => customerFilter === 'All Customers' || o.customer_name === customerFilter).map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/30 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <p className="font-bold text-gray-900 text-sm">#{order.id.slice(0, 8)}</p>
                      <button 
                        onClick={() => setSelectedDetail({ type: 'order', data: order })}
                        className="text-[10px] font-black text-[#fb7701] uppercase hover:underline text-left"
                      >
                        View Details
                      </button>
                    </div>
                  </td>
                  <td className="px-8 py-6 font-bold text-gray-900">{order.customer_name}</td>
                  <td className="px-8 py-6 text-gray-500 font-medium">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-6">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                      order.status === 'delivered' ? 'bg-green-50 text-green-600' :
                      order.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                      order.status === 'shipped' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <p className="font-black text-gray-900">${order.total_amount.toFixed(2)}</p>
                      {order.status === 'paid' && (
                        <button 
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsShipModalOpen(true);
                          }}
                          className="text-[10px] font-black text-[#fb7701] uppercase hover:underline"
                        >
                          Ship Now
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && !loading && (
                <tr>
                  <td colSpan="4" className="px-8 py-32 text-center">
                    <ShoppingCart size={64} className="mx-auto mb-4 text-gray-200" />
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No orders yet</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}

      </div>

      {/* Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="relative w-full max-w-lg h-full bg-white shadow-2xl p-10 overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close"
                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <X size={18} />
              </button>
              <h2 className="text-3xl font-black mb-8 pr-12">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Product Title</label>
                  <input 
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] outline-none font-bold"
                    placeholder="e.g. Premium Noise Cancelling Headphones"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Price ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] outline-none font-bold"
                      placeholder="99.99"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Stock Level</label>
                    <input 
                      type="number"
                      required
                      value={formData.stock}
                      onChange={(e) => setFormData({...formData, stock: e.target.value})}
                      className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] outline-none font-bold"
                      placeholder="100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Category</label>
                  <select
                    required
                    value={catL1}
                    onChange={(e) => {
                      const id = e.target.value;
                      setCatL1(id);
                      setCatL2('');
                      setActiveAttrKeys([]);
                      setAttrPickerKey('');
                      setFormData(prev => ({...prev, category_id: id, attributes: {}}));
                    }}
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] outline-none font-bold"
                  >
                    <option value="" disabled>
                      {categories.length === 0 ? "Loading categories..." : "Select Category"}
                    </option>
                    {l1Categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {l2Categories.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Sub-Category</label>
                    <select
                      value={catL2}
                      onChange={(e) => {
                        const id = e.target.value;
                        setCatL2(id);
                        setActiveAttrKeys([]);
                        setAttrPickerKey('');
                        setFormData(prev => ({...prev, category_id: id || catL1, attributes: {}}));
                      }}
                      className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] outline-none font-bold"
                    >
                      <option value="">Select Sub-Category</option>
                      {l2Categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {l3Categories.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Product</label>
                    <select
                      value={l3Categories.find(c => c.id === formData.category_id) ? formData.category_id : ''}
                      onChange={(e) => {
                        const id = e.target.value;
                        setFormData(prev => ({...prev, category_id: id || catL2, attributes: {}}));
                      }}
                      className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] outline-none font-bold"
                    >
                      <option value="">Select Product</option>
                      {l3Categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {categoryAttributes.length > 0 && (() => {
                  const availableToAdd = categoryAttributes.filter(a => !activeAttrKeys.includes(a.key));
                  const renderAttrInput = (attr) => {
                    if (attr.field_type === 'select' && attr.options) {
                      return (
                        <select
                          value={formData.attributes[attr.key] || ''}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            attributes: { ...prev.attributes, [attr.key]: e.target.value }
                          }))}
                          className="flex-1 p-3 bg-white border-2 border-gray-100 rounded-xl focus:border-[#fb7701] outline-none font-bold text-sm"
                        >
                          <option value="">Select {attr.label}</option>
                          {attr.options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      );
                    }
                    if (attr.field_type === 'boolean') {
                      return (
                        <select
                          value={formData.attributes[attr.key] ?? ''}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            attributes: { ...prev.attributes, [attr.key]: e.target.value }
                          }))}
                          className="flex-1 p-3 bg-white border-2 border-gray-100 rounded-xl focus:border-[#fb7701] outline-none font-bold text-sm"
                        >
                          <option value="">Select</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      );
                    }
                    return (
                      <input
                        type={attr.field_type === 'number' ? 'number' : 'text'}
                        value={formData.attributes[attr.key] || ''}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          attributes: { ...prev.attributes, [attr.key]: e.target.value }
                        }))}
                        className="flex-1 p-3 bg-white border-2 border-gray-100 rounded-xl focus:border-[#fb7701] outline-none font-bold text-sm"
                        placeholder={`Enter ${attr.label}`}
                      />
                    );
                  };

                  return (
                    <div className="space-y-3 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Specifications</p>
                        <span className="text-[10px] text-gray-400">{activeAttrKeys.length} added</span>
                      </div>

                      {activeAttrKeys.length === 0 && (
                        <p className="text-xs text-gray-400 italic">No specs added yet. Pick one from the list below.</p>
                      )}

                      {activeAttrKeys.map(key => {
                        const attr = categoryAttributes.find(a => a.key === key);
                        if (!attr) return null;
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <span className="w-28 text-xs font-black uppercase tracking-wider text-gray-600 flex-shrink-0">{attr.label}</span>
                            {renderAttrInput(attr)}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveAttrKeys(prev => prev.filter(k => k !== key));
                                setFormData(prev => {
                                  const next = { ...prev.attributes };
                                  delete next[key];
                                  return { ...prev, attributes: next };
                                });
                              }}
                              className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 p-1"
                              aria-label="Remove specification"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        );
                      })}

                      {availableToAdd.length > 0 && (
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                          <select
                            value={attrPickerKey}
                            onChange={e => setAttrPickerKey(e.target.value)}
                            className="flex-1 p-3 bg-white border-2 border-dashed border-gray-200 rounded-xl text-sm font-bold focus:border-[#fb7701] outline-none"
                          >
                            <option value="">Select a specification to add…</option>
                            {availableToAdd.map(a => (
                              <option key={a.key} value={a.key}>{a.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!attrPickerKey}
                            onClick={() => {
                              if (!attrPickerKey) return;
                              setActiveAttrKeys(prev => [...prev, attrPickerKey]);
                              setAttrPickerKey('');
                            }}
                            className="bg-[#fb7701] text-white px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#e06a01] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            <Plus size={14} /> Add
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Description</label>
                  <textarea 
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] outline-none font-bold"
                    placeholder="Tell your customers about the product..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Product Images</label>
                  <div className="flex flex-col gap-4">
                    {Array.isArray(formData.images) && formData.images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.images.map((url, i) => (
                          <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-gray-100">
                            <img src={url} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                            <button 
                              type="button"
                              onClick={() => setFormData(prev => ({...prev, images: prev.images.filter((_, index) => index !== i)}))}
                              className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="w-full p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl hover:border-[#fb7701] transition-colors cursor-pointer flex flex-col items-center justify-center gap-2">
                      {imageUploading ? (
                        <div className="w-6 h-6 border-2 border-[#fb7701]/30 border-t-[#fb7701] rounded-full animate-spin" />
                      ) : (
                        <>
                          <Plus size={24} className="text-gray-400" />
                          <span className="text-sm font-bold text-gray-500">Upload Images</span>
                        </>
                      )}
                      <input 
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={imageUploading}
                      />
                    </label>
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-[#fb7701] text-white py-4 rounded-2xl font-bold hover:bg-[#e06a01] transition-all shadow-xl shadow-orange-100 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      editingProduct ? 'Save Changes' : 'Publish Product'
                    )}
                  </button>
                  <button 
                    type="button"
                    disabled={saving}
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Ship Order Modal */}
      <AnimatePresence>
        {isShipModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShipModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl p-10 w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-gray-900">Ship Order</h2>
                <button onClick={() => setIsShipModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <p className="text-gray-500 text-sm mb-6 font-medium">Enter shipping details for order <span className="font-bold text-gray-900">#{selectedOrder?.id.slice(0, 8)}</span></p>

              <form onSubmit={handleShipOrder} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Carrier</label>
                  <select 
                    required
                    value={shipFormData.carrier}
                    onChange={(e) => setShipFormData({...shipFormData, carrier: e.target.value})}
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] outline-none font-bold"
                  >
                    <option value="FedEx">FedEx</option>
                    <option value="UPS">UPS</option>
                    <option value="DHL">DHL</option>
                    <option value="BlueDart">BlueDart</option>
                    <option value="Aramex">Aramex</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Tracking Number</label>
                  <input 
                    type="text"
                    required
                    value={shipFormData.tracking_number}
                    onChange={(e) => setShipFormData({...shipFormData, tracking_number: e.target.value})}
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fb7701] outline-none font-bold"
                    placeholder="e.g. 123456789"
                  />
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-[#fb7701] text-white py-4 rounded-2xl font-bold hover:bg-[#e06a01] transition-all shadow-xl shadow-orange-100 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {saving ? 'Processing...' : 'Confirm Shipment'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsShipModalOpen(false)}
                    className="px-8 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedDetail && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDetail(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl p-10 w-full max-w-2xl overflow-hidden"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">
                    {selectedDetail.type === 'order' ? 'Order Details' : 'Return Request Details'}
                  </h2>
                  <p className="text-[10px] font-black uppercase text-gray-400 mt-1">ID: {selectedDetail.data.id}</p>
                </div>
                <button onClick={() => setSelectedDetail(null)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="p-6 bg-gray-50 rounded-3xl">
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Customer Information</p>
                  <p className="text-lg font-black text-gray-900">{selectedDetail.data.customer_name}</p>
                  <p className="text-xs text-gray-500 font-medium mt-1">
                    {selectedDetail.type === 'order' ? selectedDetail.data.shipping_address : 'Standard Return'}
                  </p>
                </div>
                <div className="p-6 bg-gray-50 rounded-3xl">
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Status & Value</p>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-gray-900">
                      ${(selectedDetail.data.total_amount || selectedDetail.data.refund_amount || 0).toFixed(2)}
                    </span>
                    <span className="text-[10px] font-black uppercase bg-orange-100 text-orange-600 px-2 py-0.5 rounded-md">
                      {selectedDetail.data.status}
                    </span>
                  </div>
                  {selectedDetail.type === 'return' && (
                    <p className="text-[10px] font-bold text-gray-500 mt-2 italic">Reason: {selectedDetail.data.reason}</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 mb-4">Items</p>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {(selectedDetail.type === 'order' ? selectedDetail.data.items : selectedDetail.data.items?.map(i => i.order_item) || []).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <img src={item.product_image || 'https://via.placeholder.com/150'} alt="" className="w-14 h-14 rounded-xl object-cover" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900 line-clamp-1">{item.product_title}</p>
                        <p className="text-[10px] text-gray-400 font-black uppercase">Qty: {item.quantity} × ${item.price.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  onClick={() => setSelectedDetail(null)}
                  className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all"
                >
                  Close View
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <ConfirmModal 
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, productId: null })}
        onConfirm={() => handleDeleteProduct(confirmDelete.productId)}
        title="Delete Product?"
        message="This action cannot be undone. All product data and images will be permanently removed from the store."
        confirmText="Delete Product"
        type="danger"
      />
    </div>
  );
};

export default SellerDashboard;
