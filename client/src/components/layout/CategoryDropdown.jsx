import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { productService } from '../../services/productService';

const CategoryDropdown = () => {
  const [categories, setCategories] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await productService.getCategories();
        setCategories(data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };
    fetchCategories();
  }, []);

  const handleCategoryClick = (categoryId) => {
    setIsOpen(false);
    // Maintain current path (either / or /deals) but update the query parameter
    const path = location.pathname;
    navigate(`${path}?category_id=${categoryId}`);
  };

  const handleAllClick = () => {
    setIsOpen(false);
    const path = location.pathname;
    navigate(path);
  };

  return (
    <div className="relative" onMouseLeave={() => setIsOpen(false)}>
      <button 
        onMouseEnter={() => setIsOpen(true)}
        className="flex items-center gap-1 text-sm font-bold text-gray-700 hover:text-[#fb7701] h-10 px-4 rounded-full transition-colors whitespace-nowrap"
      >
        Categories <ChevronDown size={16} />
      </button>

      {isOpen && (
        <div className="absolute top-10 left-0 w-64 bg-white border border-gray-100 shadow-xl rounded-2xl py-2 z-50">
          <button
            onClick={handleAllClick}
            className="w-full text-left px-6 py-3 text-sm font-bold text-gray-700 hover:bg-orange-50 hover:text-[#fb7701] transition-colors"
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className="w-full text-left px-6 py-3 text-sm font-medium text-gray-600 hover:bg-orange-50 hover:text-[#fb7701] transition-colors"
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryDropdown;
