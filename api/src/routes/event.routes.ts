import { Router } from 'express';
import { eventController } from '../controllers/event.controller.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', eventController.getAll);
router.get('/:id', eventController.getById);
router.post('/', authenticate, requireAdmin, eventController.create);

export default router;
