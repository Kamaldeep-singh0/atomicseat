'use client';

import React from 'react';
import { useStrategy, LockingStrategy } from '../context/StrategyContext';
import { ShieldCheck, AlertTriangle, Cpu } from 'lucide-react';

interface Props {
  strategy?: LockingStrategy;
  showSelector?: boolean;
}

export function StrategyBadge({ strategy: overrideStrategy, showSelector = false }: Props) {
  const { strategy: contextStrategy, setStrategy } = useStrategy();
  const current = overrideStrategy || contextStrategy;

  const config = {
    naive: {
      label: 'Naive (Read-Then-Write)',
      short: 'Naive',
      color: 'bg-red-500/10 text-red-400 border-red-500/30',
      icon: AlertTriangle,
      desc: 'No DB/distributed protection. Susceptible to race conditions & double-bookings under load.',
    },
    'mongo-atomic': {
      label: 'Mongo Atomic',
      short: 'Mongo Atomic',
      color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      icon: ShieldCheck,
      desc: 'Conditional findOneAndUpdate query. Zero double-bookings. Background-free expiry.',
    },
    'redis-lock': {
      label: 'Redis Distributed Lock',
      short: 'Redis Lock',
      color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      icon: Cpu,
      desc: 'SET NX PX distributed lock with Lua-safe releases. Cluster-safe serverless mutual exclusion.',
    },
  }[current];

  const Icon = config.icon;

  if (showSelector) {
    return (
      <div className="flex items-center space-x-2">
        <span className="text-xs text-zinc-400 font-mono">Strategy:</span>
        <select
          value={current}
          onChange={(e) => setStrategy(e.target.value as LockingStrategy)}
          className="bg-surface-card border border-surface-border text-xs rounded-md px-2.5 py-1 text-zinc-200 focus:outline-none focus:border-brand transition-colors font-mono cursor-pointer"
        >
          <option value="mongo-atomic">Mongo Atomic (Safe)</option>
          <option value="redis-lock">Redis Lock (Safe)</option>
          <option value="naive">Naive (Unsafe)</option>
        </select>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-medium ${config.color}`}
      title={config.desc}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{config.short}</span>
    </div>
  );
}
