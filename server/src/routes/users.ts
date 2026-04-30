import { Router, Request, Response } from 'express';
import { getUsers } from '../services/jellyfin';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
	try {
		const users = await getUsers();
		res.json(users.map((u) => ({ id: u.Id, name: u.Name })));
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json({ error: `Failed to fetch users: ${message}` });
	}
});

export default router;
