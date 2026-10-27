import { Event, IEvent } from '../models/Event.js';
import { Seat } from '../models/Seat.js';

export interface CreateEventDTO {
  title: string;
  description?: string;
  venue: string;
  date: Date | string;
  rows: number;
  cols: number;
  price?: number;
}

export class EventService {
  async getAllEvents() {
    return Event.find().sort({ date: 1 }).lean();
  }

  async getEventById(id: string) {
    return Event.findById(id).lean();
  }

  async createEvent(data: CreateEventDTO) {
    const totalSeats = data.rows * data.cols;
    const event = await Event.create({
      title: data.title,
      description: data.description || '',
      venue: data.venue,
      date: new Date(data.date),
      rows: data.rows,
      cols: data.cols,
      totalSeats,
      price: data.price || 50,
    });

    // Auto-generate seats grid
    const seatDocs = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    for (let r = 0; r < data.rows; r++) {
      const rowLetter = r < 26 ? alphabet[r] : `R${r + 1}`;
      for (let c = 1; c <= data.cols; c++) {
        seatDocs.push({
          eventId: event._id,
          row: rowLetter,
          col: c,
          seatNumber: `${rowLetter}-${c}`,
          status: 'available',
          lockedBy: null,
          lockedUntil: null,
          bookedBy: null,
          bookedAt: null,
          version: 0,
        });
      }
    }

    if (seatDocs.length > 0) {
      await Seat.insertMany(seatDocs);
    }

    return event;
  }
}

export const eventService = new EventService();
