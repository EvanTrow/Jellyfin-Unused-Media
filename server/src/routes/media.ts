import { Router, Request, Response } from 'express';
import { getAllMedia } from '../services/jellyfin';
import { getExcludedIds } from './excluded';
import { QueryOptions } from '../types';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
try {
const { startDate, endDate, includeMovies = 'true', includeShows = 'true' } = req.query as Record<string, string>;

const options: QueryOptions = {
startDate: startDate || undefined,
endDate: endDate || undefined,
includeMovies: includeMovies !== 'false',
includeShows: includeShows !== 'false',
};

let items = await getAllMedia(options);

// Filter out excluded items
const excludedIds = await getExcludedIds();
items = items.filter((item) => !excludedIds.has(item.id));

res.json({ items, totalCount: items.length });
} catch (error: unknown) {
const message = error instanceof Error ? error.message : 'Unknown error';
console.error('Error fetching media:', message);
res.status(500).json({ error: `Failed to fetch media: ${message}` });
}
});

export default router;
