import {
	isDashboardStatsCacheExpired,
	isLibraryGrowthCacheExpired,
	isWatchHistoryCacheExpired,
	refreshDashboardStats,
	refreshLibraryGrowth,
	refreshWatchHistory,
} from './jellyfin';

const CACHE_SCAN_INTERVAL_MS = 60 * 1000;

let scanInterval: NodeJS.Timeout | null = null;
let scanPromise: Promise<void> | null = null;

async function refreshIfExpired<T>(
	reportName: string,
	isExpired: () => Promise<boolean>,
	refresh: () => Promise<T>,
): Promise<void> {
	if (!(await isExpired())) return;

	console.log(`[cache] ${reportName} expired or missing; background refresh starting`);
	await refresh();
}

async function scanExpiredCaches(reason: string): Promise<void> {
	await Promise.allSettled([
		refreshIfExpired('dashboard', isDashboardStatsCacheExpired, refreshDashboardStats),
		refreshIfExpired('library-growth', isLibraryGrowthCacheExpired, refreshLibraryGrowth),
		refreshIfExpired('watch-history', isWatchHistoryCacheExpired, refreshWatchHistory),
	]).then((results) => {
		for (const result of results) {
			if (result.status === 'rejected') {
				const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
				console.warn(`[cache] background scan (${reason}) refresh failed:`, error);
			}
		}
	});
}

export function triggerCacheRefreshScan(reason = 'manual'): void {
	if (scanPromise) return;

	scanPromise = scanExpiredCaches(reason).finally(() => {
		scanPromise = null;
	});
}

export function startCacheRefresher(): void {
	if (scanInterval) return;

	triggerCacheRefreshScan('startup');
	scanInterval = setInterval(() => triggerCacheRefreshScan('interval'), CACHE_SCAN_INTERVAL_MS);
	scanInterval.unref?.();
	console.log(`[cache] background cache scanner running every ${CACHE_SCAN_INTERVAL_MS / 1000}s`);
}
