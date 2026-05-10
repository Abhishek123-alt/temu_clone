import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productService } from '../../services/productService';
import ProductCard from '../../components/products/ProductCard';
import { Zap } from 'lucide-react';

const DealsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const location = useLocation();

  useEffect(() => {
    const fetchDeals = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams(location.search);
        const category_id = queryParams.get('category_id');
        // Fetch only products with deals, filtered by category
        const data = await productService.getProducts(0, 50, '', true, false, category_id);
        setProducts(data);
      } catch (error) {
        console.error('Failed to fetch deals:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDeals();
  }, [location.search]);

  if (loading && products.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-[#fb7701] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Deals Header */}
      <div className="bg-red-50 rounded-[32px] p-8 mb-8 text-center border border-red-100 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white mb-4 animate-pulse">
            <Zap size={32} />
          </div>
          <h1 className="text-4xl font-black text-gray-900 uppercase tracking-tight">
            Flash <span className="text-red-500">Sales</span>
          </h1>
          <p className="text-gray-600 mt-2 font-medium">
            Limited time offers with massive discounts. Hurry before they sell out!
          </p>
        </div>
      </div>

      {/* Product Feed */}
      <div className="mb-8 flex items-center justify-between">

        <h2 className="text-2xl font-extrabold text-gray-900">Current Deals</h2>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <p className="text-gray-500 font-medium">No active deals right now. Check back later!</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 text-[#fb7701] font-bold hover:underline"
          >
            Browse Normal Products
          </button>
        </div>
      )}
    </div>
  );
};

export default DealsPage;
