import { ISeat } from '../../models/Seat.js';
import { IBooking } from '../../models/Booking.js';

export interface LockResult {
  success: boolean;
  seat?: ISeat;
  reason?: string;
}

export interface ReleaseResult {
  success: boolean;
  reason?: string;
}

export interface BookResult {
  success: boolean;
  booking?: IBooking;
  seat?: ISeat;
  reason?: string;
}

export interface ILockingStrategy {
  readonly name: 'naive' | 'mongo-atomic' | 'redis-lock';

  lockSeat(
    eventId: string,
    seatId: string,
    userId: string,
    durationMs: number
  ): Promise<LockResult>;

  releaseSeat(
    eventId: string,
    seatId: string,
    userId: string
  ): Promise<ReleaseResult>;

  bookSeat(
    eventId: string,
    seatId: string,
    userId: string,
    amount: number
  ): Promise<BookResult>;
}
