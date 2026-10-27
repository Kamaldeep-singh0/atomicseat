'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchApi } from '../../../lib/api';
import { SeatMap } from '../../../components/SeatMap';
import { StrategyBadge } from '../../../components/StrategyBadge';
import { formatDate, formatPrice } from '../../../lib/utils';
import { Calendar, MapPin, Ticket, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface EventDetail {
  _id: string;
  title: string;
  description: string;
  venue: string;
  date: string;
  rows: number;
  cols: number;
  totalSeats: number;
  price: number;
}

export default function EventSeatMapPage() {
  const params = useParams();
  const eventId = params.id as string;
  const router = useRouter();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null);

  useEffect(() => {
    if (!eventId) return;

    fetchApi<{ success: boolean; data: EventDetail }>(`/api/events/${eventId}`)
      .then((res) => {
        if (res.success && res.data) {
          setEvent(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load event:', err);
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 space-y-4">
        <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin glow-brand" />
        <p className="text-xs font-mono text-zinc-400">Loading live event map...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-white">Event Not Found</h2>
        <p className="text-xs text-zinc-400 mt-2">The requested event ID could not be loaded.</p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center space-x-2 text-xs font-medium text-brand hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Events</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back button and Header */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to all events</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-card border border-surface-border p-6 rounded-2xl">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] font-mono tracking-wider text-brand px-2.5 py-0.5 rounded-full bg-brand/10 border border-brand/20">
                LIVE INTERACTIVE GRID
              </span>
              <StrategyBadge />
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {event.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-zinc-300">
              <div className="flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-zinc-400" />
                <span>{formatDate(event.date)}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-zinc-400" />
                <span>{event.venue}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Ticket className="w-4 h-4 text-zinc-400" />
                <span>{event.totalSeats} Total Seats</span>
              </div>
            </div>
          </div>

          <div className="text-left md:text-right border-t md:border-t-0 md:border-l border-surface-border pt-4 md:pt-0 md:pl-6">
            <div className="text-xs text-zinc-400 font-mono">Price Per Seat</div>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">
              {formatPrice(event.price)}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Confirmation Celebration Banner */}
      {confirmedBooking && (
        <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-sm font-bold text-white">Ticket Confirmed!</div>
              <div className="text-xs text-zinc-300 font-mono">
                Booking Reference: <span className="text-emerald-400 font-bold">{confirmedBooking.bookingRef}</span>
              </div>
            </div>
          </div>
          <Link
            href="/bookings"
            className="text-xs font-mono font-medium text-emerald-400 hover:underline px-3 py-1.5 bg-emerald-500/20 rounded-md"
          >
            View in My Bookings →
          </Link>
        </div>
      )}

      {/* Real-time Interactive Seat Map */}
      <SeatMap
        eventId={eventId}
        eventPrice={event.price}
        onBookingSuccess={(booking) => setConfirmedBooking(booking)}
      />
    </div>
  );
}
