import axios, { AxiosInstance } from 'axios';
import fs from 'fs/promises';
import path from 'path';
import {
	JellyfinUser,
	JellyfinItem,
	JellyfinQueryResult,
	JellyfinVirtualFolder,
	JellyfinSession,
	MediaItem,
	PlayRecord,
	QueryOptions,
	DashboardStats,
	LibraryStats,
	LibraryGrowthPoint,
	NowPlayingSession,
	WatchHistoryItem,
	PlaybackReportingQueryResult,
} from '../types';
import { getOverseerrRequests } from './overseerr';
import { diskGet, diskSet, diskGetBatch } from './diskCache';

const REPORT_MEDIA = 'media';
const REPORT_DASHBOARD = 'dashboard';
const REPORT_LIBRARY_GROWTH = 'library-growth';

function createJellyfinClient(): AxiosInstance {
	const baseURL = process.env.JELLYFIN_URL || 'http://localhost:8096';
	const apiKey = process.env.JELLYFIN_API_KEY || '';
	return axios.create({
		baseURL,
		headers: {
			Authorization: `MediaBrowser Token="${apiKey}"`,
			'Content-Type': 'application/json',
		},
		timeout: 30000,
	});
}

async function fetchAllItems(client: AxiosInstance, endpoint: string, params: Record<string, unknown>): Promise<JellyfinItem[]> {
	const allItems: JellyfinItem[] = [];
	let startIndex = 0;
	const limit = 500;
	while (true) {
		const response = await client.get<JellyfinQueryResult>(endpoint, {
			params: { ...params, startIndex, limit },
		});
		const items = response.data.Items || [];
		allItems.push(...items);
		if (items.length === 0 || allItems.length >= response.data.TotalRecordCount) break;
		startIndex += limit;
	}
	return allItems;
}

async function fetchCount(client: AxiosInstance, params: Record<string, unknown>): Promise<number> {
	const response = await client.get<JellyfinQueryResult>('/Items', {
		params: { ...params, limit: 0, enableTotalRecordCount: true },
	});
	return response.data.TotalRecordCount ?? 0;
}

function mergePlayRecord(map: Map<string, PlayRecord>, itemId: string, userName: string, lastPlayedDate: string | undefined): void {
	if (!lastPlayedDate) return;
	const existing = map.get(itemId);
	if (!existing || lastPlayedDate > existing.date) {
		map.set(itemId, { userName, date: lastPlayedDate });
	}
}

export async function getUsers(): Promise<JellyfinUser[]> {
	const client = createJellyfinClient();
	const response = await client.get<JellyfinUser[]>('/Users');
	return response.data;
}

// ---------------------------------------------------------------------------
// Dashboard — hybrid: cache per library ID, always fetch fresh library list
// ---------------------------------------------------------------------------
export async function getDashboardStats(): Promise<DashboardStats> {
	const client = createJellyfinClient();

	const foldersResponse = await client.get<JellyfinVirtualFolder[]>('/Library/VirtualFolders');
	const folders = foldersResponse.data ?? [];

	const cachedLibs = await diskGetBatch<LibraryStats>(
		REPORT_DASHBOARD,
		folders.map((f) => f.ItemId),
	);

	const libraries: LibraryStats[] = await Promise.all(
		folders.map(async (folder): Promise<LibraryStats> => {
			// Return cached stats if we have them
			const cached = cachedLibs.get(folder.ItemId);
			if (cached) {
				console.log(`[cache] dashboard hit: ${folder.Name}`);
				return cached;
			}

			console.log(`[cache] dashboard miss: ${folder.Name} — fetching from Jellyfin`);
			const parentId = folder.ItemId;
			const base = { recursive: true, parentId, enableTotalRecordCount: true };
			const ct = (folder.CollectionType ?? '').toLowerCase();

			const [movies, series, seasons, episodes] = await Promise.all([
				ct === 'movies' || ct === 'mixed' ? fetchCount(client, { ...base, includeItemTypes: 'Movie' }) : Promise.resolve(0),
				ct === 'tvshows' || ct === 'mixed' ? fetchCount(client, { ...base, includeItemTypes: 'Series' }) : Promise.resolve(0),
				ct === 'tvshows' || ct === 'mixed' ? fetchCount(client, { ...base, includeItemTypes: 'Season' }) : Promise.resolve(0),
				ct === 'tvshows' || ct === 'mixed' ? fetchCount(client, { ...base, includeItemTypes: 'Episode' }) : Promise.resolve(0),
			]);

			const stats: LibraryStats = {
				id: parentId,
				name: folder.Name,
				collectionType: folder.CollectionType ?? '',
				movies,
				series,
				seasons,
				episodes,
			};

			await diskSet(REPORT_DASHBOARD, folder.ItemId, stats);
			return stats;
		}),
	);

	const totals = libraries.reduce(
		(acc, lib) => ({
			movies: acc.movies + lib.movies,
			series: acc.series + lib.series,
			seasons: acc.seasons + lib.seasons,
			episodes: acc.episodes + lib.episodes,
		}),
		{ movies: 0, series: 0, seasons: 0, episodes: 0 },
	);

	return { libraries, totals };
}

