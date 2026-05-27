import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, LifeBuoy, Mail, ShieldAlert, X } from 'lucide-react';
import { supportService } from '../../services/supportService';

// Displayed-only — the actual destination lives in server/.env (SUPPORT_EMAIL).
export const SUPPORT_EMAIL = 'temu-support@yopmail.com';

const REASONS = [
  'Unusual or suspicious sign-in activity on your account',
  'A policy or terms-of-service violation flagged by our review team',
  'A pending verification step (identity, payment method, or seller documents)',
  'A reactivation request that you submitted previously',
];

// Parent controls mounting (renders this only when supportOpen === true) so
// each open produces a fresh component instance — no useEffect needed to
// reset form state, and we avoid the React 19 set-state-in-effect warning.
const ContactSupportModal = ({ onClose, email = '' }) => {
  const [fromEmail, setFromEmail] = useState(email);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  // Tell the parent whether the modal was dismissed AFTER a successful send,
  // so it can also clear the "Account restricted" banner on the login page
  // (the action is done — no point leaving the red error around).
  const handleClose = () => onClose(status === 'success');

  const handleSend = async () => {
    setStatus('sending');
    setErrorMsg('');
    try {
      await supportService.contact({
        from_email: fromEmail,
        subject: 'Reactivate my Temu account',
        message:
          message.trim() ||
          'Hi Temu Support, my account appears to be deactivated. Please help me reactivate it or share the reason.',
        context: 'ACCOUNT_DEACTIVATED',
      });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      const detail = err.response?.data?.detail;
      setErrorMsg(
        typeof detail === 'string'
          ? detail
          : 'Could not send your message. Please try again later.'
      );
    }
  };

  const canSend = status !== 'sending' && /\S+@\S+\.\S+/.test(fromEmail);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden border border-gray-100"
        >
          <div className="p-8 pb-4 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
              <LifeBuoy className="text-[#fb7701]" size={28} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 leading-tight">
              Need help with your account?
            </h3>
            <p className="mt-3 text-gray-500 font-medium leading-relaxed px-2">
              Your account has been deactivated. Our team can help you understand why and walk you
              through reactivation.
            </p>
          </div>

          {status === 'success' ? (
            <div className="px-8 pb-8">
              <div className="bg-green-50 border border-green-100 rounded-2xl p-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="text-green-600" size={24} />
                </div>
                <p className="text-base font-black text-green-700">Message sent</p>
                <p className="mt-2 text-sm font-medium text-green-700 leading-relaxed">
                  We've forwarded your request to {SUPPORT_EMAIL}. Our team typically responds
                  within 24 hours.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="mt-4 w-full rounded-2xl bg-gray-100 px-6 py-4 text-sm font-bold text-gray-700 hover:bg-gray-200 transition-all active:scale-95"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="px-8 pb-2">
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert size={16} className="text-gray-400" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Common reasons
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {REASONS.map((reason) => (
                      <li key={reason} className="flex gap-2 text-sm text-gray-600 font-medium">
                        <span className="text-[#fb7701] mt-1">•</span>
                        <span className="leading-snug">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="px-8 pt-4 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                    Your email
                  </label>
                  <input
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="input-field"
                    disabled={status === 'sending'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                    Message (optional)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us anything that might help us identify your account…"
                    rows={3}
                    className="input-field resize-none"
                    disabled={status === 'sending'}
                  />
                </div>
              </div>

              {status === 'error' && (
                <div className="px-8 pt-3">
                  <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                    {errorMsg}
                  </p>
                </div>
              )}

              <div className="p-8 pt-4 space-y-2">
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#fb7701] hover:bg-[#e06a01] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-all shadow-lg shadow-orange-100 active:scale-95"
                >
                  {status === 'sending' ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Mail size={18} />
                      Email Support
                    </>
                  )}
                </button>
                <p className="text-center text-xs text-gray-400 font-medium pt-1">
                  We typically respond within 24 hours.
                </p>
              </div>
            </>
          )}

          <button
            onClick={handleClose}
            className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-900 rounded-full hover:bg-gray-50 transition-all"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </motion.div>
      </div>
  );
};

export default ContactSupportModal;
