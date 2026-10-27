import bcrypt from 'bcryptjs';
import { connectMongo, disconnectMongo } from './db/mongo.js';
import { User } from './models/User.js';
import { Event } from './models/Event.js';
import { Seat } from './models/Seat.js';
import { Booking } from './models/Booking.js';
import { eventService } from './services/event.service.js';

async function seed() {
  console.log('[Seed] Connecting to MongoDB...');
  await connectMongo();

  console.log('[Seed] Clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    Event.deleteMany({}),
    Seat.deleteMany({}),
    Booking.deleteMany({}),
  ]);

  console.log('[Seed] Creating demo users...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('AtomicPass2026!', salt);

  const adminUser = await User.create({
    email: 'admin@atomicseat.dev',
    passwordHash,
    name: 'Atomic Admin',
    role: 'admin',
  });

  const demoUser = await User.create({
    email: 'user@atomicseat.dev',
    passwordHash,
    name: 'Demo Ticket Buyer',
    role: 'user',
  });

  console.log(`[Seed] Created Admin: ${adminUser.email} (Password: AtomicPass2026!)`);
  console.log(`[Seed] Created User: ${demoUser.email} (Password: AtomicPass2026!)`);

  console.log('[Seed] Creating sample events with seat grids...');

  // Event 1: Neon Nights Arena
  const event1 = await eventService.createEvent({
    title: 'Neon Nights Arena Concert',
    description: 'An electrifying live electronic symphony with laser visual installations.',
    venue: 'Cyberdome Arena, Sector 7',
    date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // in 14 days
    rows: 8,
    cols: 10,
    price: 120,
  });

  // Event 2: DevCon Global Keynote
  const event2 = await eventService.createEvent({
    title: 'DevCon Global Keynote 2026',
    description: 'The premier distributed systems and serverless container architecture conference.',
    venue: 'Metropolis Innovation Center',
    date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // in 30 days
    rows: 10,
    cols: 12,
    price: 250,
  });

  // Event 3: Cyber Symphony Hall
  const event3 = await eventService.createEvent({
    title: 'Cyber Symphony: Synthetic Echoes',
    description: 'Acoustic orchestra meets neural audio synthesis in an immersive spatial audio hall.',
    venue: 'Neo-Tokyo Philharmonic Auditorium',
    date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // in 45 days
    rows: 6,
    cols: 8,
    price: 85,
  });

  console.log(`[Seed] Event 1 created: "${event1.title}" (${event1.totalSeats} seats)`);
  console.log(`[Seed] Event 2 created: "${event2.title}" (${event2.totalSeats} seats)`);
  console.log(`[Seed] Event 3 created: "${event3.title}" (${event3.totalSeats} seats)`);

  // Pre-book a couple of seats in Event 1 to illustrate real-world map states
  const sampleSeats = await Seat.find({ eventId: event1._id }).limit(3);
  if (sampleSeats.length >= 2) {
    // Book seat 1
    sampleSeats[0].status = 'booked';
    sampleSeats[0].bookedBy = demoUser._id;
    sampleSeats[0].bookedAt = new Date();
    await sampleSeats[0].save();

    await Booking.create({
      bookingRef: 'BK-SEED-001',
      eventId: event1._id,
      seatId: sampleSeats[0]._id,
      userId: demoUser._id,
      amount: event1.price,
      status: 'confirmed',
      strategyUsed: 'mongo-atomic',
    });

    // Lock seat 2 for 5 minutes
    sampleSeats[1].status = 'locked';
    sampleSeats[1].lockedBy = demoUser._id;
    sampleSeats[1].lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
    await sampleSeats[1].save();

    console.log('[Seed] Sample pre-booked & pre-locked seats initialized for Event 1.');
  }

  console.log('[Seed] Database successfully seeded with 3 events, seat grids, and initial users.');
  await disconnectMongo();
}

seed().catch((err) => {
  console.error('[Seed] Error seeding database:', err);
  process.exit(1);
});