// ---------------------------------------------------------------------------
// Media — hybrid: cache per Jellyfin item ID, enrich only uncached items
// ---------------------------------------------------------------------------
export async function getAllMedia(options: QueryOptions): Promise<MediaItem[]> {
	const { startDate, endDate, includeMovies, includeShows } = options;
	const client = createJellyfinClient();

	const commonFields = 'DateCreated,Overview,Genres,ProductionYear,RunTimeTicks,ImageTags,ProviderIds';

	// 1. Fetch fresh item lists from Jellyfin (lightweight — no play history yet)
	const [rawMovies, rawSeries] = await Promise.all([
		includeMovies
			? fetchAllItems(client, '/Items', { recursive: true, includeItemTypes: 'Movie', fields: commonFields, sortBy: 'SortName', sortOrder: 'Ascending' })
			: Promise.resolve<JellyfinItem[]>([]),
		includeShows
			? fetchAllItems(client, '/Items', { recursive: true, includeItemTypes: 'Series', fields: commonFields, sortBy: 'SortName', sortOrder: 'Ascending' })
			: Promise.resolve<JellyfinItem[]>([]),
	]);

	// 2. Apply date filter on raw Jellyfin items
	const filteredMovies = rawMovies.filter((m) => passesDateFilter(m.DateCreated, startDate, endDate));
	const filteredSeries = rawSeries.filter((s) => passesDateFilter(s.DateCreated, startDate, endDate));
	const allFiltered = [...filteredMovies, ...filteredSeries];

	if (allFiltered.length === 0) return [];

	// 3. Check disk cache — read all at once
	const allIds = allFiltered.map((i) => i.Id);
	const cached = await diskGetBatch<MediaItem>(REPORT_MEDIA, allIds);

	// Migrate any cached items that still carry a direct Jellyfin imageUrl
	for (const [id, item] of cached) {
		const migrated = migrateImageUrl(item);
		if (migrated !== item) {
			cached.set(id, migrated);
			// Persist the migrated URL so we don't do this on every request
			diskSet(REPORT_MEDIA, id, migrated).catch(() => {});
		}
	}

	const uncachedMovies = filteredMovies.filter((m) => !cached.has(m.Id));
	const uncachedSeries = filteredSeries.filter((s) => !cached.has(s.Id));
	const hasUncached = uncachedMovies.length > 0 || uncachedSeries.length > 0;

	console.log(`[cache] media — ${cached.size} cached, ${uncachedMovies.length + uncachedSeries.length} uncached`);

	// 4. Enrich only uncached items
	if (hasUncached) {
		const [overseerrMap, users] = await Promise.all([
			getOverseerrRequests().catch((err) => {
				console.warn('Overseerr fetch failed, skipping:', (err as Error).message);
				return null as Map<number, string> | null;
			}),
			getUsers(),
		]);

		const playedMovieIds = new Set<string>();
		const playedSeriesIds = new Set<string>();
		const moviePlayRecords = new Map<string, PlayRecord>();
		const seriesPlayRecords = new Map<string, PlayRecord>();

		for (const user of users) {
			if (uncachedMovies.length > 0) {
				const played = await fetchAllItems(client, `/Users/${user.Id}/Items`, {
					recursive: true,
					filters: 'IsPlayed',
					includeItemTypes: 'Movie',
					fields: 'UserData',
				});
				for (const item of played) {
					playedMovieIds.add(item.Id);
					mergePlayRecord(moviePlayRecords, item.Id, user.Name, item.UserData?.LastPlayedDate);
				}
			}
			if (uncachedSeries.length > 0) {
				const played = await fetchAllItems(client, `/Users/${user.Id}/Items`, {
					recursive: true,
					filters: 'IsPlayed',
					includeItemTypes: 'Episode',
					fields: 'SeriesId,UserData',
				});
				for (const item of played) {
					if (item.SeriesId) {
						playedSeriesIds.add(item.SeriesId);
						mergePlayRecord(seriesPlayRecords, item.SeriesId, user.Name, item.UserData?.LastPlayedDate);
					}
				}
			}
		}

		// Build MediaItems for uncached entries and save to disk
		await Promise.all([
			...uncachedMovies.map(async (movie) => {
				const tmdbId = movie.ProviderIds?.Tmdb ? parseInt(movie.ProviderIds.Tmdb, 10) : undefined;
				const requestedBy = overseerrMap && tmdbId != null ? (overseerrMap.get(tmdbId) ?? null) : null;
				const item = buildMediaItem(movie, 'Movie', playedMovieIds.has(movie.Id), requestedBy, moviePlayRecords.get(movie.Id));
				await diskSet(REPORT_MEDIA, movie.Id, item);
				cached.set(movie.Id, item);
			}),
			...uncachedSeries.map(async (show) => {
				const tmdbId = show.ProviderIds?.Tmdb ? parseInt(show.ProviderIds.Tmdb, 10) : undefined;
				const requestedBy = overseerrMap && tmdbId != null ? (overseerrMap.get(tmdbId) ?? null) : null;
				const item = buildMediaItem(show, 'Series', playedSeriesIds.has(show.Id), requestedBy, seriesPlayRecords.get(show.Id));
				await diskSet(REPORT_MEDIA, show.Id, item);
				cached.set(show.Id, item);
			}),
		]);
	}

	// 5. Return items in original order (movies first, then series)
	const results: MediaItem[] = [];
	for (const item of allFiltered) {
		const m = cached.get(item.Id);
		if (m) results.push(m);
	}
	return results;
}

