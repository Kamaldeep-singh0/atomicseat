import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Event } from '../src/models/Event.js';
import { Seat } from '../src/models/Seat.js';
import { Booking } from '../src/models/Booking.js';
import { authService } from '../src/services/auth.service.js';

describe('Atomic Seat API Integration Endpoints', () => {
  let mongoServer: MongoMemoryServer;
  let app: any;
  let adminToken: string;
  let userToken: string;
  let eventId: string;
  let sampleSeatId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Promise.all([
      Event.init(),
      Seat.init(),
      Booking.syncIndexes(),
      User.init(),
    ]);

    app = createApp();

    // Register test admin
    const adminRes = await authService.register('admin@test.dev', 'Secret123!', 'Admin', 'admin');
    adminToken = adminRes.token;

    // Register test user
    const userRes = await authService.register('user@test.dev', 'Secret123!', 'User', 'user');
    userToken = userRes.token;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('GET /health returns 200 with service metadata', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('atomic-seat-api');
    expect(res.body.status).toBe('ok');
    expect(res.body.instanceId).toBeDefined();
  });

  it('POST /api/events creates an event and seat grid', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Cyberpunk Arena 2026',
        venue: 'Neo-Tokyo Arena',
        date: new Date().toISOString(),
        rows: 4,
        cols: 6,
        price: 75,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalSeats).toBe(24);
    eventId = res.body.data._id;

    // Verify seats were created in database
    const seats = await Seat.find({ eventId });
    expect(seats.length).toBe(24);
    sampleSeatId = seats[0]._id.toString();
  });

  it('GET /api/events/:eventId/seats returns all seats with initial available status', async () => {
    const res = await request(app).get(`/api/events/${eventId}/seats`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(24);
    expect(res.body.data[0].status).toBe('available');
  });

  it('POST /api/events/:eventId/seats/:seatId/lock locks a seat for 5 minutes', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/seats/${sampleSeatId}/lock`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ strategy: 'mongo-atomic' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('locked');
  });

  it('POST /api/events/:eventId/seats/:seatId/lock rejects 2nd user for the locked seat', async () => {
    // Another simulated user attempts to lock the same seat
    const res = await request(app)
      .post(`/api/events/${eventId}/seats/${sampleSeatId}/lock`)
      .set('x-simulated-user-id', new mongoose.Types.ObjectId().toString())
      .send({ strategy: 'mongo-atomic' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/events/:eventId/seats/:seatId/book books and confirms the seat', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/seats/${sampleSeatId}/book`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ strategy: 'mongo-atomic' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.booking.status).toBe('confirmed');
    expect(res.body.data.seat.status).toBe('booked');
  });

  it('GET /api/bookings/my returns the user booking history', async () => {
    const res = await request(app)
      .get('/api/bookings/my')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].seatId._id.toString()).toBe(sampleSeatId);
  });

  it('GET /api/stats reports instance metrics and 0 double-bookings', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activeInstances).toBeGreaterThanOrEqual(1);
    expect(res.body.data.totalBookings).toBe(1);
    expect(res.body.data.doubleBookingsDetected).toBe(0);
  });
});
