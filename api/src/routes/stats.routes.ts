import { Router } from 'express';
import { statsController } from '../controllers/stats.controller.js';

const router = Router();

router.get('/', statsController.getStats);
router.post('/reset', statsController.resetEventState);

export default router;