function passesDateFilter(dateCreated: string | undefined, startDate?: string, endDate?: string): boolean {
	if (!startDate && !endDate) return true;
	if (!dateCreated) return true;
	const itemDate = dateCreated.substring(0, 10);
	if (startDate && itemDate < startDate) return false;
	if (endDate && itemDate > endDate) return false;
	return true;
}

/**
 * Rewrites a direct Jellyfin image URL (which embeds the API key) to a
 * backend proxy URL. Returns the same object reference if no change is needed.
 */
function migrateImageUrl<T extends { imageUrl: string | null }>(item: T): T {
	if (!item.imageUrl) return item;
	if (item.imageUrl.startsWith('/api/proxy/image')) return item;

	// Old format: http(s)://jellyfin-host/Items/<id>/Images/<type>?tag=...&api_key=...
	try {
		const url = new URL(item.imageUrl);
		const parts = url.pathname.split('/');
		// pathname: /Items/<id>/Images/<type>
		const itemsIdx = parts.indexOf('Items');
		const imagesIdx = parts.indexOf('Images');
		if (itemsIdx === -1 || imagesIdx === -1) return item;

		const itemId = parts[itemsIdx + 1];
		const imageType = parts[imagesIdx + 1];
		const tag = url.searchParams.get('tag');
		const maxWidth = url.searchParams.get('maxWidth');

		if (!itemId || !imageType) return item;

		let proxyUrl = `/api/proxy/image?itemId=${itemId}&imageType=${imageType}`;
		if (tag) proxyUrl += `&tag=${tag}`;
		if (maxWidth) proxyUrl += `&maxWidth=${maxWidth}`;

		return { ...item, imageUrl: proxyUrl };
	} catch {
		return item;
	}
}

