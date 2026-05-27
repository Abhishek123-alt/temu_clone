import React, { useCallback, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { authService } from '../../services/authService';
import { motion } from 'framer-motion';
import GoogleSignInButton from '../../components/common/GoogleSignInButton';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const RegisterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialRole = queryParams.get('role') === 'seller' ? 'SELLER_PENDING' : 'CUSTOMER';
  const nextParam = queryParams.get('next');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    referral_code: '',
    requested_role: initialRole,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);
  const mergeGuestCart = useCartStore((state) => state.mergeGuestCart);

  const handleGoogleCredential = useCallback(async (credential) => {
    setLoading(true);
    setError('');
    try {
      const data = await authService.loginWithGoogle({
        credential,
        // Pass through any referral code typed before clicking Google —
        // process_referral is idempotent for already-linked users.
        referralCode: formData.referral_code || undefined,
      });
      setToken(data.access_token);
      const user = await authService.getMe();
      setUser(user);
      await mergeGuestCart();
      navigate(nextParam || '/');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  }, [formData.referral_code, mergeGuestCart, navigate, nextParam, setToken, setUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authService.register(formData);
      // Forward ?next= so the new user lands back at checkout after signing in.
      navigate(nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : '/login');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-start justify-center bg-[#f6f6f6] px-4 pt-4 pb-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-white rounded-[28px] shadow-xl shadow-orange-500/5 p-5 border border-gray-50"
      >
        <div className="text-center mb-3">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Join TEMU</h2>
          <p className="text-gray-500 mt-1 font-medium text-sm">Create an account and start saving today</p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-50 text-red-600 p-3 rounded-2xl mb-4 text-sm font-semibold border border-red-100"
          >
             ⚠️ {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
              <input
                name="full_name"
                type="text"
                autoComplete="off"
                className="input-field"
                placeholder="John Doe"
                value={formData.full_name}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Phone</label>
              <input
                name="phone"
                type="tel"
                autoComplete="off"
                className="input-field"
                placeholder="+1 234 567 890"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Referral Code (Optional)</label>
            <input
              name="referral_code"
              type="text"
              autoComplete="off"
              className="input-field"
              placeholder="Enter code from a friend"
              value={formData.referral_code}
              onChange={handleChange}
              maxLength={8}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
            <input
              name="email"
              type="email"
              autoComplete="off"
              className="input-field"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              className="input-field"
              placeholder="Minimum 8 characters"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3.5 text-base mt-1 disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : 'Create Account'}
          </button>
        </form>

        {GOOGLE_CLIENT_ID && (
          <div className="mt-4">
            <div className="relative flex items-center my-2.5">
              <div className="flex-grow border-t border-gray-200" />
              <span className="mx-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                or
              </span>
              <div className="flex-grow border-t border-gray-200" />
            </div>
            <GoogleSignInButton
              clientId={GOOGLE_CLIENT_ID}
              onCredential={handleGoogleCredential}
              disabled={loading}
            />
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-gray-100 text-center space-y-1.5">
          <p className="text-gray-500 font-medium text-base">
            Already have an account?{' '}
            <Link
              to={nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : '/login'}
              className="text-[#fb7701] font-bold hover:underline ml-1"
            >
              Sign In
            </Link>
          </p>
          <p className="text-gray-500 text-sm font-medium">
            Want to start selling?{' '}
            <Link
              to="/seller/onboarding"
              className="text-gray-700 font-bold hover:text-[#fb7701] hover:underline ml-1"
            >
              Start your business profile
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
