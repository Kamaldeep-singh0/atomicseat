import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
// @ts-ignore
import RedisMock from 'ioredis-mock';
import { Event } from '../src/models/Event.js';
import { Seat } from '../src/models/Seat.js';
import { Booking } from '../src/models/Booking.js';
import { User } from '../src/models/User.js';
import { eventService } from '../src/services/event.service.js';
import { LockStrategyFactory } from '../src/services/locking/lock.factory.js';
import { NaiveStrategy } from '../src/services/locking/naive.strategy.js';
import { MongoAtomicStrategy } from '../src/services/locking/mongo-atomic.strategy.js';
import { RedisLockStrategy } from '../src/services/locking/redis-lock.strategy.js';

describe('Atomic Seat Concurrency & Locking Strategies', () => {
  let mongoServer: MongoMemoryServer;
  let redisMock: any;
  let testEvent: any;
  let testSeats: any[];

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    redisMock = new RedisMock();
    await Promise.all([
      Event.init(),
      Seat.init(),
      Booking.syncIndexes(),
      User.init(),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await Promise.all([
      Event.deleteMany({}),
      Seat.deleteMany({}),
      Booking.deleteMany({}),
      User.deleteMany({}),
    ]);

    testEvent = await eventService.createEvent({
      title: 'High Concurrency Benchmark Event',
      venue: 'Cloud Run Virtual Arena',
      date: new Date(),
      rows: 5,
      cols: 5,
      price: 100,
    });

    testSeats = await Seat.find({ eventId: testEvent._id }).sort({ row: 1, col: 1 });
  });

  it('1. Naive Strategy: FAILS under concurrency and produces double-locks and double-bookings', async () => {
    const targetSeat = testSeats[0];
    const naiveStrategy = new NaiveStrategy();
    const concurrentAttempts = 30;

    // Concurrently attempt to lock the exact same seat with 30 distinct simulated users
    const lockPromises = Array.from({ length: concurrentAttempts }, (_, i) => {
      const simulatedUserId = new mongoose.Types.ObjectId().toString();
      return naiveStrategy.lockSeat(
        testEvent._id.toString(),
        targetSeat._id.toString(),
        simulatedUserId,
        60000
      );
    });

    const lockResults = await Promise.all(lockPromises);
    const successfulLocks = lockResults.filter((r) => r.success);

    // In naive read-then-write mode, multiple requests should slip through the race window!
    expect(successfulLocks.length).toBeGreaterThan(1);

    // Now test concurrent booking on the naive strategy for the same seat
    const bookPromises = Array.from({ length: 15 }, (_, i) => {
      const simulatedUserId = new mongoose.Types.ObjectId().toString();
      return naiveStrategy.bookSeat(
        testEvent._id.toString(),
        targetSeat._id.toString(),
        simulatedUserId,
        100
      );
    });

    const bookResults = await Promise.all(bookPromises);
    const successfulBookings = bookResults.filter((r) => r.success);

    // Multiple bookings succeeded for the exact same seat!
    expect(successfulBookings.length).toBeGreaterThan(1);

    // Check database records: double-bookings detected in MongoDB!
    const doubleBookings = await Booking.aggregate([
      { $match: { seatId: targetSeat._id, status: 'confirmed' } },
      { $group: { _id: '$seatId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    expect(doubleBookings.length).toBe(1);
    expect(doubleBookings[0].count).toBeGreaterThan(1);
  });

  it('2. Mongo-Atomic Strategy: 500 concurrent requests produce EXACTLY 1 winner and ZERO double-bookings', async () => {
    const targetSeat = testSeats[1];
    const mongoStrategy = new MongoAtomicStrategy();
    const concurrentRequests = 500;

    const userIds = Array.from({ length: concurrentRequests }, () =>
      new mongoose.Types.ObjectId().toString()
    );

    // 500 concurrent requests hit the SAME seat at the exact same millisecond
    const results = await Promise.all(
      userIds.map((uid) =>
        mongoStrategy.lockSeat(
          testEvent._id.toString(),
          targetSeat._id.toString(),
          uid,
          300000
        )
      )
    );

    const successfulLocks = results.filter((r) => r.success);
    const rejectedLocks = results.filter((r) => !r.success);

    // EXACTLY 1 request must win the lock!
    expect(successfulLocks.length).toBe(1);
    // EXACTLY 499 requests must be rejected!
    expect(rejectedLocks.length).toBe(499);

    const winningSeat = successfulLocks[0].seat!;
    const winningUserId = winningSeat.lockedBy!.toString();

    // Now attempt 500 concurrent bookings for this seat
    // Only the winning user should be able to confirm booking!
    const bookingResults = await Promise.all(
      userIds.map((uid) =>
        mongoStrategy.bookSeat(
          testEvent._id.toString(),
          targetSeat._id.toString(),
          uid,
          100
        )
      )
    );

    const successfulBookings = bookingResults.filter((r) => r.success);
    const rejectedBookings = bookingResults.filter((r) => !r.success);

    expect(successfulBookings.length).toBe(1);
    expect(rejectedBookings.length).toBe(499);
    expect(successfulBookings[0].booking?.userId.toString()).toBe(winningUserId);

    // Check DB invariant: ZERO double-bookings in MongoDB
    const doubleBookings = await Booking.aggregate([
      { $match: { seatId: targetSeat._id, status: 'confirmed' } },
      { $group: { _id: '$seatId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    expect(doubleBookings.length).toBe(0);
  });

  it('3. Redis-Lock Strategy: 500 concurrent requests produce EXACTLY 1 winner and ZERO double-bookings', async () => {
    const targetSeat = testSeats[2];
    const redisStrategy = new RedisLockStrategy(redisMock);
    const concurrentRequests = 500;

    const userIds = Array.from({ length: concurrentRequests }, () =>
      new mongoose.Types.ObjectId().toString()
    );

    // 500 concurrent requests hit the SAME seat using Redis SET NX PX
    const results = await Promise.all(
      userIds.map((uid) =>
        redisStrategy.lockSeat(
          testEvent._id.toString(),
          targetSeat._id.toString(),
          uid,
          300000
        )
      )
    );

    const successfulLocks = results.filter((r) => r.success);
    const rejectedLocks = results.filter((r) => !r.success);

    // EXACTLY 1 winner
    expect(successfulLocks.length).toBe(1);
    expect(rejectedLocks.length).toBe(499);

    const winningSeat = successfulLocks[0].seat!;
    const winningUserId = winningSeat.lockedBy!.toString();

    // Confirm booking via Redis lock Lua-safe release
    const bookResult = await redisStrategy.bookSeat(
      testEvent._id.toString(),
      targetSeat._id.toString(),
      winningUserId,
      100
    );

    expect(bookResult.success).toBe(true);

    // Impostor trying to book must fail
    const impostorResult = await redisStrategy.bookSeat(
      testEvent._id.toString(),
      targetSeat._id.toString(),
      new mongoose.Types.ObjectId().toString(),
      100
    );
    expect(impostorResult.success).toBe(false);

    // Database verification: ZERO double-bookings
    const doubleBookings = await Booking.aggregate([
      { $match: { seatId: targetSeat._id, status: 'confirmed' } },
      { $group: { _id: '$seatId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    expect(doubleBookings.length).toBe(0);
  });

  it('4. Background-free Expiry: Expired lock automatically becomes available without background worker', async () => {
    const targetSeat = testSeats[3];
    const mongoStrategy = new MongoAtomicStrategy();
    const user1 = new mongoose.Types.ObjectId().toString();
    const user2 = new mongoose.Types.ObjectId().toString();

    // Lock seat with negative/past duration (-1000ms) so it's instantly expired
    await mongoStrategy.lockSeat(
      testEvent._id.toString(),
      targetSeat._id.toString(),
      user1,
      -1000
    );

    // Ensure seat in DB is locked but lockedUntil is in the past
    const dbSeat = await Seat.findById(targetSeat._id);
    expect(dbSeat?.status).toBe('locked');
    expect(dbSeat?.lockedUntil!.getTime()).toBeLessThan(Date.now());

    // User 2 immediately attempts to lock it with mongo-atomic
    // Expiry is checked inside the query: condition (status=available OR lockedUntil < now) matches!
    const user2Result = await mongoStrategy.lockSeat(
      testEvent._id.toString(),
      targetSeat._id.toString(),
      user2,
      300000
    );

    expect(user2Result.success).toBe(true);
    expect(user2Result.seat?.lockedBy?.toString()).toBe(user2);
  });

  it('5. Safe-mode Unique Invariant: rejects duplicate confirmed bookings at database level', async () => {
    const targetSeat = testSeats[4];
    const user1 = new mongoose.Types.ObjectId();
    const user2 = new mongoose.Types.ObjectId();

    // Insert first confirmed booking with safe strategy
    await Booking.create({
      bookingRef: 'BK-INV-001',
      eventId: testEvent._id,
      seatId: targetSeat._id,
      userId: user1,
      amount: 100,
      status: 'confirmed',
      strategyUsed: 'mongo-atomic',
    });

    // Attempting to insert a 2nd confirmed booking for the same seat in safe mode MUST violate the partial unique index
    await expect(
      Booking.create({
        bookingRef: 'BK-INV-002',
        eventId: testEvent._id,
        seatId: targetSeat._id,
        userId: user2,
        amount: 100,
        status: 'confirmed',
        strategyUsed: 'mongo-atomic',
      })
    ).rejects.toThrow();
  });
});
