import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { seatService } from '../services/seat.service.js';

export class SeatController {
  async getSeats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { eventId } = req.params;
      const seats = await seatService.getSeatsByEvent(eventId);
      res.status(200).json({ success: true, data: seats });
    } catch (err: any) {
      next(err);
    }
  }

  async lockSeat(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { eventId, seatId } = req.params;
      const userId = req.user!.id;
      const strategy =
        (req.headers['x-lock-strategy'] as string) ||
        req.body?.strategy ||
        undefined;
      const durationMs = req.body?.durationMs;

      const result = await seatService.lockSeat(
        eventId,
        seatId,
        userId,
        strategy,
        durationMs
      );

      if (!result.success) {
        res.status(409).json({
          success: false,
          error: result.reason || 'Seat could not be locked',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Seat successfully locked for 5 minutes',
        data: result.seat,
      });
    } catch (err: any) {
      next(err);
    }
  }

  async releaseSeat(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { eventId, seatId } = req.params;
      const userId = req.user!.id;
      const strategy =
        (req.headers['x-lock-strategy'] as string) ||
        req.body?.strategy ||
        undefined;

      const result = await seatService.releaseSeat(eventId, seatId, userId, strategy);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.reason || 'Could not release seat',
        });
        return;
      }

      res.status(200).json({ success: true, message: 'Seat released successfully' });
    } catch (err: any) {
      next(err);
    }
  }
}

export const seatController = new SeatController();
