import fs from 'fs/promises';
import path from 'path';
import { NoActivityWithinFilter, UnusedMediaOptions } from '../types';

const OPTIONS_FILE = path.join(__dirname, '../../data/unused-media-options.json');
const ACTIVITY_FILTERS = new Set<NoActivityWithinFilter>(['', '1m', '2m', '3m', '6m', '1y', '18m', 'never']);

function today(): string {
	return new Date().toISOString().substring(0, 10);
}

function defaults(): UnusedMediaOptions {
	return {
		startDate: null,
		endDate: today(),
		includeMovies: true,
		includeShows: true,
		showUnwatchedOnly: true,
		noActivityWithin: '',
		excludeRequesters: [],
	};
}

export function normalizeUnusedMediaOptions(input: Partial<UnusedMediaOptions>): UnusedMediaOptions {
	const base = defaults();
	const noActivityWithin = ACTIVITY_FILTERS.has(input.noActivityWithin ?? '') ? (input.noActivityWithin ?? '') : '';
	return {
		startDate: typeof input.startDate === 'string' && input.startDate ? input.startDate : null,
		endDate: typeof input.endDate === 'string' && input.endDate ? input.endDate : null,
		includeMovies: typeof input.includeMovies === 'boolean' ? input.includeMovies : base.includeMovies,
		includeShows: typeof input.includeShows === 'boolean' ? input.includeShows : base.includeShows,
		showUnwatchedOnly: typeof input.showUnwatchedOnly === 'boolean' ? input.showUnwatchedOnly : base.showUnwatchedOnly,
		noActivityWithin,
		excludeRequesters: Array.isArray(input.excludeRequesters)
			? input.excludeRequesters.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim())
			: [],
	};
}

export async function readUnusedMediaOptions(): Promise<UnusedMediaOptions> {
	try {
		const content = await fs.readFile(OPTIONS_FILE, 'utf-8');
		return normalizeUnusedMediaOptions(JSON.parse(content) as Partial<UnusedMediaOptions>);
	} catch {
		return defaults();
	}
}

export async function writeUnusedMediaOptions(options: UnusedMediaOptions): Promise<UnusedMediaOptions> {
	const normalized = normalizeUnusedMediaOptions(options);
	await fs.mkdir(path.dirname(OPTIONS_FILE), { recursive: true });
	await fs.writeFile(OPTIONS_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
	return normalized;
}
