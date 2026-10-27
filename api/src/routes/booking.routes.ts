import { Router } from 'express';
import { bookingController } from '../controllers/booking.controller.js';
import { authenticate, requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/my', authenticate, requireAuth, bookingController.getMyBookings);
router.get('/event/:eventId', authenticate, requireAdmin, bookingController.getEventBookings);

export default router;
