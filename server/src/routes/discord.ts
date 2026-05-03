import { Router, Request, Response } from 'express';
import axios from 'axios';
import { addRemovalMark, emptyRemovalReactions, getRemovalMark, isMarkedForRemoval, markRemovalItemRemoved, readRemovalMarks, removeRemovalMark, saveRemovalMarks } from '../services/removalMarks';
import {
	addDiscordMessageReaction,
	removeDiscordChannelMessage,
	editDiscordChannelMessage,
	fetchDiscordChannelInfo,
	fetchDiscordChannelMessage,
	pinDiscordChannelMessage,
	sendDiscordChannelMessage,
	searchDiscordGuildMembers,
} from '../services/discord';
import { getAllMedia } from '../services/jellyfin';
import { DEFAULT_DISCORD_KEEP_VOTE_EMOJI, DEFAULT_DISCORD_REMOVE_VOTE_EMOJI, readSettings, writeSettings } from '../services/settings';
import { RemovalDiscordMentions, RemovalReactionSummary, MarkedRemovalItem, MediaItem } from '../types';

const router = Router();

type VoteEmojiSettings = {
	discordKeepVoteEmoji?: string;
	discordRemoveVoteEmoji?: string;
};

type DiscordReaction = {
	count?: number;
	emoji: {
		id?: string | null;
		name: string;
	};
};

function normalizeConfiguredVoteEmoji(value: string | undefined, fallback: string): string {
	const emoji = value?.trim() || fallback;
	const customEmoji = emoji.match(/^<a?:([^:>]+):(\d+)>$/);
	return customEmoji ? `${customEmoji[1]}:${customEmoji[2]}` : emoji;
}

function getVoteEmojis(settings?: VoteEmojiSettings): { keep: string; remove: string } {
	return {
		keep: normalizeConfiguredVoteEmoji(settings?.discordKeepVoteEmoji, DEFAULT_DISCORD_KEEP_VOTE_EMOJI),
		remove: normalizeConfiguredVoteEmoji(settings?.discordRemoveVoteEmoji, DEFAULT_DISCORD_REMOVE_VOTE_EMOJI),
	};
}

function getVoteEmojiLabels(settings?: VoteEmojiSettings): { keep: string; remove: string } {
	return {
		keep: settings?.discordKeepVoteEmoji?.trim() || DEFAULT_DISCORD_KEEP_VOTE_EMOJI,
		remove: settings?.discordRemoveVoteEmoji?.trim() || DEFAULT_DISCORD_REMOVE_VOTE_EMOJI,
	};
}

function voteFooterText(settings?: VoteEmojiSettings): string {
	const emojis = getVoteEmojiLabels(settings);
	return `Vote: ${emojis.keep} keep / ${emojis.remove} remove`;
}

function textOrUnknown(value: string | null | undefined): string {
	const trimmed = value?.trim();
	return trimmed ? trimmed : 'Unknown';
}

