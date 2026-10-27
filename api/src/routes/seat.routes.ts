import { Router } from 'express';
import { seatController } from '../controllers/seat.controller.js';
import { bookingController } from '../controllers/booking.controller.js';
import { authenticate, requireAuth } from '../middlewares/auth.middleware.js';

const router = Router({ mergeParams: true });

router.get('/', seatController.getSeats);
router.post('/:seatId/lock', authenticate, requireAuth, seatController.lockSeat);
router.post('/:seatId/release', authenticate, requireAuth, seatController.releaseSeat);
router.post('/:seatId/book', authenticate, requireAuth, bookingController.bookSeat);

export default router;
