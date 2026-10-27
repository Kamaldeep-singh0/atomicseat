'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { fetchApi } from '../../../lib/api';
import { PlusCircle, ArrowLeft, ShieldAlert, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function NewEventPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [rows, setRows] = useState(8);
  const [cols, setCols] = useState(10);
  const [price, setPrice] = useState(75);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res: any = await fetchApi('/api/events', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          venue,
          date,
          rows: Number(rows),
          cols: Number(cols),
          price: Number(price),
        }),
      });

      if (res.success && res.data) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/events/${res.data._id}`);
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Admin Access Required</h2>
        <p className="text-xs text-zinc-400">
          Only administrators can create events and auto-generate seat grids.
        </p>
        <Link
          href="/login"
          className="inline-block mt-4 text-xs font-semibold px-4 py-2 bg-brand text-black rounded-lg"
        >
          Login with Admin Demo Account
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/"
        className="inline-flex items-center space-x-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to events</span>
      </Link>

      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 sm:p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Create New Event</h1>
            <p className="text-xs text-zinc-400 font-mono">
              Creates event document and automatically generates the seat grid documents.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-mono flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 font-mono flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Event and seat grid created successfully! Redirecting...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1.5">
              Event Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Neon Horizon Festival 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-background border border-surface-border rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Event overview, performers, or speaker details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-background border border-surface-border rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1.5">
                Venue *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Cyberdome Main Stage"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="w-full bg-background border border-surface-border rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1.5">
                Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-background border border-surface-border rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand transition-colors"
              />
            </div>
          </div>

          {/* Grid Settings */}
          <div className="p-4 bg-background border border-surface-border rounded-xl space-y-4">
            <span className="text-xs font-mono text-brand font-semibold uppercase">
              Seat Grid Configuration
            </span>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Rows
                </label>
                <input
                  type="number"
                  min={1}
                  max={26}
                  required
                  value={rows}
                  onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Columns
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={cols}
                  onChange={(e) => setCols(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Price ($)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={price}
                  onChange={(e) => setPrice(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between border-t border-surface-border pt-2">
              <span>Total Seats to Generate:</span>
              <span className="text-white font-bold">{rows * cols} seats ({rows} rows × {cols} cols)</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand-hover text-black font-semibold text-sm transition-all glow-brand disabled:opacity-50"
          >
            {loading ? 'Creating Event & Seat Grid...' : 'Create Event & Generate Seats'}
          </button>
        </form>
      </div>
    </div>
  );
}
