import React from 'react';
import Link from 'next/link';
import { formatDate, formatPrice } from '../lib/utils';
import { Calendar, MapPin, Users, ArrowRight } from 'lucide-react';

export interface EventItem {
  _id: string;
  title: string;
  description?: string;
  venue: string;
  date: string;
  rows: number;
  cols: number;
  totalSeats: number;
  price: number;
}

interface Props {
  event: EventItem;
}

export function EventCard({ event }: Props) {
  return (
    <div className="bg-surface-card border border-surface-border hover:border-brand/50 rounded-xl p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-xl hover:shadow-cyan-950/20 group">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono tracking-wider text-brand px-2.5 py-0.5 rounded-full bg-brand/10 border border-brand/20">
            {event.rows}×{event.cols} SEAT GRID
          </span>
          <span className="text-base font-bold text-white font-mono">
            {formatPrice(event.price)}
          </span>
        </div>

        <h3 className="text-lg font-bold text-white group-hover:text-brand transition-colors line-clamp-1 mb-2">
          {event.title}
        </h3>

        {event.description && (
          <p className="text-xs text-zinc-400 line-clamp-2 mb-4 leading-relaxed">
            {event.description}
          </p>
        )}

        <div className="space-y-2 mb-6 text-xs text-zinc-300">
          <div className="flex items-center space-x-2">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span>{formatDate(event.date)}</span>
          </div>

          <div className="flex items-center space-x-2">
            <MapPin className="w-3.5 h-3.5 text-zinc-400" />
            <span className="line-clamp-1">{event.venue}</span>
          </div>

          <div className="flex items-center space-x-2">
            <Users className="w-3.5 h-3.5 text-zinc-400" />
            <span>{event.totalSeats} Total Seats</span>
          </div>
        </div>
      </div>

      <Link
        href={`/events/${event._id}`}
        className="inline-flex items-center justify-center space-x-2 w-full py-2.5 px-4 rounded-lg bg-surface-hover hover:bg-brand hover:text-black text-xs font-semibold text-zinc-200 border border-surface-border hover:border-brand transition-all duration-150 group-hover:glow-brand"
      >
        <span>View Live Seat Map</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
