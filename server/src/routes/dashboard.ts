import { Router, Request, Response } from 'express';
import { getDashboardStats } from '../services/jellyfin';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
	try {
		const stats = await getDashboardStats();
		res.json(stats);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		console.error('Error fetching dashboard stats:', message);
		res.status(500).json({ error: `Failed to fetch dashboard stats: ${message}` });
	}
});

export default router;
