import { Router, Request, Response } from 'express';
import { readSettings, writeSettings, AppSettings } from '../services/settings';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
	try {
		const settings = await readSettings();
		res.json(settings);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json({ error: message });
	}
});

router.put('/', async (req: Request, res: Response) => {
	try {
		const body = req.body as Partial<AppSettings>;
		const current = await readSettings();

		const updated: AppSettings = {
			...current,
		};

		if (typeof body.cacheTtlHours === 'number' && body.cacheTtlHours >= 0) {
			updated.cacheTtlHours = body.cacheTtlHours;
		}

		await writeSettings(updated);
		res.json(updated);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json({ error: message });
	}
});

export default router;
