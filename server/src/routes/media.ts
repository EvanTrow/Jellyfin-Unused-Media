import { Router, Request, Response } from 'express';
import { getAllMedia } from '../services/jellyfin';
import { getExcludedIds } from './excluded';
import { getRemovalMarkMap } from '../services/removalMarks';
import { readUnusedMediaOptions, writeUnusedMediaOptions } from '../services/unusedMediaOptions';
import { NoActivityWithinFilter, QueryOptions, UnusedMediaOptions } from '../types';

const router = Router();
const ACTIVITY_FILTERS = new Set<NoActivityWithinFilter>(['', '1m', '2m', '3m', '6m', '1y', '18m', 'never']);

function parseRequesters(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function parseNoActivityWithin(value: string | undefined): NoActivityWithinFilter {
	return ACTIVITY_FILTERS.has((value ?? '') as NoActivityWithinFilter) ? ((value ?? '') as NoActivityWithinFilter) : '';
}

function cutoffDate(filter: NoActivityWithinFilter): Date | null {
	if (!filter || filter === 'never') return null;
	const date = new Date();
	const months = filter === '1y' ? 12 : filter === '18m' ? 18 : Number(filter.replace('m', ''));
	date.setMonth(date.getMonth() - months);
	return date;
}

function passesActivityFilter(lastWatchedDate: string | null, filter: NoActivityWithinFilter): boolean {
	if (!filter) return true;
	if (filter === 'never') return !lastWatchedDate;
	if (!lastWatchedDate) return true;
	const watchedDate = new Date(lastWatchedDate);
	const cutoff = cutoffDate(filter);
	return cutoff ? watchedDate < cutoff : true;
}

router.get('/options', async (_req: Request, res: Response) => {
	try {
		res.json(await readUnusedMediaOptions());
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json({ error: message });
	}
});

router.put('/options', async (req: Request, res: Response) => {
	try {
		const options = await writeUnusedMediaOptions(req.body as UnusedMediaOptions);
		res.json(options);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json({ error: message });
	}
});

router.get('/requesters', async (_req: Request, res: Response) => {
	try {
		const items = await getAllMedia({ includeMovies: true, includeShows: true });
		const requesters = Array.from(new Set(items.map((item) => item.requestedBy).filter((value): value is string => !!value))).sort((a, b) => a.localeCompare(b));
		res.json(requesters);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json({ error: message });
	}
});

router.get('/', async (req: Request, res: Response) => {
	try {
		const { startDate, endDate, includeMovies = 'true', includeShows = 'true', noActivityWithin, excludeRequesters } = req.query as Record<string, string>;

		const options: QueryOptions = {
			startDate: startDate || undefined,
			endDate: endDate || undefined,
			includeMovies: includeMovies !== 'false',
			includeShows: includeShows !== 'false',
			noActivityWithin: parseNoActivityWithin(noActivityWithin),
			excludeRequesters: parseRequesters(excludeRequesters),
		};

		const items = await getAllMedia(options);

		// Excluded list can change without clearing cache, so filter here
		const [excludedIds, removalMarks] = await Promise.all([getExcludedIds(), getRemovalMarkMap()]);
		const excludedRequesters = new Set((options.excludeRequesters ?? []).map((name) => name.toLowerCase()));
		const filtered = items
			.filter((item) => !excludedIds.has(item.id))
			.filter((item) => passesActivityFilter(item.lastWatchedDate, options.noActivityWithin ?? ''))
			.filter((item) => !item.requestedBy || !excludedRequesters.has(item.requestedBy.toLowerCase()))
			.map((item) => {
				const markedForRemoval = removalMarks.get(item.id);
				return markedForRemoval ? { ...item, markedForRemoval } : item;
			});

		res.json({ items: filtered, totalCount: filtered.length });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		console.error('Error fetching media:', message);
		res.status(500).json({ error: `Failed to fetch media: ${message}` });
	}
});

export default router;
