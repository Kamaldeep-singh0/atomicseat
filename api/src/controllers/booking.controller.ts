import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { bookingService } from '../services/booking.service.js';

export class BookingController {
  async bookSeat(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { eventId, seatId } = req.params;
      const userId = req.user!.id;
      const strategy =
        (req.headers['x-lock-strategy'] as string) ||
        req.body?.strategy ||
        undefined;
      const amount = req.body?.amount;

      const result = await bookingService.bookSeat(
        eventId,
        seatId,
        userId,
        strategy,
        amount
      );

      if (!result.success) {
        res.status(409).json({
          success: false,
          error: result.reason || 'Could not complete booking',
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Seat successfully booked and confirmed',
        data: {
          booking: result.booking,
          seat: result.seat,
        },
      });
    } catch (err: any) {
      next(err);
    }
  }

  async getMyBookings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const bookings = await bookingService.getUserBookings(userId);
      res.status(200).json({ success: true, data: bookings });
    } catch (err: any) {
      next(err);
    }
  }

  async getEventBookings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { eventId } = req.params;
      const bookings = await bookingService.getBookingsByEvent(eventId);
      res.status(200).json({ success: true, data: bookings });
    } catch (err: any) {
      next(err);
    }
  }
}

export const bookingController = new BookingController();