function buildMediaItem(item: JellyfinItem, type: 'Movie' | 'Series', watched: boolean, requestedBy: string | null, playRecord?: PlayRecord): MediaItem {
	const imageUrl = item.ImageTags?.Primary ? `/api/proxy/image?itemId=${item.Id}&imageType=Primary&tag=${item.ImageTags.Primary}&maxWidth=120` : null;
	return {
		id: item.Id,
		name: item.Name,
		type,
		watched,
		dateAdded: item.DateCreated ?? null,
		year: item.ProductionYear ?? null,
		genres: item.Genres ?? [],
		runtimeMinutes: item.RunTimeTicks != null ? Math.round(item.RunTimeTicks / 600000000) : null,
		overview: item.Overview ?? null,
		imageUrl,
		requestedBy,
		lastWatchedBy: playRecord?.userName ?? null,
		lastWatchedDate: playRecord?.date ?? null,
	};
}

// ---------------------------------------------------------------------------
// Now Playing — real-time sessions (no caching; always fresh)
// ---------------------------------------------------------------------------
// Now Playing — real-time sessions (no caching; always fresh)
// ---------------------------------------------------------------------------

const PAUSED_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const PAUSED_SINCE_FILE = path.join(__dirname, '../../data/paused-since.json');

/** Load the pausedSince map from disk, returning an empty Map on any error. */
async function loadPausedSince(): Promise<Map<string, number>> {
	try {
		const content = await fs.readFile(PAUSED_SINCE_FILE, 'utf-8');
		const obj = JSON.parse(content) as Record<string, number>;
		return new Map(Object.entries(obj));
	} catch {
		return new Map();
	}
}

/** Persist the pausedSince map to disk (fire-and-forget). */
function savePausedSince(map: Map<string, number>): void {
	const obj = Object.fromEntries(map);
	fs.mkdir(path.dirname(PAUSED_SINCE_FILE), { recursive: true })
		.then(() => fs.writeFile(PAUSED_SINCE_FILE, JSON.stringify(obj), 'utf-8'))
		.catch(() => {
			/* non-critical — ignore write errors */
		});
}

