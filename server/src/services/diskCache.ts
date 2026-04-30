import fs from 'fs/promises';
import path from 'path';

// Cache lives at server/data/cache/ relative to the project
// __dirname is server/src/services/ (dev) or server/dist/src/services/ (compiled)
const CACHE_DIR = path.join(__dirname, '../../data/cache');

function itemPath(report: string, id: string): string {
	// Sanitize id so it is safe as a filename
	const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_');
	return path.join(CACHE_DIR, report, `${safe}.json`);
}

export async function diskGet<T>(report: string, id: string): Promise<T | null> {
	try {
		const content = await fs.readFile(itemPath(report, id), 'utf-8');
		return JSON.parse(content) as T;
	} catch {
		return null;
	}
}

export async function diskSet<T>(report: string, id: string, value: T): Promise<void> {
	const dir = path.join(CACHE_DIR, report);
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(itemPath(report, id), JSON.stringify(value), 'utf-8');
}

export async function diskHas(report: string, id: string): Promise<boolean> {
	try {
		await fs.access(itemPath(report, id));
		return true;
	} catch {
		return false;
	}
}

/** Read multiple items at once; returns a Map of id → value for those that exist. */
export async function diskGetBatch<T>(report: string, ids: string[]): Promise<Map<string, T>> {
	const map = new Map<string, T>();
	await Promise.all(
		ids.map(async (id) => {
			const val = await diskGet<T>(report, id);
			if (val !== null) map.set(id, val);
		})
	);
	return map;
}

/** Clear one report folder, or the entire cache dir. */
export async function diskClear(report?: string): Promise<void> {
	const target = report ? path.join(CACHE_DIR, report) : CACHE_DIR;
	try {
		await fs.rm(target, { recursive: true, force: true });
	} catch { /* ignore if not present */ }
	// Recreate the base cache dir so future writes don't fail
	await fs.mkdir(CACHE_DIR, { recursive: true });
}

export interface CacheReportStat {
	report: string;
	count: number;
}

export async function diskStats(): Promise<CacheReportStat[]> {
	try {
		const entries = await fs.readdir(CACHE_DIR, { withFileTypes: true });
		return Promise.all(
			entries
				.filter((e) => e.isDirectory())
				.map(async (d) => {
					const files = await fs.readdir(path.join(CACHE_DIR, d.name));
					return { report: d.name, count: files.filter((f) => f.endsWith('.json')).length };
				})
		);
	} catch {
		return [];
	}
}
