import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { productService } from '../../services/productService';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { motion } from 'framer-motion';

const SellerDashboard = () => {
  const { user } = useAuthStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyProducts = async () => {
      try {
        const allProducts = await productService.getProducts();
        // Filter products belonging to this seller
        const myProducts = allProducts.filter(p => p.seller_id === user.id);
        setProducts(myProducts);
      } catch (error) {
        console.error('Error fetching seller products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMyProducts();
  }, [user.id]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Seller Central</h1>
          <p className="text-gray-500 mt-1">Manage your products and sales</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={20} /> Add New Product
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4">Product</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Price</th>
              <th className="px-6 py-4">Stock</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <img src={product.images[0]?.url} className="w-12 h-12 rounded-lg object-cover" />
                    <span className="font-bold text-gray-900">{product.title}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500 font-medium text-sm">Electronics</td>
                <td className="px-6 py-4 font-bold text-gray-900">${product.price}</td>
                <td className="px-6 py-4">
                  <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                    {product.stock} in stock
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="p-2 text-gray-400 hover:text-[#fb7701]"><Edit size={18} /></button>
                    <button className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && !loading && (
              <tr>
                <td colSpan="5" className="px-6 py-20 text-center text-gray-400">
                  <Package size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-medium">No products found. Start by adding your first item!</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SellerDashboard;
