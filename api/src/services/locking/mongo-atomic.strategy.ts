import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Seat, ISeat } from '../../models/Seat.js';
import { Booking } from '../../models/Booking.js';
import { ILockingStrategy, LockResult, ReleaseResult, BookResult } from './strategy.interface.js';

/**
 * Mongo Atomic Strategy:
 * Uses atomic single-document findOneAndUpdate with strict conditional queries.
 * Evaluates expiration dynamically inside query criteria (background-free).
 * Guarantees zero double-locks and zero double-bookings without race conditions.
 */
export class MongoAtomicStrategy implements ILockingStrategy {
  readonly name = 'mongo-atomic' as const;

  async lockSeat(
    eventId: string,
    seatId: string,
    userId: string,
    durationMs: number
  ): Promise<LockResult> {
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + durationMs);

    // Atomically find and update only if status is 'available' OR lock has expired
    const updatedSeat = await Seat.findOneAndUpdate(
      {
        _id: seatId,
        eventId,
        $or: [
          { status: 'available' },
          { status: 'locked', lockedUntil: { $lt: now } },
        ],
      },
      {
        $set: {
          status: 'locked',
          lockedBy: new mongoose.Types.ObjectId(userId),
          lockedUntil,
        },
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!updatedSeat) {
      return {
        success: false,
        reason: 'Seat is currently locked or already booked',
      };
    }

    return { success: true, seat: updatedSeat };
  }

  async releaseSeat(
    eventId: string,
    seatId: string,
    userId: string
  ): Promise<ReleaseResult> {
    const updated = await Seat.findOneAndUpdate(
      {
        _id: seatId,
        eventId,
        status: 'locked',
        lockedBy: new mongoose.Types.ObjectId(userId),
      },
      {
        $set: {
          status: 'available',
          lockedBy: null,
          lockedUntil: null,
        },
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!updated) {
      return {
        success: false,
        reason: 'Seat lock not found or expired',
      };
    }

    return { success: true };
  }

  async bookSeat(
    eventId: string,
    seatId: string,
    userId: string,
    amount: number
  ): Promise<BookResult> {
    const now = new Date();

    // Atomically transition from locked to booked ONLY if currently held by this user and unexpired
    const updatedSeat = await Seat.findOneAndUpdate(
      {
        _id: seatId,
        eventId,
        status: 'locked',
        lockedBy: new mongoose.Types.ObjectId(userId),
        lockedUntil: { $gte: now },
      },
      {
        $set: {
          status: 'booked',
          bookedBy: new mongoose.Types.ObjectId(userId),
          bookedAt: now,
          lockedUntil: null,
        },
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!updatedSeat) {
      return {
        success: false,
        reason: 'Seat lock expired, invalid, or already booked',
      };
    }

    // Insert confirmed booking record (protected by Mongo unique partial index)
    try {
      const booking = await Booking.create({
        bookingRef: `BK-MONGO-${uuidv4().slice(0, 8).toUpperCase()}`,
        eventId,
        seatId,
        userId,
        amount,
        status: 'confirmed',
        strategyUsed: 'mongo-atomic',
      });

      return { success: true, booking, seat: updatedSeat };
    } catch (err: any) {
      // If invariant violation occurs, revert seat state
      await Seat.updateOne(
        { _id: seatId },
        { $set: { status: 'available', bookedBy: null, bookedAt: null } }
      );
      return {
        success: false,
        reason: `Booking failed invariant check: ${err.message}`,
      };
    }
  }
}
