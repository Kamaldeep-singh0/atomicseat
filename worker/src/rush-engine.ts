import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';

export interface RushOptions {
  targetUrl?: string;
  eventId: string;
  strategy: 'naive' | 'mongo-atomic' | 'redis-lock';
  virtualUsers: number;
  durationSeconds?: number;
}

export interface MetricPoint {
  timestamp: number;
  second: number;
  reqsThisSec: number;
  successfulLocks: number;
  conflicts: number;
  doubleBookings: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  activeInstances: number;
}

export interface RushSummary {
  runId: string;
  eventId: string;
  strategy: string;
  virtualUsers: number;
  durationSeconds: number;
  totalAttempts: number;
  successfulLocks: number;
  successfulBookings: number;
  conflicts: number;
  errors: number;
  doubleBookingsDetected: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  avgLatencyMs: number;
  peakInstances: number;
  startedAt: number;
  finishedAt: number;
}

export class RushEngine {
  private isRunning = false;
  private shouldStop = false;
  private currentRunId: string | null = null;
  private currentSummary: RushSummary | null = null;
  private history: RushSummary[] = [];

  // Live in-flight metrics
  private timeSeries: MetricPoint[] = [];
  private latenciesBuffer: number[] = [];
  private totalAttempts = 0;
  private successfulLocks = 0;
  private successfulBookings = 0;
  private conflicts = 0;
  private errors = 0;
  private peakInstances = 1;
  private activeInstances = 1;
  private doubleBookingsDetected = 0;
  private startedAt = 0;
  private targetApiUrl = '';
  private currentEventId = '';
  private currentStrategy = 'mongo-atomic';
  private currentVirtualUsers = 100;
  private durationSeconds = 30;

  async startRush(options: RushOptions): Promise<{ success: boolean; runId?: string; message?: string }> {
    if (this.isRunning) {
      return { success: false, message: 'A rush simulation is already running.' };
    }

    // Safety caps
    const users = Math.min(
      Math.max(50, options.virtualUsers || 100),
      config.maxRushUsers
    );
    const duration = Math.min(
      Math.max(10, options.durationSeconds || config.defaultDurationSeconds),
      60
    );

    this.isRunning = true;
    this.shouldStop = false;
    this.currentRunId = `run_${Date.now()}_${uuidv4().slice(0, 6)}`;
    this.targetApiUrl = (options.targetUrl || config.targetApiUrl).replace(/\/$/, '');
    this.currentEventId = options.eventId;
    this.currentStrategy = options.strategy || 'mongo-atomic';
    this.currentVirtualUsers = users;
    this.durationSeconds = duration;
    this.startedAt = Date.now();

    // Reset counters
    this.timeSeries = [];
    this.latenciesBuffer = [];
    this.totalAttempts = 0;
    this.successfulLocks = 0;
    this.successfulBookings = 0;
    this.conflicts = 0;
    this.errors = 0;
    this.peakInstances = 1;
    this.activeInstances = 1;
    this.doubleBookingsDetected = 0;

    // Launch worker loop in the background
    this.executeRushLoop().catch((err) => {
      console.error('[RushEngine] Fatal error in rush execution:', err);
      this.isRunning = false;
    });

    return { success: true, runId: this.currentRunId };
  }

  stopRush(): { success: boolean; message: string } {
    if (!this.isRunning) {
      return { success: false, message: 'No rush is currently running.' };
    }
    this.shouldStop = true;
    return { success: true, message: 'Rush stopping signal dispatched.' };
  }

  getStatus() {
    const elapsed = this.startedAt > 0 ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;
    const sorted = [...this.latenciesBuffer].sort((a, b) => a - b);
    const p50 = this.calculatePercentile(sorted, 50);
    const p95 = this.calculatePercentile(sorted, 95);

    return {
      isRunning: this.isRunning,
      runId: this.currentRunId,
      strategy: this.currentStrategy,
      virtualUsers: this.currentVirtualUsers,
      durationSeconds: this.durationSeconds,
      elapsedSeconds: elapsed,
      totalAttempts: this.totalAttempts,
      successfulLocks: this.successfulLocks,
      successfulBookings: this.successfulBookings,
      conflicts: this.conflicts,
      errors: this.errors,
      doubleBookingsDetected: this.doubleBookingsDetected,
      activeInstances: this.activeInstances,
      peakInstances: this.peakInstances,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      latestMetrics: this.timeSeries.slice(-30),
      currentSummary: this.currentSummary,
      history: this.history,
    };
  }

  private async executeRushLoop(): Promise<void> {
    console.log(
      `[RushEngine] Starting rush: ${this.currentRunId} | ${this.currentVirtualUsers} users | ${this.durationSeconds}s | Strategy: ${this.currentStrategy}`
    );

    // 1. Fetch event seats once to seed candidate seats
    let seatIds: string[] = [];
    try {
      const res = await fetch(`${this.targetApiUrl}/api/events/${this.currentEventId}/seats`);
      const json: any = await res.json();
      if (json.success && Array.isArray(json.data)) {
        seatIds = json.data.map((s: any) => s._id);
      }
    } catch (e: any) {
      console.warn(`[RushEngine] Could not pre-fetch seats: ${e.message}`);
    }

    if (seatIds.length === 0) {
      this.isRunning = false;
      return;
    }

    const endTime = this.startedAt + this.durationSeconds * 1000;
    let secondCounter = 0;
    let reqsInCurrentSecond = 0;

    // Heartbeat & Metrics polling ticker every 1 second
    const ticker = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(ticker);
        return;
      }

