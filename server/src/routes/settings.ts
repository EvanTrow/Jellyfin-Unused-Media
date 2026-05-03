import { Router, Request, Response } from 'express';
import axios from 'axios';
import { readSettings, writeSettings, AppSettings } from '../services/settings';
import { editDiscordChannelMessage, fetchDiscordChannelInfo, fetchDiscordChannelMessage } from '../services/discord';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
	try {
		const settings = await readSettings();
		if (settings.discordBotToken && settings.discordChannelId && settings.discordIntroMessageId) {
			try {
				const message = await fetchDiscordChannelMessage(settings.discordBotToken, settings.discordChannelId, settings.discordIntroMessageId);
				if (typeof message.content === 'string' && message.content !== settings.discordIntroMessage) {
					const updated = { ...settings, discordIntroMessage: message.content };
					await writeSettings(updated);
					res.json(updated);
					return;
				}
			} catch {
				// Settings should still load if the intro message was deleted or Discord is temporarily unavailable.
			}
		}
		res.json(settings);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json({ error: message });
	}
});

router.put('/', async (req: Request, res: Response) => {
	try {
		const body = req.body as Partial<AppSettings>;
		const current = await readSettings();

		const updated: AppSettings = {
			...current,
		};

		if (typeof body.cacheTtlHours === 'number' && body.cacheTtlHours >= 0) {
			updated.cacheTtlHours = body.cacheTtlHours;
		}

		if (typeof body.jellyfinPublicUrl === 'string') {
			const value = body.jellyfinPublicUrl.trim();
			if (value) {
				try {
					const parsed = new URL(value);
					updated.jellyfinPublicUrl = parsed.toString().replace(/\/$/, '');
				} catch {
					res.status(400).json({ error: 'Jellyfin public URL must be a valid URL' });
					return;
				}
			} else {
				updated.jellyfinPublicUrl = '';
			}
		}

		const hasDiscordUpdate = typeof body.discordBotToken === 'string' || typeof body.discordChannelId === 'string';
		if (hasDiscordUpdate) {
			const discordBotToken = typeof body.discordBotToken === 'string' ? body.discordBotToken.trim() : current.discordBotToken;
			const discordChannelId = typeof body.discordChannelId === 'string' ? body.discordChannelId.trim() : current.discordChannelId;

			if (!discordBotToken && !discordChannelId) {
				updated.discordBotToken = '';
				updated.discordChannelId = '';
				updated.discordChannelName = '';
				updated.discordGuildId = '';
				updated.discordIntroMessageId = '';
			} else if (!discordBotToken || !discordChannelId) {
				res.status(400).json({ error: 'Discord bot token and channel ID are both required' });
				return;
			} else {
				try {
					const channel = await fetchDiscordChannelInfo(discordBotToken, discordChannelId);
					updated.discordBotToken = discordBotToken;
					updated.discordChannelId = discordChannelId;
					updated.discordChannelName = channel.name || channel.id;
					updated.discordGuildId = channel.guild_id || '';
					if (discordChannelId !== current.discordChannelId) {
						updated.discordIntroMessageId = '';
					}
				} catch {
					res.status(400).json({ error: 'Discord bot could not access that channel. Check the token, channel ID, and bot permissions.' });
					return;
				}
			}
		}

		if (typeof body.discordIntroMessage === 'string') {
			const introMessage = body.discordIntroMessage.trim();
			updated.discordIntroMessage = introMessage;

			const shouldUpdateDiscordIntro =
				introMessage !== current.discordIntroMessage &&
				!!updated.discordBotToken &&
				!!updated.discordChannelId &&
				!!updated.discordIntroMessageId;

			if (shouldUpdateDiscordIntro) {
				try {
					await editDiscordChannelMessage(updated.discordBotToken, updated.discordChannelId, updated.discordIntroMessageId, {
						content: introMessage,
					});
				} catch (error: unknown) {
					if (axios.isAxiosError(error) && error.response?.status === 404) {
						updated.discordIntroMessageId = '';
					} else {
						throw error;
					}
				}
			}
		}

		if (typeof body.discordKeepVoteEmoji === 'string') {
			const emoji = body.discordKeepVoteEmoji.trim();
			if (!emoji) {
				res.status(400).json({ error: 'Keep vote emoji cannot be blank' });
				return;
			}
			updated.discordKeepVoteEmoji = emoji;
		}

		if (typeof body.discordRemoveVoteEmoji === 'string') {
			const emoji = body.discordRemoveVoteEmoji.trim();
			if (!emoji) {
				res.status(400).json({ error: 'Remove vote emoji cannot be blank' });
				return;
			}
			updated.discordRemoveVoteEmoji = emoji;
		}

		await writeSettings(updated);
		res.json(updated);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		res.status(500).json({ error: message });
	}
});

export default router;
