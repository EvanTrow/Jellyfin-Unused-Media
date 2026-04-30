import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import mediaRoutes from './routes/media';
import excludedRoutes from './routes/excluded';
import dashboardRoutes from './routes/dashboard';
import cacheRoutes from './routes/cache';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/media', mediaRoutes);
app.use('/api/excluded', excludedRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cache', cacheRoutes);

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
