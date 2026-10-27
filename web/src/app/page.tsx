'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi } from '../lib/api';
import { EventCard, EventItem } from '../components/EventCard';
import { StrategyBadge } from '../components/StrategyBadge';
import { Zap, ShieldCheck, Cpu, ArrowRight, Sparkles } from 'lucide-react';

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<{ success: boolean; data: EventItem[] }>('/api/events')
      .then((res) => {
        if (res.success && res.data) {
          setEvents(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load events:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative pt-6 pb-12 flex flex-col items-center text-center">
        {/* Glowing gradient backdrop */}
        <div className="absolute top-0 -z-10 w-[600px] h-[300px] bg-brand/10 blur-[130px] rounded-full pointer-events-none" />

        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/30 text-brand text-xs font-mono font-medium mb-6 glow-brand">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Serverless Concurrency & Distributed Locking Benchmark</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight max-w-4xl leading-tight sm:leading-none">
          Every seat.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand via-cyan-300 to-teal-400">
            Exactly once.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed">
          A production-style event booking platform engineered for serverless containers (Google Cloud Run).
          Visibly demonstrating how it autoscales and stays correct when hundreds of users hit it at once.
        </p>

        {/* Call to Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#events-list"
            className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-brand text-black font-semibold text-sm hover:bg-brand-hover transition-all glow-brand"
          >
            <span>Browse Events & Seat Maps</span>
            <ArrowRight className="w-4 h-4" />
          </a>

          <Link
            href="/rush"
            className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-surface-card hover:bg-surface-hover border border-amber-500/30 text-amber-400 font-semibold text-sm transition-all hover:border-amber-500/60"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Open Sale Rush Simulator</span>
          </Link>
        </div>

        {/* Three Locking Strategies Preview Banner */}
        <div className="mt-12 w-full max-w-3xl grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
          <div className="bg-surface-card border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-red-400 font-mono">1. NAIVE</span>
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Unsafe</span>
            </div>
            <p className="text-xs text-zinc-400">
              Read-then-write without conditional checks. Demonstrates visible double-bookings under concurrent rush.
            </p>
          </div>

          <div className="bg-surface-card border border-cyan-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-brand font-mono">2. MONGO-ATOMIC</span>
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Safe</span>
            </div>
            <p className="text-xs text-zinc-400">
              Single-statement conditional findOneAndUpdate. In-query expiry checks. Exactly 1 winner.
            </p>
          </div>

          <div className="bg-surface-card border border-purple-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-purple-400 font-mono">3. REDIS-LOCK</span>
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Safe</span>
            </div>
            <p className="text-xs text-zinc-400">
              SET NX PX with Lua-safe releases. Cluster-wide serverless mutual exclusion persisted to Mongo.
            </p>
          </div>
        </div>
      </section>

      {/* Events Listing Section */}
      <section id="events-list" className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Active Events</h2>
            <p className="text-xs text-zinc-400 font-mono mt-1">
              Select an event to open the real-time seat map and experiment with live seat locking.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <StrategyBadge showSelector />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-64 bg-surface-card/50 border border-surface-border rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 bg-surface-card border border-surface-border rounded-2xl">
            <p className="text-zinc-400 text-sm">No events found.</p>
            <p className="text-zinc-400 text-xs mt-1">Run seed script or create a new event as admin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
