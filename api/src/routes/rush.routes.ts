import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:5000';

router.post('/start', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const workerRes = await fetch(`${WORKER_URL}/start-rush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await workerRes.json();
    res.status(workerRes.status).json(data);
  } catch (err: any) {
    res.status(502).json({
      success: false,
      error: `Rush worker unreachable at ${WORKER_URL}: ${err.message}`,
    });
  }
});

router.post('/stop', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const workerRes = await fetch(`${WORKER_URL}/stop-rush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await workerRes.json();
    res.status(workerRes.status).json(data);
  } catch (err: any) {
    res.status(502).json({
      success: false,
      error: `Rush worker unreachable at ${WORKER_URL}: ${err.message}`,
    });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const workerRes = await fetch(`${WORKER_URL}/rush-status`);
    const data = await workerRes.json();
    res.status(workerRes.status).json(data);
  } catch (err: any) {
    res.status(502).json({
      success: false,
      error: `Rush worker unreachable at ${WORKER_URL}: ${err.message}`,
    });
  }
});

export default router;
