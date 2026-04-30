import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

/**
 * GET /api/proxy/image
 * Proxies Jellyfin item images through the backend so the client never
 * touches the Jellyfin server directly or sees the API key.
 *
 * Query params:
 *   itemId     — Jellyfin item ID (required)
 *   imageType  — Primary | Thumb | Backdrop | … (default: Primary)
 *   tag        — image tag for cache-busting (optional)
 *   maxWidth   — resize hint passed to Jellyfin (optional)
 */
router.get('/image', async (req: Request, res: Response) => {
	const { itemId, imageType = 'Primary', tag, maxWidth } = req.query as Record<string, string>;

	if (!itemId) {
		res.status(400).json({ error: 'itemId is required' });
		return;
	}

	const jellyfinUrl = process.env.JELLYFIN_URL || 'http://localhost:8096';
	const apiKey = process.env.JELLYFIN_API_KEY || '';

	const params: Record<string, string> = { api_key: apiKey };
	if (tag) params.tag = tag;
	if (maxWidth) params.maxWidth = maxWidth;

	try {
		const upstream = await axios.get(`${jellyfinUrl}/Items/${itemId}/Images/${imageType}`, {
			params,
			responseType: 'stream',
			timeout: 15000,
		});

		res.setHeader('Content-Type', String(upstream.headers['content-type'] || 'image/jpeg'));
		// Allow the browser to cache the image for 24 hours
		res.setHeader('Cache-Control', 'public, max-age=86400');
		if (upstream.headers['content-length']) {
			res.setHeader('Content-Length', String(upstream.headers['content-length']));
		}

		(upstream.data as NodeJS.ReadableStream).pipe(res);
	} catch (error: unknown) {
		if (axios.isAxiosError(error) && error.response?.status === 404) {
			res.status(404).end();
		} else {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.error('Image proxy error:', message);
			res.status(502).json({ error: 'Failed to fetch image from Jellyfin' });
		}
	}
});

export default router;
