import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
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

  // Health check endpoint for Cloud Run and container readiness probes
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'atomic-seat-api',
      instanceId: config.instanceId,
      strategy: config.lockStrategy,
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API modules
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
