import { Router, Request, Response } from 'express';
import { getNowPlaying } from '../services/jellyfin';

const router = Router();

router.get('/now-playing', async (_req: Request, res: Response) => {
	try {
		const sessions = await getNowPlaying();
		res.json(sessions);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json({ error: message });
	}
});

export default router;
