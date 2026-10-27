import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Seat, ISeat } from '../../models/Seat.js';
import { Booking } from '../../models/Booking.js';
import { ILockingStrategy, LockResult, ReleaseResult, BookResult } from './strategy.interface.js';

/**
 * Naive Strategy:
 * Classic read-then-write pattern with NO database-level or distributed protection.
 * Intentionally vulnerable to race conditions under concurrent load,
 * clearly demonstrating double-locking and double-booking failures.
 */
export class NaiveStrategy implements ILockingStrategy {
  readonly name = 'naive' as const;

  async lockSeat(
    eventId: string,
    seatId: string,
    userId: string,
    durationMs: number
  ): Promise<LockResult> {
    // 1. Read step: check seat status in memory
    const seat = await Seat.findOne({ _id: seatId, eventId });
    if (!seat) {
      return { success: false, reason: 'Seat not found' };
    }

    const now = new Date();
    const isAvailable =
      seat.status === 'available' ||
      (seat.status === 'locked' && seat.lockedUntil && seat.lockedUntil < now);

    if (!isAvailable) {
      return { success: false, reason: 'Seat is already locked or booked' };
    }

    // Artificial tiny async gap (10-20ms) to simulate real-world service latency
    // and widen the race-condition window for concurrent requests
    await new Promise((resolve) => setTimeout(resolve, 15));

    // 2. Write step: blind overwrite without atomic query condition
    seat.status = 'locked';
    seat.lockedBy = new mongoose.Types.ObjectId(userId);
    seat.lockedUntil = new Date(Date.now() + durationMs);
    seat.version += 1;
    await seat.save();

    return { success: true, seat };
  }

  async releaseSeat(
    eventId: string,
    seatId: string,
    userId: string
  ): Promise<ReleaseResult> {
    const seat = await Seat.findOne({ _id: seatId, eventId });
    if (!seat) {
      return { success: false, reason: 'Seat not found' };
    }

    if (seat.status !== 'locked' || seat.lockedBy?.toString() !== userId) {
      return { success: false, reason: 'Seat not locked by this user' };
    }

    seat.status = 'available';
    seat.lockedBy = null;
    seat.lockedUntil = null;
    seat.version += 1;
    await seat.save();

    return { success: true };
  }

  async bookSeat(
    eventId: string,
    seatId: string,
    userId: string,
    amount: number
  ): Promise<BookResult> {
    // 1. Read step
    const seat = await Seat.findOne({ _id: seatId, eventId });
    if (!seat) {
      return { success: false, reason: 'Seat not found' };
    }

    // In naive mode, if seat is booked, check
    if (seat.status === 'booked') {
      return { success: false, reason: 'Seat is already booked' };
    }

    // Race window delay
    await new Promise((resolve) => setTimeout(resolve, 15));

    // 2. Blind write update
    seat.status = 'booked';
    seat.bookedBy = new mongoose.Types.ObjectId(userId);
    seat.bookedAt = new Date();
    seat.lockedUntil = null;
    seat.version += 1;
    await seat.save();

    // 3. Create confirmed booking record
    const booking = await Booking.create({
      bookingRef: `BK-NAIVE-${uuidv4().slice(0, 8).toUpperCase()}`,
      eventId,
      seatId,
      userId,
      amount,
      status: 'confirmed',
      strategyUsed: 'naive',
    });

    return { success: true, booking, seat };
  }
}
