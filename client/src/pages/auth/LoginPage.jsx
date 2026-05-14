import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { authService } from '../../services/authService';
import { motion } from 'framer-motion';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);
  const fetchCart = useCartStore((state) => state.fetchCart);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await authService.login({ email, password });
      setToken(data.access_token);
      const user = await authService.getMe(); 
      setUser(user);
      await fetchCart(); // Sync cart with backend after login
      
      const from = location.state?.from?.pathname || null;
      
      // Redirect based on role
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else if (user.role === 'SELLER') {
        navigate('/seller');
      } else if (user.role === 'SELLER_PENDING') {
        navigate('/seller/onboarding');
      } else if (from) {
        navigate(from, { replace: true });
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-[#f6f6f6] px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[32px] shadow-xl shadow-orange-500/5 p-10 border border-gray-50"
      >
        <div className="text-center mb-10">
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Welcome Back</h2>
          <p className="text-gray-500 mt-3 font-medium">Log in to your Temu account</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-50 text-red-600 p-4 rounded-2xl mb-8 text-sm font-semibold flex items-center border border-red-100"
          >
            <span className="mr-2">⚠️</span> {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
            <input
              type="email"
              className="input-field"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end pt-1">
            <a href="#" className="text-sm font-bold text-gray-400 hover:text-[#fb7701] transition-colors">Forgot Password?</a>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn-primary py-4 text-lg mt-4 disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : 'Sign In'}
          </button>
        </form>

        <div className="mt-10 pt-10 border-t border-gray-100 text-center space-y-4">
          <p className="text-gray-500 font-medium">
            New to Temu?{' '}
            <Link to="/register" className="text-[#fb7701] font-bold hover:underline ml-1">
              Join for Free
            </Link>
          </p>
          <p className="text-gray-400 text-sm font-medium">
            Interested in selling?{' '}
            <Link to="/seller/onboarding" className="text-gray-600 font-bold hover:text-[#fb7701] hover:underline ml-1">
              Start your business
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
