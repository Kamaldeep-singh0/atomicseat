'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Ticket, LogIn, ShieldAlert, User, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (quickEmail: string, quickPass: string) => {
    setError(null);
    setLoading(true);
    try {
      await login(quickEmail, quickPass);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mx-auto glow-brand">
          <Ticket className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h1>
        <p className="text-xs text-zinc-400 font-mono">
          Sign in to lock seats and purchase event tickets.
        </p>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 sm:p-8 space-y-6">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-mono flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-surface-border rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand transition-colors font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-surface-border rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand transition-colors font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-brand hover:bg-brand-hover text-black font-semibold text-sm transition-all glow-brand disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
          </button>
        </form>

        {/* 1-Click Quick Demo Logins */}
        <div className="border-t border-surface-border pt-5 space-y-3">
          <span className="block text-[11px] font-mono text-zinc-400 text-center uppercase tracking-wider">
            One-Click Demo Credentials
          </span>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('user@atomicseat.dev', 'AtomicPass2026!')}
              disabled={loading}
              className="p-2.5 rounded-lg bg-surface-hover hover:bg-zinc-800 border border-surface-border hover:border-brand/40 text-left transition-colors flex flex-col"
            >
              <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
                <User className="w-3.5 h-3.5 text-brand" />
                <span>Demo User</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono mt-0.5">user@atomicseat.dev</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('admin@atomicseat.dev', 'AtomicPass2026!')}
              disabled={loading}
              className="p-2.5 rounded-lg bg-surface-hover hover:bg-zinc-800 border border-surface-border hover:border-emerald-500/40 text-left transition-colors flex flex-col"
            >
              <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Admin User</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono mt-0.5">admin@atomicseat.dev</span>
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-zinc-400">
          Don't have an account?{' '}
          <Link href="/register" className="text-brand hover:underline font-medium">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
