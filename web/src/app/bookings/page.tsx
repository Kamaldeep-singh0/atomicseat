'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { fetchApi } from '../../lib/api';
import { formatDate, formatPrice } from '../../lib/utils';
import { StrategyBadge } from '../../components/StrategyBadge';
import { History, Ticket, Calendar, MapPin, ArrowRight, ShieldCheck } from 'lucide-react';

interface BookingRecord {
  _id: string;
  bookingRef: string;
  amount: number;
  status: string;
  strategyUsed: 'naive' | 'mongo-atomic' | 'redis-lock';
  createdAt: string;
  eventId: {
    _id: string;
    title: string;
    venue: string;
    date: string;
  };
  seatId: {
    _id: string;
    row: string;
    col: number;
    seatNumber: string;
  };
}

export default function BookingsHistoryPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchApi<{ success: boolean; data: BookingRecord[] }>('/api/bookings/my')
      .then((res) => {
        if (res.success && res.data) {
          setBookings(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load bookings:', err);
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/30 text-brand mx-auto flex items-center justify-center">
          <Ticket className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Login to View Bookings</h2>
        <p className="text-xs text-zinc-400">
          Sign in to access your ticket booking history and confirmed seats.
        </p>
        <Link
          href="/login"
          className="inline-block mt-4 text-xs font-semibold px-4 py-2 bg-brand text-black rounded-lg glow-brand"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-surface-border pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Booking History</h1>
            <p className="text-xs text-zinc-400 font-mono">
              Tickets confirmed and stored in MongoDB under user account: {user.email}
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="text-xs font-medium text-brand hover:underline flex items-center space-x-1"
        >
          <span>Find more events</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto glow-brand" />
          <p className="text-xs font-mono text-zinc-400">Retrieving confirmed tickets...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-20 bg-surface-card border border-surface-border rounded-2xl p-8 space-y-3">
          <Ticket className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Tickets Found</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            You have not booked any seats yet. Visit any event to lock a seat and simulate instant payment.
          </p>
          <Link
            href="/"
            className="inline-block mt-4 text-xs font-semibold px-4 py-2 bg-brand text-black rounded-lg glow-brand"
          >
            Browse Available Events
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div
              key={booking._id}
              className="bg-surface-card border border-surface-border hover:border-brand/40 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
            >
              <div className="flex items-start space-x-4">
                <div className="w-14 h-14 rounded-xl bg-brand/10 border border-brand/30 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] font-mono text-brand font-bold uppercase">SEAT</span>
                  <span className="text-base font-extrabold font-mono text-white">
                    {booking.seatId?.seatNumber || 'N/A'}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">
                      {booking.eventId?.title || 'Event'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-semibold">
                      {booking.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{booking.eventId?.date ? formatDate(booking.eventId.date) : ''}</span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{booking.eventId?.venue || ''}</span>
                    </div>
                  </div>

                  <div className="text-[11px] font-mono text-zinc-400 pt-1">
                    Booking Ref: <span className="text-zinc-200">{booking.bookingRef}</span>
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-surface-border pt-3 sm:pt-0">
                <div className="text-base font-bold font-mono text-white">
                  {formatPrice(booking.amount)}
                </div>
                <div className="mt-1">
                  <StrategyBadge strategy={booking.strategyUsed} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
