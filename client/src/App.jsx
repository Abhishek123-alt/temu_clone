import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomePage from './pages/home/HomePage';
import DealsPage from './pages/home/DealsPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ProfilePage from './pages/profile/ProfilePage';
import QuestsPage from './pages/profile/QuestsPage';
import MiniGamesPage from './pages/profile/MiniGamesPage';
import WishlistPage from './pages/wishlist/WishlistPage';
import AddressesPage from './pages/profile/AddressesPage';
import PaymentMethodsPage from './pages/profile/PaymentMethodsPage';
import OnboardingWizard from './pages/seller/OnboardingWizard';
import SellerDashboard from './pages/seller/SellerDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import CartPage from './pages/cart/CartPage';
import CheckoutPage from './pages/cart/CheckoutPage';
import PaymentPage from './pages/cart/PaymentPage';
import OrdersPage from './pages/orders/OrdersPage';
import OrderDetailPage from './pages/orders/OrderDetailPage';
import ProductDetailPage from './pages/product/ProductDetailPage';
import Layout from './components/layout/Layout';
import { useAuthStore } from './store/authStore';
import Toast from './components/common/Toast';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();
  
  return isAuthenticated ? children : <Navigate to="/login" state={{ from: location }} replace />;
};

import NewArrivalsPage from './pages/home/NewArrivalsPage';
import SearchPage from './pages/product/SearchPage';

function App() {
  return (
    <Router>
      <Toast />
      <Layout>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/new-arrivals" element={<NewArrivalsPage />} />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/profile/quests"
            element={
              <ProtectedRoute>
                <QuestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/games"
            element={
              <ProtectedRoute>
                <MiniGamesPage />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/wishlist" 
            element={
              <ProtectedRoute>
                <WishlistPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile/addresses" 
            element={
              <ProtectedRoute>
                <AddressesPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile/payment-methods" 
            element={
              <ProtectedRoute>
                <PaymentMethodsPage />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/seller/onboarding"
            element={<OnboardingWizard />}
          />
          <Route
            path="/seller"
            element={
              <ProtectedRoute>
                <SellerDashboard />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route path="/cart" element={<CartPage />} />
          <Route 
            path="/checkout" 
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/payment" 
            element={
              <ProtectedRoute>
                <PaymentPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/orders" 
            element={
              <ProtectedRoute>
                <OrdersPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/orders/:orderId" 
            element={
              <ProtectedRoute>
                <OrderDetailPage />
              </ProtectedRoute>
            } 
          />
          <Route path="/product/:slug" element={<ProductDetailPage />} />
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
