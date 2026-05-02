import fs from 'fs/promises';
import path from 'path';
import { RemovalReactionSummary, MarkedRemovalItem, MarkedRemovalSummary } from '../types';

const DATA_FILE = path.join(__dirname, '../../data/marked-for-removal.json');

function normalizeRemovalMark(item: MarkedRemovalItem): MarkedRemovalItem {
	return {
		...item,
		status: item.status ?? 'Pending',
	};
}

export function emptyRemovalReactions(): RemovalReactionSummary {
	return {
		thumbsUp: 0,
		thumbsDown: 0,
		updatedAt: new Date().toISOString(),
	};
}

function removeAtTime(item: MarkedRemovalItem): number {
	const time = Date.parse(item.removeAt);
	return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

export function sortRemovalMarks<T extends MarkedRemovalItem>(items: T[], now = Date.now()): T[] {
	return [...items].sort((a, b) => {
		const aRemoved = a.status === 'removed';
		const bRemoved = b.status === 'removed';
		if (aRemoved !== bRemoved) return aRemoved ? 1 : -1;

		const aTime = removeAtTime(a);
		const bTime = removeAtTime(b);
		const aOverdue = aTime <= now;
		const bOverdue = bTime <= now;

		if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
		return aTime - bTime;
	});
}

export async function readRemovalMarks(): Promise<MarkedRemovalItem[]> {
	try {
		const content = await fs.readFile(DATA_FILE, 'utf-8');
		return sortRemovalMarks((JSON.parse(content) as MarkedRemovalItem[]).map(normalizeRemovalMark));
	} catch {
		return [];
	}
}

async function writeRemovalMarks(items: MarkedRemovalItem[]): Promise<void> {
	await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
	await fs.writeFile(DATA_FILE, JSON.stringify(sortRemovalMarks(items), null, 2), 'utf-8');
}

export async function saveRemovalMarks(items: MarkedRemovalItem[]): Promise<void> {
	await writeRemovalMarks(items.map(normalizeRemovalMark));
}

export async function getRemovalMarkMap(): Promise<Map<string, MarkedRemovalSummary>> {
	const items = await readRemovalMarks();
	return new Map(items.map((item) => [item.id, { removeAt: item.removeAt, markedAt: item.markedAt, status: item.status, reactions: item.reactions }]));
}

export async function isMarkedForRemoval(id: string): Promise<boolean> {
	const items = await readRemovalMarks();
	return items.some((item) => item.id === id);
}

export async function getRemovalMark(id: string): Promise<MarkedRemovalItem | null> {
	const items = await readRemovalMarks();
	return items.find((item) => item.id === id) ?? null;
}

export async function addRemovalMark(item: MarkedRemovalItem): Promise<MarkedRemovalItem> {
	const items = await readRemovalMarks();
	if (items.some((existing) => existing.id === item.id)) {
		throw new Error('Item is already marked for removal');
	}
	const saved = normalizeRemovalMark(item);
	items.push(saved);
	await writeRemovalMarks(items);
	return saved;
}

export async function markRemovalItemRemoved(id: string): Promise<MarkedRemovalItem | null> {
	const items = await readRemovalMarks();
	const existing = items.find((item) => item.id === id) ?? null;
	if (!existing) return null;

	const updated = { ...existing, status: 'removed' as const };
	await writeRemovalMarks(items.map((item) => (item.id === id ? updated : item)));
	return updated;
}

export async function removeRemovalMark(id: string): Promise<MarkedRemovalItem | null> {
	const items = await readRemovalMarks();
	const existing = items.find((item) => item.id === id) ?? null;
	if (!existing) return null;
	await writeRemovalMarks(items.filter((item) => item.id !== id));
	return existing;
}
