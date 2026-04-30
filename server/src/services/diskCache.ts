import fs from 'fs/promises';
import path from 'path';
import { readSettings } from './settings';

// Cache lives at server/data/cache/ relative to the project
// __dirname is server/src/services/ (dev) or server/dist/src/services/ (compiled)
const CACHE_DIR = path.join(__dirname, '../../data/cache');

interface CacheEntry<T> {
v: T;      // value
t: number; // cached-at timestamp (ms since epoch)
}

function itemPath(report: string, id: string): string {
const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_');
return path.join(CACHE_DIR, report, `${safe}.json`);
}

async function getTtlMs(): Promise<number> {
const settings = await readSettings();
return settings.cacheTtlHours * 60 * 60 * 1000;
}

export async function diskGet<T>(report: string, id: string): Promise<T | null> {
try {
const content = await fs.readFile(itemPath(report, id), 'utf-8');
const entry = JSON.parse(content) as CacheEntry<T>;
if (typeof entry.t !== 'number' || entry.v === undefined) return null;
const ttlMs = await getTtlMs();
if (Date.now() - entry.t > ttlMs) return null; // expired
return entry.v;
} catch {
return null;
}
}

export async function diskSet<T>(report: string, id: string, value: T): Promise<void> {
const dir = path.join(CACHE_DIR, report);
await fs.mkdir(dir, { recursive: true });
const entry: CacheEntry<T> = { v: value, t: Date.now() };
await fs.writeFile(itemPath(report, id), JSON.stringify(entry), 'utf-8');
}

export async function diskHas(report: string, id: string): Promise<boolean> {
// Honour TTL — a file that exists but is expired counts as a miss
const val = await diskGet(report, id);
return val !== null;
}

/** Read multiple items at once; returns a Map of id → value for those that exist and are not expired. */
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
await fs.mkdir(CACHE_DIR, { recursive: true });
}

export interface CacheReportStat {
report: string;
count: number;
sizeBytes: number;
oldestCachedAt: string | null;
newestCachedAt: string | null;
}

export async function diskStats(): Promise<CacheReportStat[]> {
try {
const entries = await fs.readdir(CACHE_DIR, { withFileTypes: true });
return Promise.all(
entries
.filter((e) => e.isDirectory())
.map(async (d): Promise<CacheReportStat> => {
const dir   = path.join(CACHE_DIR, d.name);
const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));

let sizeBytes   = 0;
let oldestTs:  number | null = null;
let newestTs:  number | null = null;

await Promise.all(
files.map(async (f) => {
const fp   = path.join(dir, f);
const stat = await fs.stat(fp);
sizeBytes += stat.size;
try {
const content = await fs.readFile(fp, 'utf-8');
const entry   = JSON.parse(content) as { t?: number };
if (typeof entry.t === 'number') {
if (oldestTs === null || entry.t < oldestTs) oldestTs = entry.t;
if (newestTs === null || entry.t > newestTs) newestTs = entry.t;
}
} catch { /* skip unreadable files */ }
})
);

return {
report: d.name,
count: files.length,
sizeBytes,
oldestCachedAt: oldestTs !== null ? new Date(oldestTs).toISOString() : null,
newestCachedAt: newestTs !== null ? new Date(newestTs).toISOString() : null,
};
})
);
} catch {
return [];
}
}
