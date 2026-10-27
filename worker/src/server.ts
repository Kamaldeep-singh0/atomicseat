import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { rushEngine } from './rush-engine.js';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'atomic-seat-rush-worker',
    targetApiUrl: config.targetApiUrl,
    maxRushUsers: config.maxRushUsers,
    timestamp: new Date().toISOString(),
  });
});

app.post('/start-rush', async (req: Request, res: Response) => {
  const { targetUrl, eventId, strategy, virtualUsers, durationSeconds } = req.body;

  if (!eventId) {
    res.status(400).json({ success: false, error: 'eventId is required' });
    return;
  }

  const result = await rushEngine.startRush({
    targetUrl: targetUrl || config.targetApiUrl,
    eventId,
    strategy: strategy || 'mongo-atomic',
    virtualUsers: virtualUsers || 100,
    durationSeconds: durationSeconds || config.defaultDurationSeconds,
  });

  if (!result.success) {
    res.status(409).json(result);
    return;
  }

  res.status(200).json(result);
});

app.post('/stop-rush', (req: Request, res: Response) => {
  const result = rushEngine.stopRush();
  res.status(200).json(result);
});

app.get('/rush-status', (req: Request, res: Response) => {
  const status = rushEngine.getStatus();
  res.status(200).json({ success: true, data: status });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`[Rush Worker] Ready and listening on http://0.0.0.0:${config.port}`);
  console.log(`[Rush Worker] Target API: ${config.targetApiUrl}`);
});
