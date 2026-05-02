import axios from 'axios';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface DiscordChannelInfo {
	id: string;
	name: string;
	type: number;
	guild_id?: string;
}

export interface DiscordGuildMember {
	nick?: string | null;
	user?: {
		id: string;
		username: string;
		global_name?: string | null;
	};
}

export interface DiscordMessageReaction {
	count: number;
	emoji: {
		id?: string | null;
		name: string;
	};
}

export interface DiscordMessage {
	id: string;
	content?: string;
	reactions?: DiscordMessageReaction[];
}

export async function fetchDiscordChannelInfo(botToken: string, channelId: string): Promise<DiscordChannelInfo> {
	const response = await axios.get<DiscordChannelInfo>(`${DISCORD_API_BASE}/channels/${encodeURIComponent(channelId)}`, {
		headers: {
			Authorization: `Bot ${botToken}`,
		},
		timeout: 10000,
	});
	return response.data;
}

export async function sendDiscordChannelMessage(
	botToken: string,
	channelId: string,
	payload: Record<string, unknown>,
): Promise<{ id: string }> {
	const response = await axios.post<{ id: string }>(`${DISCORD_API_BASE}/channels/${encodeURIComponent(channelId)}/messages`, payload, {
		headers: {
			Authorization: `Bot ${botToken}`,
			'Content-Type': 'application/json',
		},
		timeout: 10000,
	});
	return response.data;
}

export async function editDiscordChannelMessage(
	botToken: string,
	channelId: string,
	messageId: string,
	payload: Record<string, unknown>,
): Promise<{ id: string }> {
	const response = await axios.patch<{ id: string }>(`${DISCORD_API_BASE}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`, payload, {
		headers: {
			Authorization: `Bot ${botToken}`,
			'Content-Type': 'application/json',
		},
		timeout: 10000,
	});
	return response.data;
}

export async function pinDiscordChannelMessage(botToken: string, channelId: string, messageId: string): Promise<void> {
	await axios.put(`${DISCORD_API_BASE}/channels/${encodeURIComponent(channelId)}/pins/${encodeURIComponent(messageId)}`, null, {
		headers: {
			Authorization: `Bot ${botToken}`,
		},
		timeout: 10000,
	});
}

export async function fetchDiscordChannelMessage(botToken: string, channelId: string, messageId: string): Promise<DiscordMessage> {
	const response = await axios.get<DiscordMessage>(`${DISCORD_API_BASE}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`, {
		headers: {
			Authorization: `Bot ${botToken}`,
		},
		timeout: 10000,
	});
	return response.data;
}

export async function addDiscordMessageReaction(botToken: string, channelId: string, messageId: string, emoji: string): Promise<void> {
	const url = `${DISCORD_API_BASE}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}/@me`;

	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			await axios.put(url, null, {
				headers: {
					Authorization: `Bot ${botToken}`,
				},
				timeout: 10000,
			});
			return;
		} catch (error: unknown) {
			if (!axios.isAxiosError(error) || error.response?.status !== 429 || attempt === 2) {
				throw error;
			}

			const retryAfter = Number((error.response.data as { retry_after?: number } | undefined)?.retry_after ?? 1);
			await delay(Math.max(250, retryAfter * 1000));
		}
	}
}

export async function searchDiscordGuildMembers(botToken: string, guildId: string, query: string, limit = 10): Promise<DiscordGuildMember[]> {
	const response = await axios.get<DiscordGuildMember[]>(`${DISCORD_API_BASE}/guilds/${encodeURIComponent(guildId)}/members/search`, {
		headers: {
			Authorization: `Bot ${botToken}`,
		},
		params: { query, limit },
		timeout: 10000,
	});
	return response.data;
}

export async function removeDiscordChannelMessage(botToken: string, channelId: string, messageId: string): Promise<void> {
	await axios.delete(`${DISCORD_API_BASE}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`, {
		headers: {
			Authorization: `Bot ${botToken}`,
		},
		timeout: 10000,
	});
}