export async function getNowPlaying(): Promise<NowPlayingSession[]> {
	const client = createJellyfinClient();

	const response = await client.get<JellyfinSession[]>('/Sessions', {
		params: { ActiveWithinSeconds: 300 }, // sessions active in last 5 min
	});

	const sessions = response.data ?? [];
	const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

	// Load persisted paused-since state
	const pausedSince = await loadPausedSince();
	let dirty = false;

	// Update tracker for all sessions that have NowPlayingItem
	const activeIds = new Set<string>();
	for (const s of sessions) {
		if (!s.NowPlayingItem) continue;
		activeIds.add(s.Id);
		const isPaused = s.PlayState?.IsPaused ?? false;
		if (isPaused) {
			if (!pausedSince.has(s.Id)) {
				pausedSince.set(s.Id, Date.now());
				dirty = true;
			}
		} else if (pausedSince.has(s.Id)) {
			pausedSince.delete(s.Id);
			dirty = true;
		}
	}
	// Prune sessions that are no longer active
	for (const id of pausedSince.keys()) {
		if (!activeIds.has(id)) {
			pausedSince.delete(id);
			dirty = true;
		}
	}

	if (dirty) savePausedSince(pausedSince);

	return sessions
		.filter((s) => {
			if (!s.NowPlayingItem) return false;
			if (!s.LastPlaybackCheckIn) return false;
			if (new Date(s.LastPlaybackCheckIn).getTime() < fiveMinutesAgo) return false;
			// Exclude sessions paused for longer than the timeout
			const pausedAt = pausedSince.get(s.Id);
			if (pausedAt && Date.now() - pausedAt > PAUSED_TIMEOUT_MS) return false;
			return true;
		})
		.map((s): NowPlayingSession => {
			const item = s.NowPlayingItem!;
			const play = s.PlayState ?? {};
			const trans = s.TranscodingInfo;

			const imageUrl = item.ImageTags?.Primary
				? `/api/proxy/image?itemId=${item.Id}&imageType=Primary&tag=${item.ImageTags.Primary}&maxWidth=200`
				: item.ImageTags?.Thumb
					? `/api/proxy/image?itemId=${item.Id}&imageType=Thumb&tag=${item.ImageTags.Thumb}&maxWidth=200`
					: null;

			const isVideoDirect = trans?.IsVideoDirect ?? play.PlayMethod === 'DirectPlay';
			const isAudioDirect = trans?.IsAudioDirect ?? play.PlayMethod === 'DirectPlay';

			return {
				sessionId: s.Id,
				userName: s.UserName ?? 'Unknown',
				userId: s.UserId,
				client: s.Client ?? '',
				deviceName: s.DeviceName ?? '',
				remoteEndPoint: s.RemoteEndPoint ?? '',
				nowPlaying: {
					id: item.Id,
					name: item.Name,
					type: item.Type,
					seriesName: item.SeriesName ?? null,
					seasonName: item.SeasonName ?? null,
					episodeNumber: item.IndexNumber ?? null,
					seasonNumber: item.ParentIndexNumber ?? null,
					year: item.ProductionYear ?? null,
					overview: item.Overview ?? null,
					imageUrl,
					runtimeTicks: item.RunTimeTicks ?? 0,
				},
				positionTicks: play.PositionTicks ?? 0,
				isPaused: play.IsPaused ?? false,
				playMethod: play.PlayMethod ?? 'DirectPlay',
				isVideoDirect,
				isAudioDirect,
				videoCodec: trans?.VideoCodec ?? null,
				audioCodec: trans?.AudioCodec ?? null,
				transcodeReasons: trans?.TranscodeReasons ?? [],
				bitrate: trans?.Bitrate ?? null,
				framerate: trans?.Framerate ?? null,
				additionalUsers: (s.AdditionalUsers ?? []).map((u) => u.UserName),
			};
		});
}

// ---------------------------------------------------------------------------
// Watch History — via jellyfin-plugin-playbackreporting PlaybackActivity table
// ---------------------------------------------------------------------------

const REPORT_WATCH_HISTORY = 'watch-history';
const WATCH_HISTORY_CACHE_KEY = 'all';
const LIBRARY_GROWTH_CACHE_KEY = 'all';
const MIN_DURATION_SECONDS = 3 * 60; // 3 minutes
const MERGE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours

