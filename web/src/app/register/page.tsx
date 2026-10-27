'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Ticket, UserPlus, ShieldAlert } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await register(email, password, name);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
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
        <h1 className="text-2xl font-bold text-white tracking-tight">Create Account</h1>
        <p className="text-xs text-zinc-400 font-mono">
          Join Atomic Seat to book tickets across events.
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
              Full Name
            </label>
            <input
              type="text"
              required
              placeholder="Alex Walker"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-background border border-surface-border rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="alex@example.com"
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
            <UserPlus className="w-4 h-4" />
            <span>{loading ? 'Creating account...' : 'Create Account'}</span>
          </button>
        </form>

        <div className="text-center text-xs text-zinc-400">
          Already have an account?{' '}
          <Link href="/login" className="text-brand hover:underline font-medium">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
