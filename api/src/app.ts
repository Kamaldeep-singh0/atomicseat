import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config/index.js';
import { getLastMongoError, ensureMongoConnected } from './db/mongo.js';
import { errorHandler } from './middlewares/error.middleware.js';
import authRoutes from './routes/auth.routes.js';
import eventRoutes from './routes/event.routes.js';
import seatRoutes from './routes/seat.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import statsRoutes from './routes/stats.routes.js';
import rushRoutes from './routes/rush.routes.js';

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  );

  app.use(express.json());

  // Health check endpoint with database diagnostics
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'atomic-seat-api',
      instanceId: config.instanceId,
      strategy: config.lockStrategy,
      mongoReadyState: mongoose.connection.readyState,
      mongoConnected: mongoose.connection.readyState === 1,
      mongoError: getLastMongoError(),
      timestamp: new Date().toISOString(),
    });
  });

  // Ensure DB connection before handling API routes (prevents 10s buffer timeouts)
  app.use('/api', async (req: Request, res: Response, next) => {
    if (mongoose.connection.readyState !== 1) {
      try {
        await ensureMongoConnected();
      } catch (err: any) {
        return res.status(503).json({
          success: false,
          error: `Database connecting... (${err.message})`,
        });
      }
    }
    next();
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/events/:eventId/seats', seatRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/rush', rushRoutes);

  // Central error handling
  app.use(errorHandler);

  return app;
}