      secondCounter++;
      // Poll active instances and double-bookings from target API
      try {
        const statsRes = await fetch(`${this.targetApiUrl}/api/stats`);
        const statsJson: any = await statsRes.json();
        if (statsJson.success && statsJson.data) {
          this.activeInstances = statsJson.data.activeInstances || 1;
          this.doubleBookingsDetected = statsJson.data.doubleBookingsDetected || 0;
          if (this.activeInstances > this.peakInstances) {
            this.peakInstances = this.activeInstances;
          }
        }
      } catch {}

      const sorted = [...this.latenciesBuffer].sort((a, b) => a - b);
      const p50 = this.calculatePercentile(sorted, 50);
      const p95 = this.calculatePercentile(sorted, 95);

      this.timeSeries.push({
        timestamp: Date.now(),
        second: secondCounter,
        reqsThisSec: reqsInCurrentSecond,
        successfulLocks: this.successfulLocks,
        conflicts: this.conflicts,
        doubleBookings: this.doubleBookingsDetected,
        p50LatencyMs: p50,
        p95LatencyMs: p95,
        activeInstances: this.activeInstances,
      });

      reqsInCurrentSecond = 0;
    }, 1000);

    // 2. Spawn concurrent virtual user worker tasks
    const userWorkers = Array.from({ length: this.currentVirtualUsers }, async (_, index) => {
      const simUserId = `rush_user_${this.currentRunId}_${index}`;

      while (Date.now() < endTime && !this.shouldStop) {
        // Random jitter delay between 80ms and 350ms to create genuine Poisson-like serverless burst traffic
        const jitter = Math.floor(Math.random() * 270) + 80;
        await new Promise((r) => setTimeout(r, jitter));

        if (Date.now() >= endTime || this.shouldStop) break;

        // Pick a seat (skewed towards contention by picking from common subsets)
        const seatIndex = Math.floor(Math.random() * seatIds.length);
        const seatId = seatIds[seatIndex];

        const reqStart = Date.now();
        this.totalAttempts++;
        reqsInCurrentSecond++;

        try {
          // Attempt lock
          const lockRes = await fetch(
            `${this.targetApiUrl}/api/events/${this.currentEventId}/seats/${seatId}/lock`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-simulated-user-id': simUserId,
                'x-lock-strategy': this.currentStrategy,
              },
              body: JSON.stringify({ strategy: this.currentStrategy }),
            }
          );

          const latency = Date.now() - reqStart;
          this.latenciesBuffer.push(latency);

          if (lockRes.status === 200) {
            this.successfulLocks++;

            // Simulated human payment delay (50ms - 150ms)
            await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 100) + 50));

            // Attempt book
            const bookRes = await fetch(
              `${this.targetApiUrl}/api/events/${this.currentEventId}/seats/${seatId}/book`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-simulated-user-id': simUserId,
                  'x-lock-strategy': this.currentStrategy,
                },
                body: JSON.stringify({ strategy: this.currentStrategy }),
              }
            );

            if (bookRes.status === 200 || bookRes.status === 201) {
              this.successfulBookings++;
            }
          } else if (lockRes.status === 409) {
            this.conflicts++;
          } else {
            this.errors++;
          }
        } catch {
          this.errors++;
        }
      }
    });

    // Await completion of all virtual users
    await Promise.all(userWorkers);
    clearInterval(ticker);

    // Final poll of stats
    try {
      const statsRes = await fetch(`${this.targetApiUrl}/api/stats`);
      const statsJson: any = await statsRes.json();
      if (statsJson.success && statsJson.data) {
        this.doubleBookingsDetected = statsJson.data.doubleBookingsDetected || 0;
      }
    } catch {}

    const finishedAt = Date.now();
    const sorted = [...this.latenciesBuffer].sort((a, b) => a - b);
    const p50 = this.calculatePercentile(sorted, 50);
    const p95 = this.calculatePercentile(sorted, 95);
    const avg =
      this.latenciesBuffer.length > 0
        ? Math.round(this.latenciesBuffer.reduce((a, b) => a + b, 0) / this.latenciesBuffer.length)
        : 0;

    this.currentSummary = {
      runId: this.currentRunId!,
      eventId: this.currentEventId,
      strategy: this.currentStrategy,
      virtualUsers: this.currentVirtualUsers,
      durationSeconds: Math.round((finishedAt - this.startedAt) / 1000),
      totalAttempts: this.totalAttempts,
      successfulLocks: this.successfulLocks,
      successfulBookings: this.successfulBookings,
      conflicts: this.conflicts,
      errors: this.errors,
      doubleBookingsDetected: this.doubleBookingsDetected,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      avgLatencyMs: avg,
      peakInstances: this.peakInstances,
      startedAt: this.startedAt,
      finishedAt,
    };

    this.history.unshift(this.currentSummary);
    this.isRunning = false;

    console.log(
      `[RushEngine] Rush finished: ${this.currentRunId} | Total: ${this.totalAttempts} | Bookings: ${this.successfulBookings} | Conflicts: ${this.conflicts} | Double Bookings: ${this.doubleBookingsDetected} | Peak Instances: ${this.peakInstances}`
    );
  }

  private calculatePercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }
}

export const rushEngine = new RushEngine();
