'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { StrategyBadge } from './StrategyBadge';
import { Ticket, Zap, Calendar, History, PlusCircle, LogIn, LogOut, Radio } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Tagline */}
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/40 flex items-center justify-center group-hover:border-brand transition-colors glow-brand">
                <Ticket className="w-5 h-5 text-brand" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-lg text-white tracking-tight">
                    Atomic <span className="text-brand">Seat</span>
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 font-mono tracking-wider uppercase">
                  Every seat. Exactly once.
                </p>
              </div>
            </Link>

            {/* Socket Status Indicator */}
            <div
              className={`hidden md:flex items-center space-x-1.5 text-xs font-mono px-2 py-0.5 rounded-full border ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
              }`}
              title={isConnected ? 'Connected to WebSocket Cluster via Redis Adapter' : 'Reconnecting to Cluster...'}
            >
              <Radio className={`w-3 h-3 ${isConnected ? 'animate-pulse' : ''}`} />
              <span>{isConnected ? 'LIVE SYNC' : 'RECONNECTING'}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            <Link
              href="/"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname === '/' || pathname.startsWith('/events')
                  ? 'text-brand bg-brand/5 border border-brand/20'
                  : 'text-zinc-300 hover:text-white hover:bg-surface-hover'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Events</span>
            </Link>

            <Link
              href="/rush"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname === '/rush'
                  ? 'text-brand bg-brand/5 border border-brand/20'
                  : 'text-zinc-300 hover:text-white hover:bg-surface-hover'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Rush Simulator</span>
            </Link>

            {user && (
              <Link
                href="/bookings"
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/bookings'
                    ? 'text-brand bg-brand/5 border border-brand/20'
                    : 'text-zinc-300 hover:text-white hover:bg-surface-hover'
                }`}
              >
                <History className="w-4 h-4" />
                <span>My Bookings</span>
              </Link>
            )}

            {user?.role === 'admin' && (
              <Link
                href="/events/new"
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/events/new'
                    ? 'text-brand bg-brand/5 border border-brand/20'
                    : 'text-zinc-300 hover:text-white hover:bg-surface-hover'
                }`}
              >
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <span>New Event</span>
              </Link>
            )}
          </nav>

          {/* Strategy Selector & Auth controls */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:block">
              <StrategyBadge showSelector />
            </div>

            {user ? (
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-zinc-200">{user.name}</div>
                  <div className="text-[10px] text-zinc-400 uppercase font-mono">{user.role}</div>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-zinc-400 hover:text-red-400 hover:bg-surface-hover rounded-md transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="inline-flex items-center space-x-1.5 text-xs font-medium text-zinc-200 hover:text-white px-3 py-1.5 rounded-md hover:bg-surface-hover transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Login</span>
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center space-x-1.5 text-xs font-medium text-black bg-brand hover:bg-brand-hover px-3 py-1.5 rounded-md transition-all font-semibold glow-brand"
                >
                  <span>Sign Up</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
