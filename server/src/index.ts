import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import mediaRoutes from './routes/media';
import excludedRoutes from './routes/excluded';
import dashboardRoutes from './routes/dashboard';
import cacheRoutes from './routes/cache';
import settingsRoutes from './routes/settings';
import sessionsRoutes from './routes/sessions';
import proxyRoutes from './routes/proxy';
import watchHistoryRoutes from './routes/watchHistory';
import usersRoutes from './routes/users';
import discordRoutes from './routes/discord';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/media', mediaRoutes);
app.use('/api/excluded', excludedRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/watch-history', watchHistoryRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/discord', discordRoutes);

// Health check
app.get('/api/health', (_req, res) => {
	res.json({
		status: 'ok',
		jellyfinUrl: process.env.JELLYFIN_URL || 'not configured',
	});
});

// In production, serve the React client build
if (process.env.NODE_ENV === 'production') {
	const clientBuild = path.join(__dirname, '../../client/dist');
	app.use(express.static(clientBuild));
	app.get('*', (_req, res) => {
		res.sendFile(path.join(clientBuild, 'index.html'));
	});
}

app.listen(PORT, () => {
	console.log(`🎬 Jellyfin Reports server running on http://localhost:${PORT}`);
	console.log(`   Jellyfin URL: ${process.env.JELLYFIN_URL || 'not configured'}`);
});
