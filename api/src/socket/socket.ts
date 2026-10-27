import { Server as HttpServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedisClient, getRedisSubscriber } from '../db/redis.js';
import { config } from '../config/index.js';

let io: Server | null = null;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  try {
    const pubClient = getRedisClient();
    const subClient = getRedisSubscriber();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Socket.io] Redis adapter attached successfully');
  } catch (err: any) {
    console.warn(`[Socket.io] Could not attach Redis adapter (standalone fallback): ${err.message}`);
  }

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on('join_event', (eventId: string) => {
      socket.join(`event:${eventId}`);
      console.log(`[Socket.io] Socket ${socket.id} joined event room: event:${eventId}`);
    });

    socket.on('leave_event', (eventId: string) => {
      socket.leave(`event:${eventId}`);
      console.log(`[Socket.io] Socket ${socket.id} left event room: event:${eventId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

export function broadcastSeatUpdate(eventId: string, seatData: any): void {
  if (io) {
    io.to(`event:${eventId}`).emit('seat:updated', seatData);
  }
}