export async function getWatchHistory(): Promise<WatchHistoryItem[]> {
	const cached = await diskGet<WatchHistoryItem[]>(REPORT_WATCH_HISTORY, WATCH_HISTORY_CACHE_KEY);
	if (cached) {
		console.log('[cache] watch-history hit');
		return cached;
	}

	console.log('[cache] watch-history miss — querying PlaybackActivity');
	const client = createJellyfinClient();

	// Query all playback records from the reporting plugin's SQLite database
	const customQuery = 'SELECT DateCreated, UserId, CAST(PlayDuration AS INTEGER) AS PlayDuration, ItemId, ItemType, ItemName ' + 'FROM PlaybackActivity ' + 'ORDER BY DateCreated ASC';

	type RawRow = {
		dateCreated: Date;
		userId: string;
		playDuration: number;
		itemId: string;
		itemType: string;
		itemName: string;
	};

	let rawRows: RawRow[] = [];

	try {
		const resp = await client.post<PlaybackReportingQueryResult>('/user_usage_stats/submit_custom_query', {
			CustomQueryString: customQuery,
			ReplaceUserId: false,
		});

		const { colums, results: rows } = resp.data;
		const ci = (name: string) => {
			const idx = colums.indexOf(name);
			return idx >= 0 ? idx : colums.findIndex((c) => c.toLowerCase() === name.toLowerCase());
		};
		const iDate = ci('DateCreated');
		const iUser = ci('UserId');
		const iDur = ci('PlayDuration');
		const iItemId = ci('ItemId');
		const iItemType = ci('ItemType');
		const iItemName = ci('ItemName');

		for (const row of rows) {
			const rawDate = row[iDate] as string;
			// Plugin stores dates as "YYYY-MM-DD HH:MM:SS" UTC
			const dateCreated = new Date(rawDate.replace(' ', 'T') + 'Z');
			const userId = (row[iUser] as string) ?? '';
			const playDuration = Number(row[iDur] ?? 0);
			const itemId = (row[iItemId] as string) ?? '';
			const itemType = (row[iItemType] as string) ?? '';
			const itemName = (row[iItemName] as string) ?? '';

			if (!userId || !itemId) continue;

			rawRows.push({ dateCreated, userId, playDuration, itemId, itemType, itemName });
		}
	} catch (err: unknown) {
		const e = err as { response?: { status?: number }; message?: string };
		console.error('[watch-history] PlaybackActivity query failed:', e?.response?.status, e?.message);
		return [];
	}

	// --- Merge sessions: same userId+itemId within 12-hour window ---
	// dateCreated from plugin is end-of-session; compute session start = dateCreated - duration
	type MergedSession = {
		userId: string;
		itemId: string;
		itemType: string;
		itemName: string;
		startDate: Date;
		totalDuration: number;
	};

	const merged: MergedSession[] = [];

	for (const row of rawRows) {
		const sessionStart = new Date(row.dateCreated.getTime() - row.playDuration * 1000);

		// Find the most recent existing session for the same user+item within 12h
		let found: MergedSession | undefined;
		for (let i = merged.length - 1; i >= 0; i--) {
			const m = merged[i];
			if (m.userId === row.userId && m.itemId === row.itemId) {
				if (sessionStart.getTime() - m.startDate.getTime() < MERGE_WINDOW_MS) {
					found = m;
				}
				break;
			}
		}

		if (found) {
			found.totalDuration += row.playDuration;
		} else {
			merged.push({
				userId: row.userId,
				itemId: row.itemId,
				itemType: row.itemType,
				itemName: row.itemName,
				startDate: sessionStart,
				totalDuration: row.playDuration,
			});
		}
	}

	// Filter out plays shorter than 3 minutes, then sort newest first
	const filtered = merged.filter((m) => m.totalDuration >= MIN_DURATION_SECONDS).sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

	// Fetch Jellyfin item metadata in batches of 50
	const uniqueItemIds = [...new Set(filtered.map((m) => m.itemId))];
	const itemMetaMap = new Map<string, JellyfinItem>();

	for (let i = 0; i < uniqueItemIds.length; i += 50) {
		const batch = uniqueItemIds.slice(i, i + 50);
		try {
			const resp = await client.get<JellyfinQueryResult>('/Items', {
				params: {
					Ids: batch.join(','),
					Fields: 'SeriesName,RunTimeTicks,ImageTags,ProductionYear,ParentIndexNumber,IndexNumber',
				},
			});
			for (const item of resp.data.Items) {
				itemMetaMap.set(item.Id, item);
			}
		} catch {
			// Item metadata unavailable for this batch; fall back to plugin ItemName
		}
	}

	// Build user ID → name map
	const users = await getUsers();
	const userMap = new Map(users.map((u) => [u.Id, u.Name]));

	const results: WatchHistoryItem[] = filtered.map((m) => {
		const item = itemMetaMap.get(m.itemId);
		const runtimeTicks = item?.RunTimeTicks ?? 0;

		const imageUrl = item?.ImageTags?.Primary
			? `/api/proxy/image?itemId=${m.itemId}&imageType=Primary&tag=${item.ImageTags.Primary}&maxWidth=120`
			: item?.ImageTags?.Thumb
				? `/api/proxy/image?itemId=${m.itemId}&imageType=Thumb&tag=${item.ImageTags.Thumb}&maxWidth=120`
				: null;

		return {
			itemId: m.itemId,
			itemType: m.itemType === 'Episode' ? 'Episode' : 'Movie',
			name: item?.Name ?? m.itemName,
			seriesName: item?.SeriesName ?? null,
			seasonNumber: item?.ParentIndexNumber ?? null,
			episodeNumber: item?.IndexNumber ?? null,
			year: item?.ProductionYear ?? null,
			runtimeMinutes: runtimeTicks ? Math.round(runtimeTicks / 600_000_000) : null,
			imageUrl,
			userName: userMap.get(m.userId) ?? m.userId,
			userId: m.userId,
			playbackStartDate: m.startDate.toISOString(),
			playbackDurationMinutes: Math.round(m.totalDuration / 60),
		};
	});

	await diskSet(REPORT_WATCH_HISTORY, WATCH_HISTORY_CACHE_KEY, results);
	console.log(`[cache] watch-history cached ${results.length} items`);
	return results;
}

