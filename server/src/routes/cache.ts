import { Router, Request, Response } from 'express';
import { diskClear, diskStats } from '../services/diskCache';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const stats = await diskStats();
    res.json({ reports: stats });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/cache — clear everything
router.delete('/', async (_req: Request, res: Response) => {
  try {
    await diskClear();
    res.json({ message: 'Cache cleared' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/cache/:report — clear a specific report (e.g. "media" or "dashboard")
router.delete('/:report', async (req: Request, res: Response) => {
  try {
    await diskClear(req.params.report);
    res.json({ message: `Cache cleared for report: ${req.params.report}` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
