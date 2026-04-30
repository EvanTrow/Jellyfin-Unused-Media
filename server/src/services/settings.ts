import fs from 'fs/promises';
import path from 'path';

export interface AppSettings {
	cacheTtlHours: number;
}

const DEFAULTS: AppSettings = { cacheTtlHours: 4 };
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
