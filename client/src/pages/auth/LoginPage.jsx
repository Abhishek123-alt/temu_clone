import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { authService } from '../../services/authService';
import { motion } from 'framer-motion';
import { LifeBuoy, ShieldOff, Clock, Mail, X, BellRing, CheckCircle2 } from 'lucide-react';
import ContactSupportModal, { SUPPORT_EMAIL } from '../../components/common/ContactSupportModal';
import GoogleSignInButton from '../../components/common/GoogleSignInButton';
import { supportService } from '../../services/supportService';
import { useTranslation } from '../../i18n/useTranslation';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // errorState: null | { kind: 'generic' | 'deactivated' | 'pending', message: string }
  const [errorState, setErrorState] = useState(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // notifyStatus: 'idle' | 'sending' | 'sent' | 'error' — only used on the
  // SELLER_APPLICATION_PENDING panel for the Notify Admin button.
  const [notifyStatus, setNotifyStatus] = useState('idle');
  const [notifyError, setNotifyError] = useState('');
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);
  const mergeGuestCart = useCartStore((state) => state.mergeGuestCart);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const nextParam = new URLSearchParams(location.search).get('next');

  // Auto-dismiss the generic "Incorrect email or password" banner after 5s.
  // Deactivation / pending panels intentionally stick around — they have
  // actions (Contact Support) the user needs time to read and click.
  useEffect(() => {
    if (errorState?.kind !== 'generic') return;
    const t = setTimeout(() => setErrorState(null), 5000);
    return () => clearTimeout(t);
  }, [errorState]);

  // Once the pending user has notified admin, leave the green confirmation up
  // for a few seconds so they can read it, then clear the whole panel.
  useEffect(() => {
    if (notifyStatus !== 'sent') return;
    const t = setTimeout(() => {
      setErrorState(null);
      setNotifyStatus('idle');
    }, 4000);
    return () => clearTimeout(t);
  }, [notifyStatus]);

  const handleNotifyAdmin = async () => {
    setNotifyStatus('sending');
    setNotifyError('');
    try {
      await supportService.notifyAdmin(email);
      setNotifyStatus('sent');
    } catch (err) {
      setNotifyStatus('error');
      const detail = err.response?.data?.detail;
      setNotifyError(
        typeof detail === 'string' ? detail : 'Could not notify admin. Please try again later.'
      );
    }
  };

  // Shared landing logic for both password and Google sign-in. Lives here
  // (not in authStore) because it's coupled to react-router navigate + the
  // ?next= search param both flows respect.
  const finishLogin = useCallback(async (accessToken) => {
    setToken(accessToken);
    const user = await authService.getMe();
    setUser(user);
    await mergeGuestCart();

    const from = nextParam || location.state?.from?.pathname || null;
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
  }, [location.state, mergeGuestCart, navigate, nextParam, setToken, setUser]);

  const handleApiError = useCallback((err) => {
    const detail = err.response?.data?.detail;
    if (detail && typeof detail === 'object' && detail.code) {
      if (detail.code === 'ACCOUNT_DEACTIVATED') {
        setErrorState({ kind: 'deactivated', message: detail.message });
      } else if (detail.code === 'SELLER_APPLICATION_PENDING') {
        setErrorState({ kind: 'pending', message: detail.message });
      } else {
        setErrorState({ kind: 'generic', message: detail.message });
      }
    } else {
      setErrorState({
        kind: 'generic',
        message: typeof detail === 'string' ? detail : t('login.invalid'),
      });
    }
  }, [t]);

  const handleGoogleCredential = useCallback(async (credential) => {
    setLoading(true);
    setErrorState(null);
    try {
      const data = await authService.loginWithGoogle({ credential });
      await finishLogin(data.access_token);
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  }, [finishLogin, handleApiError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorState(null);
    setNotifyStatus('idle');
    setNotifyError('');
    try {
      const data = await authService.login({ email, password });
      await finishLogin(data.access_token);
    } catch (err) {
      // Backend may return detail as a string (generic errors) or a
      // { code, message } object (account state errors — see auth/services.py).
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-[#f6f6f6] px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[28px] shadow-xl shadow-orange-500/5 p-8 border border-gray-50"
      >
        <div className="text-center mb-6">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">{t('login.welcome_back')}</h2>
          <p className="text-gray-500 mt-2 font-medium text-sm">{t('login.subtitle')}</p>
        </div>

        {errorState?.kind === 'deactivated' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative mb-8 rounded-2xl border border-red-100 bg-red-50 p-5"
          >
            <button
              type="button"
              onClick={() => setErrorState(null)}
              aria-label="Dismiss"
              className="absolute top-3 right-3 p-1.5 rounded-full text-red-400 hover:text-red-700 hover:bg-red-100 transition-all"
            >
              <X size={16} />
            </button>
            <div className="flex items-start gap-3 pr-6">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                <ShieldOff size={20} className="text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black uppercase tracking-wide text-red-700">
                  Account restricted
                </p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-red-600">
                  {errorState.message}
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Reactivate my Temu account')}&body=${encodeURIComponent(`Account email: ${email || '<your account email>'}\n\nHi Support, my account appears to be deactivated. Please help me restore access.`)}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-red-700 hover:text-red-900 underline decoration-red-300 underline-offset-4"
                >
                  <Mail size={14} />
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-bold text-[#fb7701] transition-all hover:bg-orange-50 active:scale-95"
            >
              <LifeBuoy size={16} />
              Contact Support
            </button>
          </motion.div>
        )}

        {errorState?.kind === 'pending' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative mb-8 rounded-2xl border border-blue-100 bg-blue-50 p-5"
          >
            <button
              type="button"
              onClick={() => setErrorState(null)}
              aria-label="Dismiss"
              className="absolute top-3 right-3 p-1.5 rounded-full text-blue-400 hover:text-blue-700 hover:bg-blue-100 transition-all"
            >
              <X size={16} />
            </button>
            <div className="flex items-start gap-3 pr-6">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                <Clock size={20} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black uppercase tracking-wide text-blue-700">
                  Waiting for admin approval
                </p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-blue-600">
                  {errorState.message} You'll be able to sign in as soon as the
                  team approves your seller application.
                </p>
              </div>
            </div>

            {notifyStatus === 'sent' ? (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white border border-blue-100 px-4 py-3 text-sm font-bold text-blue-700">
                <CheckCircle2 size={16} className="text-green-500" />
                Admin has been notified. We'll email you when it's reviewed.
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleNotifyAdmin}
                  disabled={notifyStatus === 'sending'}
                  className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 transition-all hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
                >
                  {notifyStatus === 'sending' ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
                      Notifying admin…
                    </>
                  ) : (
                    <>
                      <BellRing size={14} />
                      Notify Admin
                    </>
                  )}
                </button>
                {notifyStatus === 'error' && (
                  <p className="mt-2 text-xs font-semibold text-red-600 text-center">
                    {notifyError}
                  </p>
                )}
              </>
            )}
          </motion.div>
        )}

        {errorState?.kind === 'generic' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 flex items-center rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-600"
          >
            <span className="mr-2">⚠️</span>
            <span className="flex-1">{errorState.message}</span>
            <button
              type="button"
              onClick={() => setErrorState(null)}
              aria-label="Dismiss"
              className="ml-2 p-1 rounded-full text-red-400 hover:text-red-700 hover:bg-red-100 transition-all"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">{t('login.email_label')}</label>
            <input
              type="email"
              className="input-field"
              placeholder={t('login.email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">{t('login.password_label')}</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end">
            <a href="#" className="text-xs font-bold text-gray-400 hover:text-[#fb7701] transition-colors">{t('login.forgot')}</a>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3.5 text-base mt-1 disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : t('login.submit')}
          </button>
        </form>

        {GOOGLE_CLIENT_ID && (
          <div className="mt-5">
            <div className="relative flex items-center my-3">
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

        <div className="mt-6 pt-5 border-t border-gray-100 text-center space-y-1.5">
          <p className="text-gray-500 font-medium text-base">
            {t('login.new_to_temu')}{' '}
            <Link
              to={nextParam ? `/register?next=${encodeURIComponent(nextParam)}` : '/register'}
              className="text-[#fb7701] font-bold hover:underline ml-1"
            >
              {t('login.join_free')}
            </Link>
          </p>
          <p className="text-gray-500 text-sm font-medium">
            {t('login.selling_interest')}{' '}
            <Link to="/seller/onboarding" className="text-gray-700 font-bold hover:text-[#fb7701] hover:underline ml-1">
              {t('login.start_business')}
            </Link>
          </p>
        </div>
      </motion.div>
      {supportOpen && (
        <ContactSupportModal
          onClose={(wasSuccess) => {
            setSupportOpen(false);
            // The customer reached support — dismiss the red banner too so the
            // login page is clean. Wrong path (closed without sending) leaves
            // the banner up so they can try again.
            if (wasSuccess) setErrorState(null);
          }}
          email={email}
        />
      )}
    </div>
  );
};

export default LoginPage;
