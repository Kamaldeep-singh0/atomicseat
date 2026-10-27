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

  // 1. Connect MongoDB
  await connectMongo();

  // 2. Setup Express & HTTP Server
  const app = createApp();
  const server = createServer(app);

  // 3. Setup Socket.io with Redis Adapter
  initSocket(server);

  // 4. Start Redis Heartbeat loop for active instance tracking
  heartbeatService.start();

  // 5. Listen on configured port
  server.listen(config.port, () => {
    console.log(`[Atomic Seat API] Ready and listening on port ${config.port}`);
    console.log(`[Atomic Seat API] Health check: http://localhost:${config.port}/health`);
  });

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
}

bootstrap().catch((err) => {
  console.error('[Atomic Seat API] Fatal startup error:', err);
  process.exit(1);
});
