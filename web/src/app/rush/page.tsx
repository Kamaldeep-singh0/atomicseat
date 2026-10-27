'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { fetchApi } from '../../lib/api';
import { EventItem } from '../../components/EventCard';
import { StrategyBadge } from '../../components/StrategyBadge';
import { LockingStrategy } from '../../context/StrategyContext';
import {
  Zap,
  ShieldAlert,
  Server,
  Activity,
  AlertOctagon,
  Clock,
  RotateCcw,
  CheckCircle,
  Play,
  Square,
  BarChart2,
  TrendingUp,
} from 'lucide-react';

interface RushStatusData {
  isRunning: boolean;
  runId: string | null;
  strategy: string;
  virtualUsers: number;
  durationSeconds: number;
  elapsedSeconds: number;
  totalAttempts: number;
  successfulLocks: number;
  successfulBookings: number;
  conflicts: number;
  errors: number;
  doubleBookingsDetected: number;
  activeInstances: number;
  peakInstances: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  latestMetrics: {
    timestamp: number;
    second: number;
    reqsThisSec: number;
    successfulLocks: number;
    conflicts: number;
    doubleBookings: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    activeInstances: number;
  }[];
  currentSummary: any;
  history: any[];
}

export default function RushSimulatorPage() {
  const { user, login } = useAuth();

  // Control state
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedStrategy, setSelectedStrategy] = useState<LockingStrategy>('mongo-atomic');
  const [virtualUsers, setVirtualUsers] = useState<number>(100);
  const [durationSeconds, setDurationSeconds] = useState<number>(30);
  const [eventSeats, setEventSeats] = useState<any[]>([]);

  // Simulation status state
  const [status, setStatus] = useState<RushStatusData | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Poll status interval
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load available events
  useEffect(() => {
    fetchApi<{ success: boolean; data: EventItem[] }>('/api/events')
      .then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          setEvents(res.data);
          setSelectedEventId(res.data[0]._id);
        }
      })
      .catch((err) => console.error('Failed to load events:', err));
  }, []);

  // Poll status from worker
  const pollStatus = async () => {
    try {
      const res: any = await fetchApi('/api/rush/status');
      if (res.success && res.data) {
        setStatus(res.data);
      }
    } catch {}
  };

  // Poll seats for selected event
  const loadEventSeats = async (id: string) => {
    if (!id) return;
    try {
      const res: any = await fetchApi(`/api/events/${id}/seats`);
      if (res.success && res.data) {
        setEventSeats(res.data);
      }
    } catch {}
  };

  useEffect(() => {
    pollStatus();
    pollTimerRef.current = setInterval(() => {
      pollStatus();
      if (selectedEventId) {
        loadEventSeats(selectedEventId);
      }
    }, 1000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [selectedEventId]);

  useEffect(() => {
    if (selectedEventId) {
      loadEventSeats(selectedEventId);
    }
  }, [selectedEventId]);

  // Start rush simulation
  const handleStartRush = async () => {
    setActionError(null);
    setStarting(true);

    try {
      const res: any = await fetchApi('/api/rush/start', {
        method: 'POST',
        body: JSON.stringify({
          eventId: selectedEventId,
          strategy: selectedStrategy,
          virtualUsers,
          durationSeconds,
        }),
      });

      if (!res.success) {
        setActionError(res.message || 'Failed to start rush simulation');
      } else {
        await pollStatus();
      }
    } catch (err: any) {
      setActionError(err.message || 'Error connecting to rush worker');
    } finally {
      setStarting(false);
    }
  };

  // Stop rush
  const handleStopRush = async () => {
    setStopping(true);
    try {
      await fetchApi('/api/rush/stop', { method: 'POST' });
      await pollStatus();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setStopping(false);
    }
  };

  // Reset event seats and bookings
  const handleReset = async () => {
    setResetting(true);
    setActionError(null);
    try {
      await fetchApi('/api/stats/reset', {
        method: 'POST',
        body: JSON.stringify({ eventId: selectedEventId }),
      });
      if (selectedEventId) {
        await loadEventSeats(selectedEventId);
      }
      await pollStatus();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setResetting(false);
    }
  };

  // Admin guard
  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center glow-amber">
          <Zap className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Sale Rush Simulator
        </h1>
        <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
          The high-concurrency attack worker is restricted to administrators to prevent unauthorized traffic generation.
        </p>
        <button
          onClick={() => login('admin@atomicseat.dev', 'AtomicPass2026!')}
          className="mt-4 inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-brand text-black font-semibold text-xs transition-all glow-brand"
        >
          <span>One-Click Login as Admin</span>
        </button>
      </div>
    );
  }

  const isRunning = status?.isRunning || false;
  const metrics = status?.latestMetrics || [];

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-surface-border pb-6">
        <div>
          <div className="flex items-center space-x-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 glow-amber">
              <Zap className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Sale Rush Simulator
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 uppercase font-bold">
              Admin Attack Suite
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono">
            Spawns real concurrent HTTP buyer requests from a dedicated Cloud Run worker to test auto-scaling and locking invariants.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleReset}
            disabled={isRunning || resetting}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-hover border border-surface-border text-xs font-mono text-zinc-300 transition-colors disabled:opacity-50"
            title="Reset all seat locks and bookings for this event"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            <span>Reset Seat Grid</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 font-mono flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Control Panel */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-xl">
        <h2 className="text-xs font-mono text-brand font-bold uppercase tracking-wider mb-4 flex items-center space-x-2">
          <Activity className="w-4 h-4" />
          <span>Rush Configuration Controls</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Event Picker */}
          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1.5">Target Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              disabled={isRunning}
              className="w-full bg-background border border-surface-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand font-mono disabled:opacity-50"
            >
              {events.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.title} ({e.totalSeats} seats)
                </option>
              ))}
            </select>
          </div>

          {/* Strategy Selector */}
          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1.5">Locking Strategy</label>
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value as LockingStrategy)}
              disabled={isRunning}
              className="w-full bg-background border border-surface-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand font-mono disabled:opacity-50"
            >
              <option value="mongo-atomic">2. Mongo-Atomic (Safe)</option>
              <option value="redis-lock">3. Redis-Lock (Safe)</option>
              <option value="naive">1. Naive Read-Then-Write (Unsafe)</option>
            </select>
          </div>

          {/* Virtual Users Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-1.5">
              <span>Virtual Users</span>
              <span className="text-brand font-bold">{virtualUsers} buyers</span>
            </div>
            <input
              type="range"
              min={50}
              max={300}
              step={25}
              value={virtualUsers}
              onChange={(e) => setVirtualUsers(Number(e.target.value))}
              disabled={isRunning}
              className="w-full accent-cyan-400 cursor-pointer disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono mt-1">
              <span>50</span>
              <span>150</span>
              <span>300 (Cap)</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-end space-x-2">
            {!isRunning ? (
              <button
                onClick={handleStartRush}
                disabled={starting || !selectedEventId}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all glow-amber disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>{starting ? 'Initializing...' : 'Start Sale Rush'}</span>
              </button>
            ) : (
              <button
                onClick={handleStopRush}
                disabled={stopping}
                className="w-full py-2.5 px-4 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs transition-all glow-red disabled:opacity-50 flex items-center justify-center space-x-2 animate-pulse"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>{stopping ? 'Stopping...' : `Stop Rush (${status?.elapsedSeconds || 0}s)`}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary Telemetry Dashboard Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Metric 1: Double-Bookings Detected (Big Red Metric) */}
        <div
          className={`col-span-2 p-4 rounded-2xl border transition-all ${
            (status?.doubleBookingsDetected || 0) > 0
              ? 'bg-red-500/15 border-red-500/60 glow-red animate-pulse'
              : 'bg-surface-card border-surface-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
              Double-Bookings Detected
            </span>
            <AlertOctagon
              className={`w-4 h-4 ${
                (status?.doubleBookingsDetected || 0) > 0 ? 'text-red-400' : 'text-zinc-400'
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span
              className={`text-4xl font-extrabold font-mono tracking-tight ${
                (status?.doubleBookingsDetected || 0) > 0 ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {status?.doubleBookingsDetected || 0}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              {(status?.doubleBookingsDetected || 0) > 0 ? 'CORRUPTION DETECTED' : 'Zero Violations'}
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 font-mono mt-1">
            Confirmed bookings exceeding 1 per seat
          </p>
        </div>

        {/* Metric 2: Active API Instances */}
        <div className="p-4 rounded-2xl bg-surface-card border border-surface-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase">Live Instances</span>
            <Server className="w-4 h-4 text-brand" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-white">
              {status?.activeInstances || 1}
            </span>
            <span className="text-[10px] font-mono text-brand">Peak: {status?.peakInstances || 1}</span>
          </div>
          <div className="flex items-center space-x-1 mt-1 text-[10px] text-zinc-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Redis Heartbeat TTL</span>
          </div>
        </div>

        {/* Metric 3: Total Requests / Throughput */}
        <div className="p-4 rounded-2xl bg-surface-card border border-surface-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase">Total Attempts</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold font-mono text-white">
              {status?.totalAttempts || 0}
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 font-mono mt-1">
            {metrics.length > 0 ? `${metrics[metrics.length - 1]?.reqsThisSec || 0} req/sec` : '0 req/sec'}
          </p>
        </div>

        {/* Metric 4: Bookings Confirmed */}
        <div className="p-4 rounded-2xl bg-surface-card border border-surface-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase">Confirmed</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold font-mono text-emerald-400">
              {status?.successfulBookings || 0}
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 font-mono mt-1">
            Locks: {status?.successfulLocks || 0}
          </p>
        </div>

        {/* Metric 5: Latency (p50 / p95) */}
        <div className="p-4 rounded-2xl bg-surface-card border border-surface-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase">Latency</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1 font-mono">
            <span className="text-2xl font-bold text-white">{status?.p50LatencyMs || 0}</span>
            <span className="text-xs text-zinc-400">ms p50</span>
          </div>
          <p className="text-[10px] text-purple-300 font-mono mt-1">
            p95: {status?.p95LatencyMs || 0}ms
          </p>
        </div>
      </div>

      {/* Active Instances Chart & Real-Time Seat Map Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Autoscaling Live Chart */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-brand" />
                <span>Live Active API Instances (Google Cloud Run Autoscaling)</span>
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                Container count derived from Redis heartbeat keys with 6s TTL
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-brand/10 text-brand font-bold">
              {status?.activeInstances || 1} Containers
            </span>
          </div>

          {/* SVG Line / Bar Chart */}
          <div className="h-44 w-full bg-background/50 border border-surface-border/50 rounded-xl p-3 flex items-end space-x-1 overflow-hidden">
            {metrics.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs font-mono text-zinc-400">
                Awaiting rush telemetry data...
              </div>
            ) : (
              metrics.map((m, i) => {
                const maxInst = Math.max(status?.peakInstances || 1, 5);
                const heightPercent = Math.min(100, Math.max(15, (m.activeInstances / maxInst) * 100));
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative"
                  >
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full bg-gradient-to-t from-brand/40 to-brand rounded-t transition-all duration-300 glow-brand"
                    />
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-zinc-900 border border-surface-border text-[9px] font-mono px-1.5 py-0.5 rounded text-white pointer-events-none z-20 whitespace-nowrap">
                      {m.activeInstances} inst | {m.reqsThisSec} rps
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mt-2">
            <span>T-30s</span>
            <span>Real-time Timeline (1 tick / sec)</span>
            <span>Now</span>
          </div>
        </div>

        {/* Live Contested Seat Grid */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Activity className="w-4 h-4 text-amber-400" />
                <span>Live Contested Seat Grid Under Attack</span>
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                Real-time seat state changes as concurrent virtual users collide
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-400">{eventSeats.length} seats</span>
          </div>

          <div className="h-44 w-full bg-background/50 border border-surface-border/50 rounded-xl p-3 overflow-y-auto">
            <div className="flex flex-wrap gap-1.5 justify-center">
              {eventSeats.map((seat) => (
                <div
                  key={seat._id}
                  title={`Seat ${seat.seatNumber}: ${seat.status}`}
                  className={`w-6 h-6 rounded text-[8px] font-mono font-bold flex items-center justify-center transition-all ${
                    seat.status === 'booked'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : seat.status === 'locked'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                      : 'bg-surface-card text-zinc-400 border border-surface-border'
                  }`}
                >
                  {seat.col}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center space-x-4 text-[10px] font-mono text-zinc-400 mt-2">
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded bg-surface-card border border-surface-border" />
              <span>Available</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400" />
              <span>Contested Lock</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-400" />
              <span>Booked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Latest Run Summary Card */}
      {status?.currentSummary && (
        <div className="bg-gradient-to-r from-surface-card via-surface-card to-background border border-surface-border rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-surface-border pb-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-zinc-400">RUN SUMMARY:</span>
              <span className="text-sm font-bold text-white font-mono">
                {status.currentSummary.runId}
              </span>
              <StrategyBadge strategy={status.currentSummary.strategy} />
            </div>

            <div
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                status.currentSummary.doubleBookingsDetected > 0
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 glow-red'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              {status.currentSummary.doubleBookingsDetected > 0
                ? 'FAILED: DOUBLE-BOOKINGS DETECTED'
                : 'PASSED: 100% ATOMIC INVARIANT PRESERVED'}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
            <div className="p-3 bg-background/60 rounded-xl border border-surface-border">
              <div className="text-[10px] text-zinc-400 font-mono">ATTEMPTS</div>
              <div className="text-lg font-bold text-white font-mono mt-0.5">
                {status.currentSummary.totalAttempts}
              </div>
            </div>

            <div className="p-3 bg-background/60 rounded-xl border border-surface-border">
              <div className="text-[10px] text-zinc-400 font-mono">BOOKINGS</div>
              <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                {status.currentSummary.successfulBookings}
              </div>
            </div>

            <div className="p-3 bg-background/60 rounded-xl border border-surface-border">
              <div className="text-[10px] text-zinc-400 font-mono">CONFLICTS (409)</div>
              <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">
                {status.currentSummary.conflicts}
              </div>
            </div>

            <div className="p-3 bg-background/60 rounded-xl border border-surface-border">
              <div className="text-[10px] text-zinc-400 font-mono">DOUBLE-BOOKINGS</div>
              <div
                className={`text-lg font-extrabold font-mono mt-0.5 ${
                  status.currentSummary.doubleBookingsDetected > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {status.currentSummary.doubleBookingsDetected}
              </div>
            </div>

            <div className="p-3 bg-background/60 rounded-xl border border-surface-border">
              <div className="text-[10px] text-zinc-400 font-mono">LATENCY (p50/p95)</div>
              <div className="text-sm font-bold text-white font-mono mt-1">
                {status.currentSummary.p50LatencyMs}ms / {status.currentSummary.p95LatencyMs}ms
              </div>
            </div>

            <div className="p-3 bg-background/60 rounded-xl border border-surface-border">
              <div className="text-[10px] text-zinc-400 font-mono">PEAK CONTAINERS</div>
              <div className="text-lg font-bold text-brand font-mono mt-0.5">
                {status.currentSummary.peakInstances}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Run Strategy Comparison Table */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Strategy Benchmark Comparison</h3>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              Historical results across runs comparing Naive vs Mongo-Atomic vs Redis-Lock
            </p>
          </div>
        </div>

        {(!status?.history || status.history.length === 0) ? (
          <div className="text-center py-12 border border-dashed border-surface-border rounded-xl">
            <p className="text-xs font-mono text-zinc-400">
              No comparison runs recorded yet. Launch your first rush simulation above!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-background text-zinc-400 border-b border-surface-border uppercase">
                <tr>
                  <th className="py-2.5 px-3">Run ID</th>
                  <th className="py-2.5 px-3">Strategy</th>
                  <th className="py-2.5 px-3">Users</th>
                  <th className="py-2.5 px-3">Attempts</th>
                  <th className="py-2.5 px-3">Bookings</th>
                  <th className="py-2.5 px-3">Conflicts</th>
                  <th className="py-2.5 px-3">Double-Bookings</th>
                  <th className="py-2.5 px-3">Latency (p50 / p95)</th>
                  <th className="py-2.5 px-3">Peak Instances</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {status.history.map((run, idx) => (
                  <tr key={idx} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="py-3 px-3 text-zinc-300 font-bold">{run.runId.slice(0, 14)}</td>
                    <td className="py-3 px-3">
                      <StrategyBadge strategy={run.strategy} />
                    </td>
                    <td className="py-3 px-3 text-zinc-300">{run.virtualUsers}</td>
                    <td className="py-3 px-3 text-zinc-300">{run.totalAttempts}</td>
                    <td className="py-3 px-3 text-emerald-400 font-bold">{run.successfulBookings}</td>
                    <td className="py-3 px-3 text-amber-400">{run.conflicts}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-extrabold px-2 py-0.5 rounded ${
                          run.doubleBookingsDetected > 0
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                            : 'text-emerald-400'
                        }`}
                      >
                        {run.doubleBookingsDetected}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-zinc-300">
                      {run.p50LatencyMs}ms / {run.p95LatencyMs}ms
                    </td>
                    <td className="py-3 px-3 text-brand font-bold">{run.peakInstances}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
