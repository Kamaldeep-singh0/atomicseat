'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useStrategy } from '../context/StrategyContext';
import { fetchApi } from '../lib/api';
import { LockCountdown } from './LockCountdown';
import { formatPrice } from '../lib/utils';
import { Lock, CheckCircle, ShieldAlert, CreditCard, RotateCcw } from 'lucide-react';

export interface SeatItem {
  _id: string;
  eventId: string;
  row: string;
  col: number;
  seatNumber: string;
  status: 'available' | 'locked' | 'booked';
  lockedBy: string | null;
  lockedUntil: string | null;
  bookedBy?: string | null;
}

interface Props {
  eventId: string;
  eventPrice: number;
  onBookingSuccess?: (booking: any) => void;
}

export function SeatMap({ eventId, eventPrice, onBookingSuccess }: Props) {
  const { user } = useAuth();
  const { socket, joinEvent, leaveEvent, registerReconnectHandler } = useSocket();
  const { strategy } = useStrategy();

  const [seats, setSeats] = useState<SeatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch full seat list from API
  const loadSeats = async () => {
    try {
      const res: any = await fetchApi(`/api/events/${eventId}/seats`);
      if (res.success && res.data) {
        setSeats(res.data);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load seats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeats();
    joinEvent(eventId);

    // Register auto-refetch handler when socket reconnects to any Cloud Run instance
    const unregister = registerReconnectHandler(() => {
      console.log('[SeatMap] Socket reconnected. Refreshing seat map state from DB...');
      loadSeats();
    });

    return () => {
      leaveEvent(eventId);
      unregister();
    };
  }, [eventId, joinEvent, leaveEvent, registerReconnectHandler]);

  // Listen to live socket seat updates
  useEffect(() => {
    if (!socket) return;

    const handleSeatUpdate = (payload: {
      seatId: string;
      eventId: string;
      status: 'available' | 'locked' | 'booked';
      lockedUntil?: string | null;
      lockedBy?: string | null;
      seatNumber?: string;
    }) => {
      if (payload.eventId !== eventId) return;

      setSeats((prev) =>
        prev.map((s) => {
          if (s._id === payload.seatId) {
            return {
              ...s,
              status: payload.status,
              lockedUntil: payload.lockedUntil || null,
              lockedBy: payload.lockedBy || null,
            };
          }
          return s;
        })
      );
    };

    socket.on('seat:updated', handleSeatUpdate);

    return () => {
      socket.off('seat:updated', handleSeatUpdate);
    };
  }, [socket, eventId]);

  // Find seat currently locked by the logged-in user (if any)
  const myLockedSeat = useMemo(() => {
    if (!user) return null;
    return seats.find(
      (s) =>
        s.status === 'locked' &&
        s.lockedBy === user.id &&
        s.lockedUntil &&
        new Date(s.lockedUntil) > new Date()
    );
  }, [seats, user]);

  // Handle clicking a seat
  const handleSeatClick = async (seat: SeatItem) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!user) {
      setErrorMessage('Please log in first to lock and book seats.');
      return;
    }

    // If seat is booked, ignore
    if (seat.status === 'booked') return;

    // If locked by someone else, ignore
    if (seat.status === 'locked' && seat.lockedBy !== user.id) {
      setErrorMessage(`Seat ${seat.seatNumber} is currently held by another user.`);
      return;
    }

    // If seat is already locked by ME, do nothing (checkout bar is visible)
    if (seat.status === 'locked' && seat.lockedBy === user.id) {
      return;
    }

    // Lock the seat
    setActionLoading(true);
    try {
      const res: any = await fetchApi(`/api/events/${eventId}/seats/${seat._id}/lock`, {
        method: 'POST',
        strategy,
      });

      if (res.success && res.data) {
        setSuccessMessage(`Locked seat ${seat.seatNumber} for 5 minutes!`);
        // Optimistically update
        setSeats((prev) =>
          prev.map((s) => (s._id === seat._id ? { ...s, ...res.data } : s))
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Seat could not be locked. It may already be taken.');
      // Re-sync with server
      loadSeats();
    } finally {
      setActionLoading(false);
    }
  };

  // Release the currently held lock
  const handleRelease = async () => {
    if (!myLockedSeat || !user) return;
    setActionLoading(true);
    setErrorMessage(null);

    try {
      const res: any = await fetchApi(
        `/api/events/${eventId}/seats/${myLockedSeat._id}/release`,
        {
          method: 'POST',
          strategy,
        }
      );

      if (res.success) {
        setSuccessMessage(`Released seat ${myLockedSeat.seatNumber}.`);
        setSeats((prev) =>
          prev.map((s) =>
            s._id === myLockedSeat._id
              ? { ...s, status: 'available', lockedBy: null, lockedUntil: null }
              : s
          )
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to release seat.');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm and book seat
  const handleConfirmBooking = async () => {
    if (!myLockedSeat || !user) return;
    setActionLoading(true);
    setErrorMessage(null);

    try {
      const res: any = await fetchApi(
        `/api/events/${eventId}/seats/${myLockedSeat._id}/book`,
        {
          method: 'POST',
          strategy,
          body: JSON.stringify({ amount: eventPrice }),
        }
      );

      if (res.success && res.data) {
        setSuccessMessage(
          `Success! Booking confirmed for ${myLockedSeat.seatNumber} (Ref: ${res.data.booking.bookingRef}).`
        );
        if (onBookingSuccess) {
          onBookingSuccess(res.data.booking);
        }
        // Update seat state to booked
        setSeats((prev) =>
          prev.map((s) =>
            s._id === myLockedSeat._id
              ? { ...s, status: 'booked', bookedBy: user.id }
              : s
          )
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Booking confirmation failed.');
      loadSeats();
    } finally {
      setActionLoading(false);
    }
  };

  // Group seats by row for clean grid rendering
  const rows = useMemo(() => {
    const grouped: Record<string, SeatItem[]> = {};
    seats.forEach((seat) => {
      if (!grouped[seat.row]) {
        grouped[seat.row] = [];
      }
      grouped[seat.row].push(seat);
    });
    // Sort seats in each row by col
    Object.keys(grouped).forEach((r) => {
      grouped[r].sort((a, b) => a.col - b.col);
    });
    return grouped;
  }, [seats]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin glow-brand" />
        <p className="text-xs font-mono text-zinc-400">Loading live seat grid from MongoDB cluster...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full select-none">
      {/* Alert Messages */}
      {errorMessage && (
        <div className="w-full max-w-2xl mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center space-x-2 text-xs text-red-400 font-mono">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="w-full max-w-2xl mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center space-x-2 text-xs text-emerald-400 font-mono">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Stage Screen Visualization */}
      <div className="w-full max-w-2xl mb-10 flex flex-col items-center">
        <div className="w-3/4 h-2.5 bg-gradient-to-r from-transparent via-brand to-transparent rounded-full glow-brand" />
        <span className="text-[11px] font-mono tracking-widest text-zinc-400 uppercase mt-2">
          STAGE / SCREEN
        </span>
      </div>

      {/* Seat Map Grid */}
      <div className="p-6 bg-surface-card border border-surface-border rounded-2xl shadow-2xl overflow-x-auto max-w-full">
        <div className="flex flex-col space-y-2.5 min-w-max">
          {Object.entries(rows).map(([rowLetter, rowSeats]) => (
            <div key={rowLetter} className="flex items-center space-x-2.5">
              {/* Row Label */}
              <div className="w-6 text-center text-xs font-mono text-zinc-400 font-bold">
                {rowLetter}
              </div>

              {/* Seats */}
              <div className="flex items-center space-x-2">
                {rowSeats.map((seat) => {
                  const isMine = Boolean(
                    seat.status === 'locked' &&
                    user &&
                    seat.lockedBy === user.id &&
                    seat.lockedUntil &&
                    new Date(seat.lockedUntil) > new Date()
                  );

                  const isOtherLocked = Boolean(
                    seat.status === 'locked' &&
                    (!user || seat.lockedBy !== user.id) &&
                    seat.lockedUntil &&
                    new Date(seat.lockedUntil) > new Date()
                  );

                  const isBooked = seat.status === 'booked';
                  const isAvailable = !isMine && !isOtherLocked && !isBooked;

                  return (
                    <button
                      key={seat._id}
                      onClick={() => handleSeatClick(seat)}
                      disabled={Boolean(actionLoading || isBooked || isOtherLocked)}
                      title={`Seat ${seat.seatNumber} • ${
                        isBooked
                          ? 'Booked'
                          : isMine
                          ? 'Locked by you (Click Confirm below)'
                          : isOtherLocked
                          ? 'Locked by another user'
                          : `Available ($${eventPrice})`
                      }`}
                      className={`relative w-8 h-8 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center transition-all duration-150 ${
                        isMine
                          ? 'bg-brand text-black font-extrabold shadow-lg glow-brand scale-105 z-10 pulse-mine ring-2 ring-brand'
                          : isOtherLocked
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 cursor-not-allowed opacity-90'
                          : isBooked
                          ? 'bg-[#181a24] text-zinc-600 border border-zinc-800/60 cursor-not-allowed'
                          : 'bg-seat-available text-zinc-300 border border-seat-available-border hover:border-brand hover:text-brand hover:scale-105 hover:glow-brand cursor-pointer'
                      }`}
                    >
                      {isMine ? (
                        <span>{seat.col}</span>
                      ) : isOtherLocked ? (
                        <Lock className="w-3 h-3 text-amber-400" />
                      ) : isBooked ? (
                        <span className="line-through">{seat.col}</span>
                      ) : (
                        seat.col
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Row Label Right */}
              <div className="w-6 text-center text-xs font-mono text-zinc-400 font-bold">
                {rowLetter}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs font-mono text-zinc-400">
        <div className="flex items-center space-x-1.5">
          <div className="w-4 h-4 rounded bg-seat-available border border-seat-available-border" />
          <span>Available</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-4 h-4 rounded bg-brand text-black font-bold flex items-center justify-center text-[9px] glow-brand">
            ★
          </div>
          <span className="text-brand font-semibold">Locked by You</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-4 h-4 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Lock className="w-2.5 h-2.5 text-amber-400" />
          </div>
          <span>Locked by Others</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-4 h-4 rounded bg-[#181a24] border border-zinc-800/60 flex items-center justify-center text-zinc-600 line-through text-[9px]">
            1
          </div>
          <span>Booked</span>
        </div>
      </div>

      {/* Active Checkout Dock (When User has locked a seat) */}
      {myLockedSeat && (
        <div className="fixed bottom-6 z-40 max-w-2xl w-[92%] bg-surface-card/95 backdrop-blur-lg border border-brand/50 rounded-2xl p-4 shadow-2xl glow-brand flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/40 flex flex-col items-center justify-center">
              <span className="text-[10px] font-mono text-brand font-semibold">SEAT</span>
              <span className="text-sm font-bold font-mono text-white">{myLockedSeat.seatNumber}</span>
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-mono">Price: {formatPrice(eventPrice)}</div>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-zinc-300 font-medium">Expires in:</span>
                <LockCountdown
                  lockedUntil={myLockedSeat.lockedUntil!}
                  onExpired={() => {
                    setErrorMessage('Seat lock expired! Returning seat to available state.');
                    loadSeats();
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={handleRelease}
              disabled={actionLoading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1 px-3 py-2 text-xs font-mono text-zinc-400 hover:text-white bg-surface-hover hover:bg-zinc-800 rounded-lg transition-colors border border-surface-border"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Release</span>
            </button>

            <button
              onClick={handleConfirmBooking}
              disabled={actionLoading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 px-5 py-2 text-xs font-semibold text-black bg-brand hover:bg-brand-hover rounded-lg transition-all glow-brand active:scale-95 disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              <span>{actionLoading ? 'Processing...' : 'Confirm & Pay'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
