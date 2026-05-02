import fs from 'fs/promises';
import path from 'path';

export interface AppSettings {
	cacheTtlHours: number;
	jellyfinPublicUrl: string;
	discordBotToken: string;
	discordChannelId: string;
	discordChannelName: string;
	discordGuildId: string;
	discordIntroMessage: string;
	discordIntroMessageId: string;
}

export const DEFAULT_DISCORD_INTRO_MESSAGE = [
	'**Jellyfin removal voting**',
	'',
	'This channel receives notices for library items that may be removed because they have not been watched recently.',
	'',
	'How it works:',
	'- Each notice names the item, requester, last watcher, and scheduled removal date.',
	'- Vote with thumbs up to keep the item.',
	'- Vote with thumbs down if it is okay to delete the item.',
	'- Items are reviewed after the scheduled date before they are marked removed.',
].join('\n');

const DEFAULTS: AppSettings = {
	cacheTtlHours: 4,
	jellyfinPublicUrl: '',
	discordBotToken: '',
	discordChannelId: '',
	discordChannelName: '',
	discordGuildId: '',
	discordIntroMessage: DEFAULT_DISCORD_INTRO_MESSAGE,
	discordIntroMessageId: '',
};
const SETTINGS_FILE = path.join(__dirname, '../../data/settings.json');

export async function readSettings(): Promise<AppSettings> {
	try {
		const content = await fs.readFile(SETTINGS_FILE, 'utf-8');
		return { ...DEFAULTS, ...(JSON.parse(content) as Partial<AppSettings>) };
	} catch {
		return { ...DEFAULTS };
	}
}

export async function writeSettings(settings: AppSettings): Promise<void> {
	await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
	await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}
