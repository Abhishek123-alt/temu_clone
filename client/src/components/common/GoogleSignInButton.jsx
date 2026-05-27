import React, { useEffect, useRef, useState } from 'react';

const GSI_SRC = 'https://accounts.google.com/gsi/client';

// Module-level promise so the GSI script only ever loads once even if the
// button mounts/unmounts (e.g. user toggles between login and register).
let gsiPromise = null;
const loadGsi = () => {
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google sign-in not available outside a browser'));
      return;
    }
    if (window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
  return gsiPromise;
};

/**
 * Renders the official Google-styled "Sign in with Google" button.
 *
 * Props:
 *  - clientId: the OAuth web client ID (VITE_GOOGLE_CLIENT_ID)
 *  - onCredential: (credential: string) => void — fired with the Google ID token
 *  - onError: (error: Error) => void — fired if GSI fails to load
 *  - disabled: boolean — visually dims the wrapper while a request is in flight
 */
const GoogleSignInButton = ({ clientId, onCredential, onError, disabled = false }) => {
  const containerRef = useRef(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    loadGsi()
      .then((google) => {
        if (cancelled || !containerRef.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) onCredential?.(response.credential);
          },
          ux_mode: 'popup',
          auto_select: false,
        });
        google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'left',
          width: containerRef.current.clientWidth || 320,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err);
        onError?.(err);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, onCredential, onError]);

  if (!clientId) return null;
  if (loadError) {
    return (
      <p className="text-center text-xs font-semibold text-red-500">
        Google sign-in unavailable. Please try email login.
      </p>
    );
  }
  return (
    <div
      ref={containerRef}
      className={`flex justify-center ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    />
  );
};

export default GoogleSignInButton;
