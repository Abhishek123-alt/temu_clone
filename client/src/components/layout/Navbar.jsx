import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Search, Menu, Bell, Heart, X, Trophy, Zap, Gamepad2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { useWishlistStore } from '../../store/wishlistStore';
import { useEffect } from 'react';

import CategoryDropdown from './CategoryDropdown';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from '../../i18n/useTranslation';

const Navbar = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { getTotalItems } = useCartStore();
  const { wishlist, fetchWishlist } = useWishlistStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist();
    }
  }, [isAuthenticated, fetchWishlist]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate('/');
    }
  };

  // Routes where the search bar should be hidden
  const hideSearchRoutes = ['/login', '/register', '/admin', '/seller', '/seller/onboarding'];
  const isBusinessUser = isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'SELLER');
  const shouldShowSearch = !isBusinessUser && !hideSearchRoutes.some(route => location.pathname.startsWith(route));

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 lg:h-20 gap-4">
          {/* Logo */}
          <Link to={isAuthenticated ? (user?.role === 'SELLER' ? '/seller' : (user?.role === 'ADMIN' ? '/admin' : '/')) : '/'} className="flex-shrink-0 flex items-center">
            <span className="text-3xl font-extrabold tracking-tighter text-[#fb7701]">TEMU</span>
          </Link>

          {/* Search Bar & Categories */}
          {shouldShowSearch ? (
            <div className="hidden md:flex flex-grow max-w-3xl items-center gap-2">
              {location.pathname === '/' && <CategoryDropdown />}
              <form onSubmit={handleSearch} className="relative w-full">
                <input
                  type="text"
                  placeholder={t('nav.search_placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-100 border-none rounded-full py-2.5 pl-5 pr-20 focus:ring-2 focus:ring-[#fb7701] transition-all"
                />
                <div className="absolute right-0 top-0 h-full flex items-center pr-2 gap-2">
                  {searchQuery && (
                    <button 
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        navigate('/');
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <button type="submit" className="h-9 w-9 flex items-center justify-center bg-[#fb7701] rounded-full text-white hover:bg-[#e06a01] transition-colors">
                    <Search size={18} />
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex-grow"></div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 lg:gap-6">
            <LanguageSwitcher />

            {isAuthenticated && user?.role === 'ADMIN' && (
              <Link to="/admin" className="text-sm font-bold text-gray-700 hover:text-[#fb7701]">{t('nav.admin')}</Link>
            )}
            {isAuthenticated && user?.role === 'SELLER' && (
              <Link to="/seller" className="text-sm font-bold text-gray-700 hover:text-[#fb7701]">{t('nav.seller_central')}</Link>
            )}

            {isAuthenticated ? (
              <>
                <Link to="/profile" className="flex flex-col items-center text-gray-700 hover:text-[#fb7701] transition-colors">
                  <User size={24} />
                  <span className="text-[10px] font-medium hidden lg:block">{user?.full_name?.split(' ')[0]}</span>
                </Link>

                {user?.role !== 'SELLER' && user?.role !== 'ADMIN' && (
                  <Link to="/profile/games" className="flex flex-col items-center text-gray-700 hover:text-[#fb7701] transition-colors">
                    <Gamepad2 size={24} />
                    <span className="text-[10px] font-medium hidden lg:block">Games</span>
                  </Link>
                )}
              </>
            ) : (
              <Link to="/login" className="flex flex-col items-center text-gray-700 hover:text-[#fb7701] transition-colors">
                <User size={24} />
                <span className="text-[10px] font-medium hidden lg:block">{t('nav.signin')}</span>
              </Link>
            )}

            {user?.role !== 'SELLER' && user?.role !== 'ADMIN' && (
              <>
                <Link to="/profile/quests" className="flex flex-col items-center relative text-gray-700 hover:text-[#fb7701] transition-colors">
                  <Trophy size={24} />
                  <span className="text-[10px] font-medium hidden lg:block">{t('nav.quests')}</span>
                </Link>

                <Link to="/wishlist" className="flex flex-col items-center relative text-gray-700 hover:text-[#fb7701] transition-colors">
                  <Heart size={24} />
                  <span className="text-[10px] font-medium hidden lg:block">{t('nav.wishlist')}</span>
                  {wishlist.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {wishlist.length}
                    </span>
                  )}
                </Link>

                <Link to="/cart" className="flex flex-col items-center relative text-gray-700 hover:text-[#fb7701] transition-colors">
                  <ShoppingCart size={24} />
                  <span className="text-[10px] font-medium hidden lg:block">{t('nav.cart')}</span>
                  {getTotalItems() > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#fb7701] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {getTotalItems()}
                    </span>
                  )}
                </Link>
              </>
            )}

            <button className="md:hidden text-gray-700 p-2">
              <Menu size={24} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
