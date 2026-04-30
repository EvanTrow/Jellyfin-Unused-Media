import { Router, Request, Response } from 'express';
import { getDashboardStats, getLibraryGrowth } from '../services/jellyfin';

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

router.get('/library-growth', async (_req: Request, res: Response) => {
	try {
		const data = await getLibraryGrowth();
		res.json(data);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		console.error('Error fetching library growth:', message);
		res.status(500).json({ error: `Failed to fetch library growth: ${message}` });
	}
});

export default router;
