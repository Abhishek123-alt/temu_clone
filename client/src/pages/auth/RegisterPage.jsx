import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { motion } from 'framer-motion';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    referral_code: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authService.register(formData);
      navigate('/login');
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
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-[#f6f6f6] px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-white rounded-[32px] shadow-xl shadow-orange-500/5 p-10 border border-gray-50"
      >
        <div className="text-center mb-10">
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Join TEMU</h2>
          <p className="text-gray-500 mt-3 font-medium">Create an account and start saving today</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-50 text-red-600 p-4 rounded-2xl mb-8 text-sm font-semibold border border-red-100"
          >
             ⚠️ {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Full Name</label>
              <input
                name="full_name"
                type="text"
                className="input-field"
                placeholder="John Doe"
                value={formData.full_name}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Phone</label>
              <input
                name="phone"
                type="tel"
                className="input-field"
                placeholder="+1 234 567 890"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Referral Code (Optional)</label>
            <input
              name="referral_code"
              type="text"
              className="input-field"
              placeholder="Enter code from a friend"
              value={formData.referral_code}
              onChange={handleChange}
              maxLength={8}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
            <input
              name="email"
              type="email"
              className="input-field"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Password</label>
            <input
              name="password"
              type="password"
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
            className="w-full btn-primary py-4 text-lg mt-4 disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : 'Create Account'}
          </button>
        </form>

        <div className="mt-10 pt-10 border-t border-gray-100 text-center">
          <p className="text-gray-500 font-medium">
            Already have an account?{' '}
            <Link to="/login" className="text-[#fb7701] font-bold hover:underline ml-1">
              Sign In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
