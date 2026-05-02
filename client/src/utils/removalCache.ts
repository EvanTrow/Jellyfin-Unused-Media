import { QueryClient } from '@tanstack/react-query';
import { MarkedRemovalItem, MarkedRemovalSummary, MediaItem, QueryResult } from '../types';

export const MARKED_FOR_REMOVAL_QUERY_KEY = ['marked-for-removal'] as const;

function buildMarkedMediaItem(item: MediaItem, marked: MarkedRemovalItem): MediaItem {
	return {
		...item,
		id: marked.id,
		name: marked.name,
		type: marked.type,
		jellyfinUrl: marked.jellyfinUrl ?? item.jellyfinUrl,
		markedForRemoval: {
			removeAt: marked.removeAt,
			markedAt: marked.markedAt,
			status: marked.status ?? 'Pending',
			reactions: marked.reactions,
		},
	};
}

export function isRemovalPastDue(item: MediaItem, now = Date.now()): boolean {
	if (!item.markedForRemoval) return false;
	if (item.markedForRemoval.status === 'removed') return false;
	const dueAt = Date.parse(item.markedForRemoval.removeAt);
	return Number.isFinite(dueAt) && dueAt <= now;
}

function removeAtTime(item: MediaItem): number {
	if (!item.markedForRemoval) return Number.MAX_SAFE_INTEGER;
	const time = Date.parse(item.markedForRemoval.removeAt);
	return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

export function sortMarkedForRemovalItems(items: MediaItem[], now = Date.now()): MediaItem[] {
	return [...items].sort((a, b) => {
		const aRemoved = a.markedForRemoval?.status === 'removed';
		const bRemoved = b.markedForRemoval?.status === 'removed';
		if (aRemoved !== bRemoved) return aRemoved ? 1 : -1;

		const aTime = removeAtTime(a);
		const bTime = removeAtTime(b);
		const aOverdue = aTime <= now;
		const bOverdue = bTime <= now;

		if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
		return aTime - bTime;
	});
}

export function cacheMarkedMediaForRemoval(queryClient: QueryClient, item: MediaItem, marked: MarkedRemovalItem): MediaItem {
	const markedItem = buildMarkedMediaItem(item, marked);

	queryClient.setQueriesData<QueryResult>({ queryKey: ['media'] }, (old) =>
		old
			? {
					...old,
					items: old.items.map((mediaItem) => (mediaItem.id === markedItem.id ? { ...mediaItem, markedForRemoval: markedItem.markedForRemoval } : mediaItem)),
				}
			: old,
	);

	queryClient.setQueryData<QueryResult>(MARKED_FOR_REMOVAL_QUERY_KEY, (old) => {
		if (!old) return { items: [markedItem], totalCount: 1 };

		const exists = old.items.some((mediaItem) => mediaItem.id === markedItem.id);
		return {
			...old,
			items: sortMarkedForRemovalItems(
				exists ? old.items.map((mediaItem) => (mediaItem.id === markedItem.id ? { ...mediaItem, ...markedItem } : mediaItem)) : [markedItem, ...old.items],
			),
			totalCount: exists ? old.totalCount : old.totalCount + 1,
		};
	});

	return markedItem;
}

export function cacheMediaMarkedRemoved(queryClient: QueryClient, marked: MarkedRemovalItem): void {
	const removedSummary: MarkedRemovalSummary = {
		removeAt: marked.removeAt,
		markedAt: marked.markedAt,
		status: marked.status ?? 'removed',
		reactions: marked.reactions,
	};

	queryClient.setQueriesData<QueryResult>({ queryKey: ['media'] }, (old) =>
		old
			? {
					...old,
					items: old.items.map((mediaItem) => (mediaItem.id === marked.id ? { ...mediaItem, markedForRemoval: removedSummary } : mediaItem)),
				}
			: old,
	);

	queryClient.setQueryData<QueryResult>(MARKED_FOR_REMOVAL_QUERY_KEY, (old) => {
		if (!old) return old;

		return {
			...old,
			items: sortMarkedForRemovalItems(
				old.items.map((mediaItem) =>
					mediaItem.id === marked.id
						? {
								...mediaItem,
								jellyfinUrl: marked.jellyfinUrl ?? mediaItem.jellyfinUrl,
								markedForRemoval: removedSummary,
							}
						: mediaItem,
				),
			),
		};
	});
}

export function cacheClearedMediaRemovalMark(queryClient: QueryClient, item: Pick<MediaItem, 'id'>): void {
	queryClient.setQueriesData<QueryResult>({ queryKey: ['media'] }, (old) =>
		old
			? {
					...old,
					items: old.items.map((mediaItem) => (mediaItem.id === item.id ? { ...mediaItem, markedForRemoval: undefined } : mediaItem)),
				}
			: old,
	);

	queryClient.setQueryData<QueryResult>(MARKED_FOR_REMOVAL_QUERY_KEY, (old) => {
		if (!old) return old;

		const exists = old.items.some((mediaItem) => mediaItem.id === item.id);
		return {
			...old,
			items: old.items.filter((mediaItem) => mediaItem.id !== item.id),
			totalCount: exists ? Math.max(0, old.totalCount - 1) : old.totalCount,
		};
	});
}
