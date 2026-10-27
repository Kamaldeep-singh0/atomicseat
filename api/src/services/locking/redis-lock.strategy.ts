import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import { Seat, ISeat } from '../../models/Seat.js';
import { Booking } from '../../models/Booking.js';
import { ILockingStrategy, LockResult, ReleaseResult, BookResult } from './strategy.interface.js';
import { getRedisClient } from '../../db/redis.js';

// Safe Lua release script: deletes key ONLY if value equals ARGV[1] (prevents deleting someone else's lock if expired)
const LUA_SAFE_RELEASE = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

/**
 * Redis Lock Strategy:
 * Uses Redis distributed locking with atomic SET NX PX and Lua-safe deletion scripts.
 * Guarantees cluster-wide mutual exclusion across multiple serverless container instances,
 * then persists state directly into MongoDB.
 */
export class RedisLockStrategy implements ILockingStrategy {
  readonly name = 'redis-lock' as const;
  private redis: Redis;

  constructor(customRedis?: Redis) {
    this.redis = customRedis || getRedisClient();
  }

  private getLockKey(seatId: string): string {
    return `lock:seat:${seatId}`;
  }

  async lockSeat(
    eventId: string,
    seatId: string,
    userId: string,
    durationMs: number
  ): Promise<LockResult> {
    const lockKey = this.getLockKey(seatId);

    // 1. Attempt atomic SET NX PX in Redis
    const acquired = await this.redis.set(lockKey, userId, 'PX', durationMs, 'NX');
    if (acquired !== 'OK') {
      return {
        success: false,
        reason: 'Seat is currently locked by another user',
      };
    }

    try {
      // 2. Check MongoDB to ensure seat is not already permanently booked
      const seat = await Seat.findOne({ _id: seatId, eventId });
      if (!seat) {
        await this.releaseRedisLock(lockKey, userId);
        return { success: false, reason: 'Seat not found' };
      }

      if (seat.status === 'booked') {
        await this.releaseRedisLock(lockKey, userId);
        return { success: false, reason: 'Seat is already booked' };
      }

      // 3. Persist locked state to MongoDB
      seat.status = 'locked';
      seat.lockedBy = new mongoose.Types.ObjectId(userId);
      seat.lockedUntil = new Date(Date.now() + durationMs);
      seat.version += 1;
      await seat.save();

      return { success: true, seat };
    } catch (err: any) {
      await this.releaseRedisLock(lockKey, userId);
      return { success: false, reason: `Failed to persist lock: ${err.message}` };
    }
  }

  async releaseSeat(
    eventId: string,
    seatId: string,
    userId: string
  ): Promise<ReleaseResult> {
    const lockKey = this.getLockKey(seatId);

    // Lua-safe deletion ensures we only delete our own lock
    await this.releaseRedisLock(lockKey, userId);

    // Update MongoDB
    await Seat.findOneAndUpdate(
      {
        _id: seatId,
        eventId,
        status: 'locked',
        lockedBy: new mongoose.Types.ObjectId(userId),
      },
      {
        $set: {
          status: 'available',
          lockedBy: null,
          lockedUntil: null,
        },
        $inc: { version: 1 },
      }
    );

    return { success: true };
  }

  async bookSeat(
    eventId: string,
    seatId: string,
    userId: string,
    amount: number
  ): Promise<BookResult> {
    const lockKey = this.getLockKey(seatId);

    // Safely consume Redis lock via Lua script
    const lockReleased = await this.releaseRedisLock(lockKey, userId);
    if (lockReleased !== 1) {
      // Redis lock was not held by this user (or expired)
      return {
        success: false,
        reason: 'Seat lock expired or not held by user in Redis',
      };
    }

    const now = new Date();
    // Update Mongo seat document
    const updatedSeat = await Seat.findOneAndUpdate(
      {
        _id: seatId,
        eventId,
        status: { $ne: 'booked' },
      },
      {
        $set: {
          status: 'booked',
          bookedBy: new mongoose.Types.ObjectId(userId),
          bookedAt: now,
          lockedUntil: null,
        },
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!updatedSeat) {
      return {
        success: false,
        reason: 'Seat is already booked',
      };
    }

    try {
      const booking = await Booking.create({
        bookingRef: `BK-REDIS-${uuidv4().slice(0, 8).toUpperCase()}`,
        eventId,
        seatId,
        userId,
        amount,
        status: 'confirmed',
        strategyUsed: 'redis-lock',
      });

      return { success: true, booking, seat: updatedSeat };
    } catch (err: any) {
      return {
        success: false,
        reason: `Booking failed invariant check: ${err.message}`,
      };
    }
  }

  private async releaseRedisLock(key: string, value: string): Promise<number> {
    try {
      const result = await this.redis.eval(LUA_SAFE_RELEASE, 1, key, value);
      return Number(result);
    } catch {
      return 0;
    }
  }
}