function normalizeUserLookup(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatDiscordUser(value: string | null | undefined, mention: string | undefined): string {
	return mention ?? textOrUnknown(value);
}

function getRemoveAtUnix(removeAt: string): number {
	const time = Date.parse(removeAt);
	return Math.floor((Number.isFinite(time) ? time : Date.now()) / 1000);
}

function removalStatusValue(mark: MarkedRemovalItem): string {
	if (mark.status === 'removed') return 'Removed';
	return `Scheduled <t:${getRemoveAtUnix(mark.removeAt)}:R>`;
}

function removalMessageColor(mark: MarkedRemovalItem): number {
	return mark.status === 'removed' ? 10038562 : 15158332;
}

function normalizeReactionEmojiName(value: string): string {
	return value.replace(/\uFE0F/g, '');
}

function notificationContent(mark: MarkedRemovalItem, item: Partial<MediaItem> | undefined, mentions: string[]): string | undefined {
	if (mentions.length === 0) return undefined;

	const itemName = formatItemName(item ?? mark);
	const status = mark.status === 'removed' ? 'was marked removed' : `is scheduled for removal <t:${getRemoveAtUnix(mark.removeAt)}:R>`;
	return `${mentions.join(' ')} ${mark.type} "${itemName}" ${status}.`;
}

function buildRemovalMessagePayload(mark: MarkedRemovalItem, item?: Partial<MediaItem>, thumbnailUrl?: string | null, settings?: VoteEmojiSettings): Record<string, unknown> {
	const mentions = [...new Set(Object.values(mark.discordMentions ?? {}).filter((value): value is string => !!value))];
	return {
		content: notificationContent(mark, item, mentions),
		allowed_mentions: { parse: [], users: mentions.map((mention) => mention.replace(/[<@>]/g, '')) },
		embeds: [
			{
				title: mark.status === 'removed' ? `${mark.type} Removed Due to Inactivity` : `${mark.type} Will Be Removed Due to Inactivity`,
				url: mark.jellyfinUrl ?? undefined,
				color: removalMessageColor(mark),
				description: `**${formatItemName(item ?? mark)}**\n\n${item?.overview || 'No overview available.'}`,
				thumbnail: thumbnailUrl ? { url: thumbnailUrl } : undefined,
				fields: [
					{ name: 'Requested By', value: formatDiscordUser(mark.requestedBy, mark.discordMentions?.requestedBy), inline: true },
					{ name: 'Last Watched By', value: formatDiscordUser(mark.lastWatchedBy, mark.discordMentions?.lastWatchedBy), inline: true },
					{ name: 'Removal Status', value: removalStatusValue(mark), inline: true },
					{ name: 'Remove After', value: `<t:${getRemoveAtUnix(mark.removeAt)}:F>`, inline: false },
				],
				footer: { text: voteFooterText(settings) },
				timestamp: mark.markedAt,
			},
		],
	};
}

function reactionMatchesEmoji(reaction: DiscordReaction, configuredEmoji: string): boolean {
	const expected = normalizeReactionEmojiName(configuredEmoji);
	const customEmoji = expected.match(/^([^:]+):(\d+)$/);
	const reactionName = normalizeReactionEmojiName(reaction.emoji.name);
	const reactionId = reaction.emoji.id ? `${reactionName}:${reaction.emoji.id}` : null;

	if (reactionName === expected || reactionId === expected) return true;
	if (customEmoji && reactionName === customEmoji[1]) return true;
	return false;
}

function extractRemovalReactions(message: { reactions?: DiscordReaction[] }, settings?: VoteEmojiSettings): RemovalReactionSummary {
	const emojis = getVoteEmojis(settings);
	const getCount = (emojiName: string) => {
		const reaction = message.reactions?.find((entry) => reactionMatchesEmoji(entry, emojiName));
		return Math.max(0, (reaction?.count ?? 0) - 1);
	};

	return {
		thumbsUp: getCount(emojis.keep),
		thumbsDown: getCount(emojis.remove),
		updatedAt: new Date().toISOString(),
	};
}

function reactionsChanged(a: RemovalReactionSummary | undefined, b: RemovalReactionSummary): boolean {
	return (a?.thumbsUp ?? 0) !== b.thumbsUp || (a?.thumbsDown ?? 0) !== b.thumbsDown;
}

function replaceJellyfinBase(jellyfinUrl: string | null, publicBaseUrl: string, itemId: string): string | null {
	if (!publicBaseUrl) return jellyfinUrl;
	const base = publicBaseUrl.replace(/\/$/, '');
	if (!jellyfinUrl) return `${base}/web/#/details?id=${encodeURIComponent(itemId)}`;

	try {
		const current = new URL(jellyfinUrl);
		return `${base}${current.pathname}${current.search}${current.hash}`;
	} catch {
		return jellyfinUrl;
	}
}

function getItemThumbnailUrl(item: Partial<MediaItem>, publicBaseUrl: string): string | null {
	if (!publicBaseUrl || !item.imageUrl) return null;
	const base = publicBaseUrl.replace(/\/$/, '');

	try {
		const imageUrl = new URL(item.imageUrl, 'http://jellyfin-reports.local');

		if (imageUrl.pathname === '/api/proxy/image') {
			const itemId = imageUrl.searchParams.get('itemId') || item.id;
			const imageType = imageUrl.searchParams.get('imageType') || 'Primary';
			if (!itemId) return null;

			const thumbnail = new URL(`${base}/Items/${encodeURIComponent(itemId)}/Images/${encodeURIComponent(imageType)}`);
			const tag = imageUrl.searchParams.get('tag');
			if (tag) thumbnail.searchParams.set('tag', tag);
			thumbnail.searchParams.set('fillWidth', '160');
			thumbnail.searchParams.set('quality', '90');
			return thumbnail.toString();
		}

		if (imageUrl.pathname.includes('/Items/') && imageUrl.pathname.includes('/Images/')) {
			return `${base}${imageUrl.pathname}${imageUrl.search}`;
		}
	} catch {
		return null;
	}

	return null;
}

function formatItemName(item: Partial<MediaItem>): string {
	return item.year ? `${item.name} (${item.year})` : (item.name ?? 'Unknown item');
}

async function getDiscordGuildId(settings: { discordBotToken: string; discordChannelId: string; discordGuildId?: string }): Promise<string | null> {
	if (settings.discordGuildId) return settings.discordGuildId;
	if (!settings.discordBotToken || !settings.discordChannelId) return null;
	try {
		const channel = await fetchDiscordChannelInfo(settings.discordBotToken, settings.discordChannelId);
		return channel.guild_id ?? null;
	} catch {
		return null;
	}
}

async function matchDiscordUsers(
	settings: { discordBotToken: string; discordChannelId: string; discordGuildId?: string },
	users: { key: keyof RemovalDiscordMentions; name: string | null | undefined }[],
): Promise<RemovalDiscordMentions> {
	const guildId = await getDiscordGuildId(settings);
	if (!guildId) return {};

	const mentions: RemovalDiscordMentions = {};
	for (const entry of users) {
		const name = entry.name?.trim();
		if (!name) continue;

		try {
			const members = await searchDiscordGuildMembers(settings.discordBotToken, guildId, name, 10);
			const expected = normalizeUserLookup(name);
			const matched = members.find((member) => {
				const candidates = [member.nick, member.user?.global_name, member.user?.username].filter((value): value is string => !!value);
				return candidates.some((candidate) => normalizeUserLookup(candidate) === expected);
			});

			if (matched?.user?.id) {
				mentions[entry.key] = `<@${matched.user.id}>`;
			}
		} catch (error: unknown) {
			console.warn(`Discord member lookup failed for "${name}":`, error instanceof Error ? error.message : error);
		}
	}

	return mentions;
}

async function addVotingReactions(botToken: string, channelId: string, messageId: string, settings?: VoteEmojiSettings): Promise<void> {
	const emojis = getVoteEmojis(settings);
	await addVotingReaction(botToken, channelId, messageId, emojis.keep);
	await addVotingReaction(botToken, channelId, messageId, emojis.remove);
}

async function addVotingReaction(botToken: string, channelId: string, messageId: string, emoji: string): Promise<void> {
	try {
		await addDiscordMessageReaction(botToken, channelId, messageId, emoji);
	} catch (error: unknown) {
		console.warn(`Failed to add Discord voting reaction ${emoji}:`, error instanceof Error ? error.message : error);
	}
}

async function ensureVotingReactions(botToken: string, channelId: string, messageId: string, message: { reactions?: DiscordReaction[] }, settings?: VoteEmojiSettings): Promise<void> {
	const emojis = getVoteEmojis(settings);
	if (!(message.reactions ?? []).some((reaction) => reactionMatchesEmoji(reaction, emojis.keep))) {
		await addVotingReaction(botToken, channelId, messageId, emojis.keep);
	}
	if (!(message.reactions ?? []).some((reaction) => reactionMatchesEmoji(reaction, emojis.remove))) {
		await addVotingReaction(botToken, channelId, messageId, emojis.remove);
	}
}

async function syncRemovalReactionsFromDiscord(
	settings: { discordBotToken: string; discordChannelId: string } & VoteEmojiSettings,
	marks: MarkedRemovalItem[],
): Promise<MarkedRemovalItem[]> {
	if (!settings.discordBotToken || !settings.discordChannelId) return marks;

	let changed = false;
	const synced = await Promise.all(
		marks.map(async (mark) => {
			if (!mark.discordMessageId) return mark;
			try {
				const message = await fetchDiscordChannelMessage(settings.discordBotToken, settings.discordChannelId, mark.discordMessageId);
				await ensureVotingReactions(settings.discordBotToken, settings.discordChannelId, mark.discordMessageId, message, settings);
				const reactions = extractRemovalReactions(message, settings);
				if (!reactionsChanged(mark.reactions, reactions)) return mark;
				changed = true;
				return { ...mark, reactions };
			} catch (error: unknown) {
				console.warn(`Failed to sync Discord reactions for "${mark.name}":`, error instanceof Error ? error.message : error);
				return mark;
			}
		}),
	);

	if (changed) await saveRemovalMarks(synced);
	return synced;
}

function fallbackMediaItem(mark: MarkedRemovalItem): MediaItem {
	return {
		id: mark.id,
		name: mark.name,
		type: mark.type,
		watched: false,
		dateAdded: null,
		year: null,
		genres: [],
		runtimeMinutes: null,
		criticRating: null,
		communityRating: null,
		overview: null,
		imageUrl: null,
		requestedBy: mark.requestedBy ?? null,
		lastWatchedBy: mark.lastWatchedBy ?? null,
		lastWatchedDate: null,
		jellyfinUrl: mark.jellyfinUrl,
		markedForRemoval: {
			removeAt: mark.removeAt,
			markedAt: mark.markedAt,
			status: mark.status,
			reactions: mark.reactions,
		},
	};
}

router.get('/marked-for-removal', async (_req: Request, res: Response) => {
	try {
		const settings = await readSettings();
		const marks = await syncRemovalReactionsFromDiscord(settings, await readRemovalMarks());
		if (marks.length === 0) {
			res.json({ items: [], totalCount: 0 });
			return;
		}

		const markMap = new Map(marks.map((mark) => [mark.id, mark]));
		const media = await getAllMedia({ includeMovies: true, includeShows: true });
		const mediaMap = new Map(media.map((item) => [item.id, item]));

		const items = marks
			.map((mark) => {
				const item = mediaMap.get(mark.id);
				if (!item) return fallbackMediaItem(mark);
				return {
					...item,
					jellyfinUrl: mark.jellyfinUrl ?? item.jellyfinUrl,
					markedForRemoval: {
						removeAt: mark.removeAt,
						markedAt: mark.markedAt,
						status: mark.status,
						reactions: mark.reactions,
					},
				};
			})
			.filter((item) => markMap.has(item.id));

		res.json({ items, totalCount: items.length });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json({ error: message });
	}
});

router.post('/intro-message', async (req: Request, res: Response) => {
	try {
		const settings = await readSettings();
		if (!settings.discordBotToken || !settings.discordChannelId) {
			res.status(400).json({ error: 'Discord bot token and channel ID must be saved in settings first' });
			return;
		}

		const body = req.body as { message?: string };
		const messageText = typeof body.message === 'string' ? body.message.trim() : settings.discordIntroMessage.trim();
		if (!messageText) {
			res.status(400).json({ error: 'Intro message cannot be blank' });
			return;
		}

		let messageId = settings.discordIntroMessageId;
		if (messageId) {
			try {
				await editDiscordChannelMessage(settings.discordBotToken, settings.discordChannelId, messageId, { content: messageText });
			} catch (error: unknown) {
				if (!axios.isAxiosError(error) || error.response?.status !== 404) {
					throw error;
				}
				messageId = '';
			}
		}

		if (!messageId) {
			const message = await sendDiscordChannelMessage(settings.discordBotToken, settings.discordChannelId, { content: messageText });
			messageId = message.id;
		}

		await pinDiscordChannelMessage(settings.discordBotToken, settings.discordChannelId, messageId);
		const updated = { ...settings, discordIntroMessage: messageText, discordIntroMessageId: messageId };
		await writeSettings(updated);
		res.json({ messageId });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json({ error: message });
	}
});

router.post('/mark-for-removal', async (req: Request, res: Response) => {
	try {
		const { item, removeAt } = req.body as { item?: Partial<MediaItem>; removeAt?: string };
		if (!item?.id || !item.name || !item.type || !removeAt) {
			res.status(400).json({ error: 'item id, name, type, and removeAt are required' });
			return;
		}

		const removeAtDate = new Date(removeAt);
		if (Number.isNaN(removeAtDate.getTime()) || removeAtDate.getTime() <= Date.now()) {
			res.status(400).json({ error: 'removeAt must be a future date' });
			return;
		}
		if (await isMarkedForRemoval(item.id)) {
			res.status(409).json({ error: 'Item is already marked for removal' });
			return;
		}

		const settings = await readSettings();
		if (!settings.discordBotToken || !settings.discordChannelId) {
			res.status(400).json({ error: 'Discord bot token and channel ID must be saved in settings first' });
			return;
		}

		const jellyfinUrl = replaceJellyfinBase(item.jellyfinUrl ?? null, settings.jellyfinPublicUrl, item.id);
		const thumbnailUrl = getItemThumbnailUrl(item, settings.jellyfinPublicUrl);
		const markedAt = new Date().toISOString();
		const requestedBy = item.requestedBy?.trim() || null;
		const lastWatchedBy = item.lastWatchedBy?.trim() || null;
		const discordMentions = await matchDiscordUsers(settings, [
			{ key: 'requestedBy', name: requestedBy },
			{ key: 'lastWatchedBy', name: lastWatchedBy },
		]);

		const removalMark: MarkedRemovalItem = {
			id: item.id,
			name: item.name,
			type: item.type,
			jellyfinUrl,
			requestedBy,
			lastWatchedBy,
			removeAt: removeAtDate.toISOString(),
			markedAt,
			status: 'Pending',
			reactions: emptyRemovalReactions(),
			discordMentions,
		};

		const message = await sendDiscordChannelMessage(settings.discordBotToken, settings.discordChannelId, buildRemovalMessagePayload(removalMark, item, thumbnailUrl, settings));
		await addVotingReactions(settings.discordBotToken, settings.discordChannelId, message.id, settings);

		const saved = await addRemovalMark({
			...removalMark,
			discordMessageId: message.id,
		});
		res.status(201).json(saved);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		if (message === 'Item is already marked for removal') {
			res.status(409).json({ error: message });
			return;
		}
		res.status(500).json({ error: message });
	}
});

router.patch('/mark-for-removal/:id/removed', async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const updated = await markRemovalItemRemoved(id);
		if (!updated) {
			res.status(404).json({ error: 'Removal mark not found' });
			return;
		}

		const settings = await readSettings();
		let responseItem = updated;
		if (settings.discordBotToken && settings.discordChannelId && updated.discordMessageId) {
			try {
				const message = await fetchDiscordChannelMessage(settings.discordBotToken, settings.discordChannelId, updated.discordMessageId);
				responseItem = { ...updated, reactions: extractRemovalReactions(message, settings) };
				await editDiscordChannelMessage(settings.discordBotToken, settings.discordChannelId, updated.discordMessageId, buildRemovalMessagePayload(responseItem, undefined, undefined, settings));
				await saveRemovalMarks((await readRemovalMarks()).map((mark) => (mark.id === responseItem.id ? responseItem : mark)));
			} catch (error: unknown) {
				console.warn(`Failed to update Discord removal message for "${updated.name}":`, error instanceof Error ? error.message : error);
				throw error;
			}
		}

		res.json(responseItem);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json({ error: message });
	}
});

router.delete('/mark-for-removal/:id', async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const removalMark = await getRemovalMark(id);
		if (!removalMark) {
			res.status(404).json({ error: 'Removal mark not found' });
			return;
		}

		const settings = await readSettings();
		if (!settings.discordBotToken || !settings.discordChannelId) {
			res.status(400).json({ error: 'Discord bot token and channel ID must be saved in settings first' });
			return;
		}

		if (removalMark.discordMessageId) {
			try {
				await removeDiscordChannelMessage(settings.discordBotToken, settings.discordChannelId, removalMark.discordMessageId);
			} catch (error: unknown) {
				if (!axios.isAxiosError(error) || error.response?.status !== 404) {
					throw error;
				}
			}
		}

		await removeRemovalMark(id);
		res.status(204).send();
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json({ error: message });
	}
});

export default router;
