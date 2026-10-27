import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom Prometheus/k6 metrics
const successfulLocks = new Counter('successful_locks');
const successfulBookings = new Counter('successful_bookings');
const seatConflicts = new Counter('seat_conflicts_409');
const lockDuration = new Trend('seat_lock_duration_ms');

const TARGET_URL = __ENV.TARGET_URL || 'http://localhost:4000';
const LOCK_STRATEGY = __ENV.LOCK_STRATEGY || 'mongo-atomic'; // 'naive' | 'mongo-atomic' | 'redis-lock'

export const options = {
  scenarios: {
    ticket_sale_rush: {
      executor: 'ramping-vus',
      startVUs: 20,
      stages: [
        { duration: '5s', target: 100 }, // Rapid burst ramp-up
        { duration: '20s', target: 250 }, // Heavy contention plateau
        { duration: '5s', target: 0 },   // Cool-down
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.60'], // High 409 conflict rate expected under heavy contention
    http_req_duration: ['p(95)<800'], // 95% of requests should complete under 800ms
  },
};

export default function () {
  const simulatedUserId = `k6_vu_${__VU}_${__ITER}`;

  // 1. Fetch active events
  const eventsRes = http.get(`${TARGET_URL}/api/events`);
  check(eventsRes, { 'events fetched': (r) => r.status === 200 });

  let eventId;
  try {
    const events = JSON.parse(eventsRes.body).data;
    if (events && events.length > 0) {
      eventId = events[0]._id;
    }
  } catch (e) {
    return;
  }

  if (!eventId) return;

  // 2. Fetch seats for the event
  const seatsRes = http.get(`${TARGET_URL}/api/events/${eventId}/seats`);
  check(seatsRes, { 'seats fetched': (r) => r.status === 200 });

  let seats = [];
  try {
    seats = JSON.parse(seatsRes.body).data;
  } catch (e) {
    return;
  }

  if (!seats || seats.length === 0) return;

  // 3. Pick a candidate seat (skewed towards contention)
  const targetSeat = seats[Math.floor(Math.random() * seats.length)];

  // 4. Fire lock request
  const lockHeaders = {
    'Content-Type': 'application/json',
    'x-simulated-user-id': simulatedUserId,
    'x-lock-strategy': LOCK_STRATEGY,
  };

  const lockPayload = JSON.stringify({ strategy: LOCK_STRATEGY });
  const startLock = Date.now();

  const lockRes = http.post(
    `${TARGET_URL}/api/events/${eventId}/seats/${targetSeat._id}/lock`,
    lockPayload,
    { headers: lockHeaders }
  );

  lockDuration.add(Date.now() - startLock);

  if (lockRes.status === 200) {
    successfulLocks.add(1);

    // Simulated human decision / payment entry time (100ms - 300ms)
    sleep(0.15);

    // 5. Confirm booking
    const bookRes = http.post(
      `${TARGET_URL}/api/events/${eventId}/seats/${targetSeat._id}/book`,
      lockPayload,
      { headers: lockHeaders }
    );

    if (bookRes.status === 200 || bookRes.status === 201) {
      successfulBookings.add(1);
    }
  } else if (lockRes.status === 409) {
    seatConflicts.add(1);
  }

  // Jitter before next attempt
  sleep(0.1);
}
