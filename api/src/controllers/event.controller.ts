import { Request, Response, NextFunction } from 'express';
import { eventService } from '../services/event.service.js';

export class EventController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await eventService.getAllEvents();
      res.status(200).json({ success: true, data: events });
    } catch (err: any) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventService.getEventById(req.params.id);
      if (!event) {
        res.status(404).json({ success: false, error: 'Event not found' });
        return;
      }
      res.status(200).json({ success: true, data: event });
    } catch (err: any) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { title, description, venue, date, rows, cols, price } = req.body;
      if (!title || !venue || !date || !rows || !cols) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: title, venue, date, rows, cols',
        });
        return;
      }

      if (rows < 1 || cols < 1) {
        res.status(400).json({
          success: false,
          error: 'Rows and cols must be at least 1',
        });
        return;
      }

      const event = await eventService.createEvent({
        title,
        description,
        venue,
        date,
        rows: Number(rows),
        cols: Number(cols),
        price: price ? Number(price) : 50,
      });

      res.status(201).json({ success: true, data: event });
    } catch (err: any) {
      next(err);
    }
  }
}

export const eventController = new EventController();
