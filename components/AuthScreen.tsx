import React, { useEffect, useRef, useState } from 'react';
import { initializeGoogleAuth, renderGoogleButton, signInWithGoogle, GoogleUser } from '../services/googleAuth';
import { loginWithGoogle } from '../services/evaluationApi';
import type { AuthenticatedUser } from '../types/evaluation';

interface AuthScreenProps {
  onAuthenticated: (user: AuthenticatedUser) => void;
  onGuest: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated, onGuest }) => {
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const hasClientId = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Fade-in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Set up the callbacks and render the button
  useEffect(() => {
    if (!hasClientId) return;

    let isMounted = true;

    const setupAuth = async () => {
      try {
        await initializeGoogleAuth(
          async (credential, googleUser) => {
            if (!isMounted) return;
            try {
              // Intercambiar credential de Google por token AIRSTARK
              const authResponse = await loginWithGoogle(credential, googleUser);
              if (isMounted) onAuthenticated(authResponse.user);
            } catch (err: any) {
              if (isMounted) {
                console.error('[AIRSTARK] Error al obtener token AIRSTARK:', err);
                setError(err.message ?? 'Error al autenticar con el servidor');
                setIsLoading(false);
              }
            }
          },
          (err) => {
            if (isMounted) {
              console.error('Google Auth Error callback:', err);
              setError(err.message);
              setIsLoading(false);
            }
          }
        );

        if (googleBtnRef.current && isMounted) {
          googleBtnRef.current.innerHTML = '';
          await renderGoogleButton(googleBtnRef.current);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to setup Google Auth:', err);
          setError(err.message);
        }
      }
    };

    setupAuth();

    return () => {
      isMounted = false;
    };
  }, [hasClientId, onAuthenticated]);

  // Fallback: One-Tap prompt button
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle(
        async (credential, googleUser) => {
          try {
            const authResponse = await loginWithGoogle(credential, googleUser);
            onAuthenticated(authResponse.user);
          } catch (err: any) {
            setError(err.message ?? 'Error al autenticar con el servidor');
            setIsLoading(false);
          }
        },
        (err) => {
          setError(err.message ?? 'Error al iniciar sesión');
          setIsLoading(false);
        }
      );
    } catch (err: any) {
      setError(err.message ?? 'Error al iniciar sesión');
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 30% 40%, rgba(20,184,166,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(239,68,68,0.10) 0%, transparent 60%), #060b14',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Ambient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[15%] w-[500px] h-[500px] rounded-full blur-[140px] opacity-20"
          style={{ background: 'radial-gradient(circle, #14b8a6, transparent 70%)' }} />
        <div className="absolute bottom-[15%] right-[15%] w-[400px] h-[400px] rounded-full blur-[120px] opacity-15"
          style={{ background: 'radial-gradient(circle, #ef4444, transparent 70%)' }} />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* Card */}
      <div
        className="relative z-10 flex flex-col items-center px-10 py-12 rounded-3xl max-w-md w-full mx-4"
        style={{
          background: 'rgba(255,255,255,0.035)',
          border: '1px solid rgba(255,255,255,0.09)',
          backdropFilter: 'blur(32px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06) inset',
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'transform 0.7s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Logo */}
        <div className="relative mb-8 flex flex-col items-center">
          <div
            className="w-24 h-24 rounded-full overflow-hidden shadow-2xl flex items-center justify-center"
            style={{ boxShadow: '0 0 50px rgba(20,184,166,0.35), 0 0 0 1px rgba(255,255,255,0.1)' }}
          >
            <img src="/logo_airstark.jpg" alt="AIRSTARK" className="w-full h-full object-cover" />
          </div>
          {/* Spinning ring */}
          <div
            className="absolute -inset-2 rounded-full border border-teal-500/30"
            style={{ animation: 'spin 8s linear infinite' }}
          />
          <div
            className="absolute -inset-4 rounded-full border border-red-500/15"
            style={{ animation: 'spin 14s linear infinite reverse' }}
          />
        </div>

        {/* Brand */}
        <h1 className="text-3xl font-black tracking-wider text-white mb-1 select-none">
          AIR<span className="text-teal-400">STARK</span>
        </h1>
        <p className="text-xs font-semibold tracking-[0.3em] text-gray-400 uppercase mb-2">
          Plataforma Anatómica Avanzada
        </p>

        {/* Divider */}
        <div className="w-full h-px my-6" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }} />

        {/* Headline */}
        <p className="text-center text-gray-300 text-sm leading-relaxed mb-2 max-w-xs">
          Explora anatomía cardíaca en 3D con IA generativa, control gestual y casos clínicos tipo MIR/USMLE.
        </p>

        <div className="w-full h-px my-6" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />

        {/* Google Sign-In area */}
        <div className="w-full flex flex-col items-center gap-4">
          {hasClientId ? (
            /* Official Google button rendered by GIS SDK */
            <div ref={googleBtnRef} className="flex justify-center w-full min-h-[48px]" />
          ) : (
            /* Styled fallback when no Client ID is set */
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="group relative w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-300 select-none"
              style={{
                background: isLoading ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.09)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#ffffff',
              }}
            >
              {isLoading ? (
                <svg className="animate-spin w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16.1 19 13 24 13c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.1C9.5 35.6 16.3 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.2C37 38.3 44 33 44 24c0-1.3-.1-2.6-.4-3.9z" />
                </svg>
              )}
              <span>{isLoading ? 'Iniciando sesión...' : 'Continuar con Google'}</span>
            </button>
          )}

          {/* Error */}
          {error && (
            <div className="w-full px-4 py-3 rounded-xl text-xs text-red-300 text-center"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span className="font-bold">Error:</span> {error}
              {!hasClientId && (
                <p className="mt-1 text-gray-400">
                  Configura <code className="text-teal-400">VITE_GOOGLE_CLIENT_ID</code> en <code className="text-teal-400">.env.local</code>
                </p>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="w-full flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">o</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Guest option */}
          <button
            onClick={onGuest}
            className="w-full py-3 rounded-2xl text-sm font-medium text-gray-400 hover:text-gray-200 transition-all duration-300 hover:bg-white/5 border border-transparent hover:border-white/10"
          >
            Continuar como Invitado
            <span className="ml-2 text-[10px] text-gray-600 font-normal">(funciones limitadas)</span>
          </button>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center text-[10px] text-gray-600 leading-relaxed">
          Al continuar, aceptas los términos de uso de AIRSTARK.<br />
          Tus datos no se comparten con terceros.
        </p>
      </div>

      {/* Spin keyframe */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
