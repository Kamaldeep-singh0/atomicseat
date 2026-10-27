import { Booking, IBooking } from '../models/Booking.js';
import { Event } from '../models/Event.js';
import { LockStrategyFactory } from './locking/lock.factory.js';
import { broadcastSeatUpdate } from '../socket/socket.js';

export class BookingService {
  async bookSeat(
    eventId: string,
    seatId: string,
    userId: string,
    strategyName?: string,
    customAmount?: number
  ) {
    let amount = customAmount;
    if (!amount) {
      const event = await Event.findById(eventId);
      amount = event ? event.price : 50;
    }

    const strategy = LockStrategyFactory.getStrategy(strategyName);
    const result = await strategy.bookSeat(eventId, seatId, userId, amount);

    if (result.success && result.seat) {
      broadcastSeatUpdate(eventId, {
        seatId: result.seat._id.toString(),
        eventId,
        status: 'booked',
        bookedBy: userId,
        seatNumber: result.seat.seatNumber,
      });
    }

    return result;
  }

  async getUserBookings(userId: string) {
    return Booking.find({ userId })
      .populate('eventId', 'title venue date price')
      .populate('seatId', 'row col seatNumber')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getBookingsByEvent(eventId: string) {
    return Booking.find({ eventId })
      .populate('userId', 'name email')
      .populate('seatId', 'row col seatNumber')
      .sort({ createdAt: -1 })
      .lean();
  }
}

export const bookingService = new BookingService();
