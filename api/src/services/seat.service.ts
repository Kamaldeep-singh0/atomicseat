import { Seat, ISeat } from '../models/Seat.js';
import { LockStrategyFactory } from './locking/lock.factory.js';
import { broadcastSeatUpdate } from '../socket/socket.js';
import { config } from '../config/index.js';

export interface SeatViewItem {
  _id: any;
  eventId: any;
  row: string;
  col: number;
  seatNumber: string;
  status: 'available' | 'locked' | 'booked';
  lockedBy: any;
  lockedUntil: any;
  bookedBy?: any;
  bookedAt?: any;
  version: number;
}

export class SeatService {
  /**
   * Background-free query: returns all seats with computed effective status.
   * If a seat is marked locked but lockedUntil is in the past, it is presented as 'available'.
   */
  async getSeatsByEvent(eventId: string): Promise<SeatViewItem[]> {
    const seats = await Seat.find({ eventId }).sort({ row: 1, col: 1 }).lean();
    const now = new Date();

    return seats.map((seat) => {
      const isExpiredLock =
        seat.status === 'locked' && seat.lockedUntil && new Date(seat.lockedUntil) < now;

      return {
        ...seat,
        status: isExpiredLock ? 'available' : seat.status,
        lockedBy: isExpiredLock ? null : seat.lockedBy,
        lockedUntil: isExpiredLock ? null : seat.lockedUntil,
      };
    });
  }

  async lockSeat(
    eventId: string,
    seatId: string,
    userId: string,
    strategyName?: string,
    durationMs?: number
  ) {
    const duration = durationMs || config.lockDurationMs;
    const strategy = LockStrategyFactory.getStrategy(strategyName);

    const result = await strategy.lockSeat(eventId, seatId, userId, duration);

    if (result.success && result.seat) {
      broadcastSeatUpdate(eventId, {
        seatId: result.seat._id.toString(),
        eventId,
        status: 'locked',
        lockedUntil: result.seat.lockedUntil,
        lockedBy: result.seat.lockedBy?.toString(),
        seatNumber: result.seat.seatNumber,
      });
    }

    return result;
  }

  async releaseSeat(
    eventId: string,
    seatId: string,
    userId: string,
    strategyName?: string
  ) {
    const strategy = LockStrategyFactory.getStrategy(strategyName);
    const result = await strategy.releaseSeat(eventId, seatId, userId);

    if (result.success) {
      broadcastSeatUpdate(eventId, {
        seatId,
        eventId,
        status: 'available',
        lockedUntil: null,
        lockedBy: null,
      });
    }

    return result;
  }
}

export const seatService = new SeatService();
