import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { productService } from '../../services/productService';
import ProductCard from '../../components/products/ProductCard';
import { Search, SlidersHorizontal, ChevronDown, ArrowLeft, X, Filter, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SearchPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [facets, setFacets] = useState({ attributes: [], price_min: null, price_max: null });
  const [selectedFilters, setSelectedFilters] = useState({});
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const query = queryParams.get('q') || '';
  const activeCategoryId = queryParams.get('category_id');

  const sortOptions = [
    { label: 'Relevance', value: '' },
    { label: 'Top Sales', value: 'top_sales' },
    { label: 'Price: Low to High', value: 'price_asc' },
    { label: 'Price: High to Low', value: 'price_desc' },
  ];

  // Reset selected filters during render when the search context changes
  // (the React-recommended alternative to setState-in-effect for prop-derived resets).
  const contextKey = `${query}|${activeCategoryId || ''}`;
  const [prevContextKey, setPrevContextKey] = useState(contextKey);
  if (prevContextKey !== contextKey) {
    setPrevContextKey(contextKey);
    setSelectedFilters({});
    setPriceRange({ min: '', max: '' });
  }

  useEffect(() => {
    productService.getFacets(query, activeCategoryId)
      .then(data => setFacets(data || { attributes: [], price_min: null, price_max: null }))
      .catch(() => setFacets({ attributes: [], price_min: null, price_max: null }));
  }, [query, activeCategoryId]);

  const attributes = useMemo(() => facets.attributes || [], [facets.attributes]);
  const attributeLabelByKey = useMemo(() => {
    const m = {};
    attributes.forEach(a => { m[a.key] = a.label; });
    return m;
  }, [attributes]);

  const priceFilterActive = priceRange.min !== '' || priceRange.max !== '';
  const activeFilterCount = useMemo(
    () =>
      Object.values(selectedFilters).filter(v => v !== '' && v !== undefined && v !== null).length +
      (priceFilterActive ? 1 : 0),
    [selectedFilters, priceFilterActive]
  );

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const data = await productService.getProducts(
          0, 50, query, false, false, activeCategoryId, false, sortBy, selectedFilters,
          priceRange.min === '' ? null : priceRange.min,
          priceRange.max === '' ? null : priceRange.max,
          true, // include_out_of_stock — show OOS as disabled cards on search/list
        );
        setProducts(data);
      } catch (error) {
        console.error('Failed to fetch search data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [query, sortBy, activeCategoryId, selectedFilters, priceRange]);

  const setFilter = (key, value) => {
    setSelectedFilters(prev => {
      const next = { ...prev };
      if (value === '' || value === undefined || value === null) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const clearAll = () => {
    setSelectedFilters({});
    setPriceRange({ min: '', max: '' });
  };

  const handleSortChange = (value) => {
    setSortBy(value);
    setIsSortOpen(false);
  };

  const hasPriceRange =
    facets.price_min !== null && facets.price_max !== null && facets.price_min !== facets.price_max;
  const hasAnyFilterUI = attributes.length > 0 || hasPriceRange;

  return (
    <div className="bg-gradient-to-b from-orange-50/40 via-gray-50 to-gray-50 min-h-screen">
      {/* Hero header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-500 hover:text-[#fb7701] font-bold mb-6 transition-colors group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to Home
          </button>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#fb7701] mb-2">Search Results</p>
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 flex items-center gap-3 flex-wrap">
                <span className="truncate">
                  "<span className="text-[#fb7701]">{query || 'All Products'}</span>"
                </span>
                {!loading && (
                  <span className="text-xs font-black uppercase tracking-widest text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">
                    {products.length} {products.length === 1 ? 'result' : 'results'}
                  </span>
                )}
              </h1>
              {!loading && hasPriceRange && (
                <p className="text-sm font-bold text-gray-500 mt-2">
                  From <span className="text-gray-900">${Math.floor(facets.price_min)}</span> to{' '}
                  <span className="text-gray-900">${Math.ceil(facets.price_max)}</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Filter dropdown */}
              {hasAnyFilterUI && (
                <div className="relative">
                  <button
                    onClick={() => { setIsFilterOpen(!isFilterOpen); setIsSortOpen(false); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black transition-all shadow-sm border-2 ${
                      activeFilterCount > 0 || isFilterOpen
                        ? 'bg-[#fb7701] border-[#fb7701] text-white hover:bg-[#e06a01]'
                        : 'bg-white border-gray-200 text-gray-800 hover:border-[#fb7701] hover:text-[#fb7701]'
                    }`}
                  >
                    <Filter size={16} />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="ml-1 bg-white/25 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                        {activeFilterCount}
                      </span>
                    )}
                    <ChevronDown size={14} className={`transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isFilterOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-2 w-[22rem] sm:w-[24rem] bg-white border border-gray-100 shadow-2xl rounded-2xl z-50 overflow-hidden"
                      >
                        {/* Panel header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50/60 to-white">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center">
                              <Filter size={15} className="text-[#fb7701]" />
                            </div>
                            <h3 className="text-base font-black text-gray-900">Filters</h3>
                          </div>
                          {activeFilterCount > 0 && (
                            <button
                              onClick={clearAll}
                              className="text-[11px] font-black uppercase tracking-wider text-[#fb7701] hover:bg-orange-100 bg-orange-50 px-3 py-1.5 rounded-full transition-colors"
                            >
                              Clear {activeFilterCount}
                            </button>
                          )}
                        </div>

                        {/* Scrollable panel body */}
                        <div className="max-h-[28rem] overflow-y-auto px-5 py-4 space-y-6">
                          {/* Price filter */}
                          {hasPriceRange && (
                            <div className="pb-5 border-b border-gray-100">
                              <p className="text-[11px] font-black uppercase tracking-widest text-gray-900 mb-3 flex items-center gap-1.5">
                                <Tag size={11} className="text-[#fb7701]" /> Price Range
                              </p>
                              <p className="text-xs font-bold text-gray-400 mb-3">
                                Available ${Math.floor(facets.price_min)} – ${Math.ceil(facets.price_max)}
                              </p>
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">$</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={priceRange.min}
                                    onChange={e => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                                    placeholder="Min"
                                    className="w-full pl-7 pr-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#fb7701]/30 focus:border-[#fb7701]"
                                  />
                                </div>
                                <span className="text-gray-400 font-bold">—</span>
                                <div className="relative flex-1">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">$</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={priceRange.max}
                                    onChange={e => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                                    placeholder="Max"
                                    className="w-full pl-7 pr-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#fb7701]/30 focus:border-[#fb7701]"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Attribute facets */}
                          {attributes.map((attr, idx) => {
                            const values = attr.values || [];
                            return (
                              <div
                                key={attr.key}
                                className={idx < attributes.length - 1 ? 'pb-5 border-b border-gray-100' : ''}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-[11px] font-black uppercase tracking-widest text-gray-900">
                                    {attr.label}
                                  </p>
                                  {values.length > 0 && (
                                    <span className="text-[10px] font-black text-gray-300">{values.length}</span>
                                  )}
                                </div>

                                {attr.field_type === 'boolean' ? (
                                  <select
                                    value={selectedFilters[attr.key] ?? ''}
                                    onChange={e => setFilter(attr.key, e.target.value)}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#fb7701]/30 focus:border-[#fb7701]"
                                  >
                                    <option value="">Any</option>
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                  </select>
                                ) : values.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {values.map(({ value, count }) => {
                                      const checked = selectedFilters[attr.key] === value;
                                      return (
                                        <button
                                          key={value}
                                          onClick={() => setFilter(attr.key, checked ? '' : value)}
                                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                            checked
                                              ? 'bg-[#fb7701] text-white border-[#fb7701] shadow-sm shadow-orange-200'
                                              : 'bg-white text-gray-700 border-gray-200 hover:border-[#fb7701] hover:text-[#fb7701]'
                                          }`}
                                        >
                                          <span>{value}</span>
                                          <span
                                            className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                                              checked ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                                            }`}
                                          >
                                            {count}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <input
                                    type={attr.field_type === 'number' ? 'number' : 'text'}
                                    value={selectedFilters[attr.key] || ''}
                                    onChange={e => setFilter(attr.key, e.target.value)}
                                    placeholder={`Any ${attr.label}`}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#fb7701]/30 focus:border-[#fb7701]"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Panel footer */}
                        <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
                          <button
                            onClick={clearAll}
                            disabled={activeFilterCount === 0}
                            className="flex-1 py-2.5 rounded-full text-xs font-black uppercase tracking-widest text-gray-700 bg-white border border-gray-200 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Reset
                          </button>
                          <button
                            onClick={() => setIsFilterOpen(false)}
                            className="flex-1 py-2.5 rounded-full text-xs font-black uppercase tracking-widest text-white bg-[#fb7701] hover:bg-[#e06a01] transition-colors"
                          >
                            Show {products.length} {products.length === 1 ? 'result' : 'results'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setIsSortOpen(!isSortOpen); setIsFilterOpen(false); }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-gray-200 rounded-full text-sm font-black text-gray-800 hover:border-[#fb7701] hover:text-[#fb7701] transition-all shadow-sm"
                >
                  <SlidersHorizontal size={16} />
                  Sort: {sortOptions.find(o => o.value === sortBy)?.label}
                  <ChevronDown size={14} className={`transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isSortOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-60 bg-white border border-gray-100 shadow-2xl rounded-2xl py-2 z-50"
                    >
                      {sortOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleSortChange(opt.value)}
                          className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors ${
                            sortBy === opt.value
                              ? 'text-[#fb7701] bg-orange-50'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="product-feed" className="max-w-7xl mx-auto px-4 py-8 scroll-mt-40">
        {!loading && activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-5 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1 mr-2">Active</span>
            {priceFilterActive && (
              <button
                onClick={() => setPriceRange({ min: '', max: '' })}
                className="flex items-center gap-1.5 bg-orange-50 text-[#fb7701] hover:bg-orange-100 px-3 py-1.5 rounded-full text-xs font-bold border border-orange-100 transition-colors"
              >
                <span className="text-orange-400">Price:</span>
                <span>
                  ${priceRange.min || Math.floor(facets.price_min || 0)} – ${priceRange.max || Math.ceil(facets.price_max || 0)}
                </span>
                <X size={12} />
              </button>
            )}
            {Object.entries(selectedFilters).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setFilter(k, '')}
                className="flex items-center gap-1.5 bg-orange-50 text-[#fb7701] hover:bg-orange-100 px-3 py-1.5 rounded-full text-xs font-bold border border-orange-100 transition-colors"
              >
                <span className="text-orange-400">{attributeLabelByKey[k] || k}:</span>
                <span>{String(v)}</span>
                <X size={12} />
              </button>
            ))}
            <button
              onClick={clearAll}
              className="ml-auto text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-[#fb7701] px-3 py-1.5 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-12 h-12 border-4 border-orange-100 border-t-[#fb7701] rounded-full animate-spin" />
            <p className="mt-4 text-sm font-black uppercase tracking-widest text-gray-500">
              Searching...
            </p>
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white rounded-[40px] shadow-sm border border-gray-100">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search size={40} className="text-gray-300" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">No products found</h2>
            <p className="text-gray-500 font-medium mb-8">Try adjusting your search or filters to find what you're looking for.</p>
            <button
              onClick={() => { clearAll(); navigate('/'); }}
              className="bg-[#fb7701] text-white px-8 py-3 rounded-full font-black uppercase tracking-widest hover:bg-[#e06a01] transition-all"
            >
              Back to Shopping
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
