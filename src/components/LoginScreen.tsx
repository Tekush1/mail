import React, { useState } from 'react';
import { Sparkles, Lock, Eye, EyeOff } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (token: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('mailing_auth_token', data.token);
        onLogin(data.token);
      } else {
        setError('Galat password. Dobara try karo.');
      }
    } catch {
      setError('Server se connect nahi ho pa raha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
            <Sparkles className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-2xl font-serif italic text-white">
            MailingEngine <span className="text-amber-500 not-italic font-bold">Pro</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Secure Access Required</p>
        </div>

        {/* Login Card */}
        <div className="bg-[#0F0F10] border border-white/10 rounded-2xl p-8 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-white">Enter Access Password</span>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Password dalein..."
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3.5 pr-12 text-sm outline-none focus:border-amber-500 transition-all placeholder-gray-600"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-all p-1"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading || !password}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 text-sm"
            >
              {loading ? 'Checking...' : 'Login Karo →'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Password .env.local file mein APP_PASSWORD se set hota hai
        </p>
      </div>
    </div>
  );
}
