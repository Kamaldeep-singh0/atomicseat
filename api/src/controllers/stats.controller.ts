import { Request, Response, NextFunction } from 'express';
import { heartbeatService } from '../services/heartbeat.service.js';
import { Seat } from '../models/Seat.js';
import { Booking } from '../models/Booking.js';
import { config } from '../config/index.js';

export class StatsController {
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { count: activeInstances, instances } =
        await heartbeatService.getActiveInstances();

      const now = new Date();

      // Count active unexpired locks
      const activeLocksCount = await Seat.countDocuments({
        status: 'locked',
        lockedUntil: { $gte: now },
      });

      // Total confirmed bookings
      const totalBookingsCount = await Booking.countDocuments({
        status: 'confirmed',
      });

      // Detect double-bookings: aggregate bookings by (eventId, seatId) where count > 1
      const doubleBookingsAgg = await Booking.aggregate([
        { $match: { status: 'confirmed' } },
        {
          $group: {
            _id: { eventId: '$eventId', seatId: '$seatId' },
            count: { $sum: 1 },
            bookingIds: { $push: '$_id' },
            strategies: { $push: '$strategyUsed' },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ]);

      const doubleBookingsCount = doubleBookingsAgg.length;

      res.status(200).json({
        success: true,
        data: {
          activeInstances,
          instances,
          currentInstanceId: config.instanceId,
          activeLocks: activeLocksCount,
          totalBookings: totalBookingsCount,
          doubleBookingsDetected: doubleBookingsCount,
          doubleBookedSeats: doubleBookingsAgg,
          currentStrategy: config.lockStrategy,
          uptime: process.uptime(),
          timestamp: Date.now(),
        },
      });
    } catch (err: any) {
      next(err);
    }
  }

  async resetEventState(req: Request, res: Response, next: NextFunction) {
    try {
      const { eventId } = req.body;
      const query = eventId ? { eventId } : {};

      // Reset all seats to available
      await Seat.updateMany(query, {
        $set: {
          status: 'available',
          lockedBy: null,
          lockedUntil: null,
          bookedBy: null,
          bookedAt: null,
        },
      });

      // Delete bookings
      await Booking.deleteMany(query);

      res.status(200).json({
        success: true,
        message: 'Seats and bookings reset successfully',
      });
    } catch (err: any) {
      next(err);
    }
  }
}

export const statsController = new StatsController();