// ---------------------------------------------------------------------------
// Library Growth — cumulative file size (bytes) over time by DateCreated
// ---------------------------------------------------------------------------
function itemSizeBytes(item: JellyfinItem): number {
	const mediaSourcesBytes = (item.MediaSources ?? []).reduce((sum, src) => sum + (src.Size ?? 0), 0);
	if (mediaSourcesBytes > 0) return mediaSourcesBytes;
	return item.Size ?? 0;
}

export async function getLibraryGrowth(): Promise<LibraryGrowthPoint[]> {
	const cached = await diskGet<LibraryGrowthPoint[]>(REPORT_LIBRARY_GROWTH, LIBRARY_GROWTH_CACHE_KEY);
	if (cached) {
		console.log('[cache] library-growth hit');
		return cached;
	}

	console.log('[cache] library-growth miss — fetching from Jellyfin');
	const client = createJellyfinClient();

	// Include major file-backed item types so total reflects the whole library.
	// TV is still represented by Episodes for per-series curve, while total includes all.
	const mediaItems = await fetchAllItems(client, '/Items', {
		recursive: true,
		includeItemTypes: 'Movie,Episode,Audio,MusicVideo,Video,Book',
		fields: 'DateCreated,MediaSources,Size',
		enableTotalRecordCount: false,
	});

	// Accumulate bytes per day
	const moviesByDate = new Map<string, number>();
	const seriesByDate = new Map<string, number>();
	const totalByDate = new Map<string, number>();

	for (const item of mediaItems) {
		if (!item.DateCreated) continue;
		const day = item.DateCreated.substring(0, 10);
		const bytes = itemSizeBytes(item);
		if (bytes <= 0) continue;

		totalByDate.set(day, (totalByDate.get(day) ?? 0) + bytes);
		if (item.Type === 'Movie') {
			moviesByDate.set(day, (moviesByDate.get(day) ?? 0) + bytes);
		} else if (item.Type === 'Episode') {
			seriesByDate.set(day, (seriesByDate.get(day) ?? 0) + bytes);
		}
	}

	// Collect all unique dates and sort ascending
	const allDates = [...new Set([...totalByDate.keys(), ...moviesByDate.keys(), ...seriesByDate.keys()])].sort();

	// Build cumulative series
	let cumMovies = 0;
	let cumSeries = 0;
	let cumTotal = 0;
	const points: LibraryGrowthPoint[] = allDates.map((date) => {
		cumMovies += moviesByDate.get(date) ?? 0;
		cumSeries += seriesByDate.get(date) ?? 0;
		cumTotal += totalByDate.get(date) ?? 0;
		return { date, movies: cumMovies, series: cumSeries, total: cumTotal };
	});

	await diskSet(REPORT_LIBRARY_GROWTH, LIBRARY_GROWTH_CACHE_KEY, points);
	console.log(`[cache] library-growth cached ${points.length} points`);
	return points;
}
