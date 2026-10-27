import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate, requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, requireAuth, authController.me);

export default router;
