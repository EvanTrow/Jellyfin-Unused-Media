import axios from 'axios';

interface OverseerrUser {
	username?: string;
	plexUsername?: string;
	email: string;
	displayName?: string;
}

interface OverseerrMediaInfo {
	tmdbId: number;
	tvdbId?: number | null;
}

interface OverseerrRequest {
	media: OverseerrMediaInfo;
	requestedBy: OverseerrUser;
	createdAt: string;
}

interface OverseerrResponse {
	pageInfo: {
		page: number;
		pages: number;
		results: number;
	};
	results: OverseerrRequest[];
}

function displayName(user: OverseerrUser): string {
	return user.displayName || user.username || user.plexUsername || user.email;
}

/**
 * Fetches all approved/available requests from Overseerr and returns
 * a map of tmdbId → requester display name (earliest request wins).
 * Returns null if Overseerr is not configured.
 */
export async function getOverseerrRequests(): Promise<Map<number, string> | null> {
	const baseURL = process.env.OVERSEERR_URL;
	const apiKey = process.env.OVERSEERR_API_KEY;

	if (!baseURL || !apiKey) return null;

	const client = axios.create({
		baseURL: baseURL.replace(/\/$/, '') + '/api/v1',
		headers: { 'X-Api-Key': apiKey },
		timeout: 30000,
	});

	// Map: tmdbId → earliest requester name
	const requestMap = new Map<number, string>();
	const take = 100;
	let skip = 0;
	let totalPages = 1;

	while (skip / take < totalPages) {
		const response = await client.get<OverseerrResponse>('/request', {
			params: { take, skip, filter: 'all', sort: 'added' },
		});

		const { pageInfo, results } = response.data;
		totalPages = pageInfo.pages;

		for (const req of results) {
			const tmdbId = req.media?.tmdbId;
			if (tmdbId != null && !requestMap.has(tmdbId)) {
				requestMap.set(tmdbId, displayName(req.requestedBy));
			}
		}

		skip += take;
		if (results.length === 0) break;
	}

	return requestMap;
}
