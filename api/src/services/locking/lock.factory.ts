import { config, LockStrategyType } from '../../config/index.js';
import { ILockingStrategy } from './strategy.interface.js';
import { NaiveStrategy } from './naive.strategy.js';
import { MongoAtomicStrategy } from './mongo-atomic.strategy.js';
import { RedisLockStrategy } from './redis-lock.strategy.js';
import { Redis } from 'ioredis';

export class LockStrategyFactory {
  private static naiveInstance = new NaiveStrategy();
  private static mongoInstance = new MongoAtomicStrategy();
  private static redisInstance: RedisLockStrategy | null = null;

  static getStrategy(name?: string, customRedis?: Redis): ILockingStrategy {
    const selected = (name || config.lockStrategy || 'mongo-atomic').toLowerCase();

    switch (selected) {
      case 'naive':
        return this.naiveInstance;
      case 'redis-lock':
        if (!this.redisInstance || customRedis) {
          this.redisInstance = new RedisLockStrategy(customRedis);
        }
        return this.redisInstance;
      case 'mongo-atomic':
      default:
        return this.mongoInstance;
    }
  }

  static getAvailableStrategies(): LockStrategyType[] {
    return ['naive', 'mongo-atomic', 'redis-lock'];
  }
}
