import { Router, Request, Response } from 'express';
import { getWatchHistory } from '../services/jellyfin';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
	try {
		const { offset = '0', limit = '50', users } = req.query as Record<string, string>;

		const allItems = await getWatchHistory();

		// Filter by requested user IDs (comma-separated)
		const userFilter = users ? users.split(',').filter(Boolean) : [];
		const filtered = userFilter.length > 0 ? allItems.filter((item) => userFilter.includes(item.userId)) : allItems;

		const offsetNum = Math.max(0, parseInt(offset, 10) || 0);
		const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

		const page = filtered.slice(offsetNum, offsetNum + limitNum);

		res.json({
			items: page,
			totalCount: filtered.length,
			hasMore: offsetNum + limitNum < filtered.length,
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		console.error('Error fetching watch history:', message);
		res.status(500).json({ error: `Failed to fetch watch history: ${message}` });
	}
});

export default router;
