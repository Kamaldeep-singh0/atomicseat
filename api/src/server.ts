import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectMongo, disconnectMongo } from './db/mongo.js';
import { disconnectRedis } from './db/redis.js';
import { initSocket } from './socket/socket.js';
import { heartbeatService } from './services/heartbeat.service.js';

async function bootstrap() {
  console.log(`[Atomic Seat API] Starting instance: ${config.instanceId}`);
  console.log(`[Atomic Seat API] Default locking strategy: ${config.lockStrategy}`);

  // 1. Setup Express & HTTP Server
  const app = createApp();
  const server = createServer(app);

  // 2. Setup Socket.io
  initSocket(server);

  // 3. Listen on 0.0.0.0 and configured port immediately (satisfies Cloud Run startup probe)
  server.listen(config.port, '0.0.0.0', () => {
    console.log(`[Atomic Seat API] Ready and listening on http://0.0.0.0:${config.port}`);
    console.log(`[Atomic Seat API] Health check: http://0.0.0.0:${config.port}/health`);
  });

  // 4. Connect to MongoDB with auto-retry
  const connectWithRetry = async () => {
    try {
      await connectMongo();
    } catch (err: any) {
      console.warn(`[MongoDB] Initial connection failed (${err.message}). Retrying in 4s...`);
      setTimeout(connectWithRetry, 4000);
    }
  };
  connectWithRetry();

  // 5. Start Redis Heartbeat loop
  try {
    heartbeatService.start();
  } catch (err: any) {
    console.warn(`[Heartbeat] Redis heartbeat initialization skipped: ${err.message}`);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Atomic Seat API] Received ${signal}. Shutting down gracefully...`);
    await heartbeatService.stop();
    server.close(async () => {
      await disconnectMongo();
      await disconnectRedis();
      console.log('[Atomic Seat API] Process terminated.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    console.error('[Process UncaughtException]', err);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Process UnhandledRejection]', reason);
  });
}

bootstrap().catch((err) => {
  console.error('[Atomic Seat API] Fatal startup error:', err);
});
