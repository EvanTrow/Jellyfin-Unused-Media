# Jellyfin Reports

A self-hosted web dashboard for your [Jellyfin](https://jellyfin.org) media server. Browse library statistics, identify unwatched media, and manage an exclusion list — all backed by a persistent disk cache so repeated queries are instant.

[![Build & Publish Docker Image](https://github.com/EvanTrow/Jellyfin-Unused-Media/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/EvanTrow/Jellyfin-Unused-Media/actions/workflows/docker-publish.yml)

---

## Features

### 📊 Dashboard
- Per-library counts of **movies**, **series**, **seasons**, and **episodes**
- Combined totals across all libraries

### 🎬 Unused Media Report
- Query all **movies** and **TV shows** — episodes rolled up to series level
- Toggle to show only **unwatched** items
- Filter by **date added to library** range
- Shows **watched status**, **last watched by** user and date
- Optional **Overseerr / Jellyseerr** integration — shows who originally requested each item
- **Exclude list** – permanently hide specific titles from results (persisted to disk)
- Client-side search, sort, and filtering

### 💾 Disk Cache
- Each Jellyfin item is cached individually on disk by its unique ID
- Cache survives server restarts — no re-querying on startup
- **Hybrid fetch**: new/uncached items are fetched fresh; cached items are returned instantly
- Clear cache manually per-report or all at once from the **Settings** page

### 🎨 UI
- Left sidebar navigation with **Dashboard**, **Reports**, and **Settings** sections
- Light / dark mode (follows system preference)
- Poster thumbnails, genre chips, expandable overviews

---

## Docker (Recommended)

The easiest way to run Jellyfin Reports is with Docker.

### docker run

```bash
docker run -d \
  --name jellyfin-reports \
  -p 3001:3001 \
  -e JELLYFIN_URL=http://your-jellyfin-server:8096 \
  -e JELLYFIN_API_KEY=your_api_key_here \
  -v jellyfin-reports-data:/app/server/data \
  --restart unless-stopped \
  ghcr.io/evantrow/jellyfin-unused-media:latest
```

### docker-compose.yml

```yaml
services:
  jellyfin-reports:
    image: ghcr.io/evantrow/jellyfin-unused-media:latest
    container_name: jellyfin-reports
    ports:
      - "3001:3001"
    environment:
      JELLYFIN_URL: http://your-jellyfin-server:8096
      JELLYFIN_API_KEY: your_api_key_here
      # Optional — enables "Requested By" column
      # OVERSEERR_URL: http://your-overseerr:5055
      # OVERSEERR_API_KEY: your_overseerr_api_key
    volumes:
      - jellyfin-reports-data:/app/server/data  # excluded.json + disk cache
    restart: unless-stopped

volumes:
  jellyfin-reports-data:
```

Open **http://localhost:3001** in your browser.

---

## Manual Setup

### 1. Get a Jellyfin API Key

In Jellyfin: **Dashboard → API Keys → + (New Key)**

### 2. Configure Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
# Required
JELLYFIN_URL=http://your-jellyfin-server:8096
JELLYFIN_API_KEY=your_api_key_here
PORT=3001

# Optional — enables "Requested By" column in Unused Media report
OVERSEERR_URL=http://your-overseerr:5055
OVERSEERR_API_KEY=your_overseerr_api_key_here
```

> **Overseerr / Jellyseerr** — if not configured the app works normally; the "Requested By" column shows `—`.  
> Generate the API key in Overseerr/Jellyseerr: **Settings → General → API Key**

### 3. Install & Run

```bash
# Install all dependencies
npm run install:all

# Development (hot reload)
npm run dev
# Client: http://localhost:3000
# API:    http://localhost:3001

# Production build
npm run build
npm start
# App: http://localhost:3001
```

---

## How It Works

### Library Stats (Dashboard)
1. Fetches the current library list from `/Library/VirtualFolders`
2. Checks the disk cache for each library's counts — cache hits skip the API entirely
3. For uncached libraries, queries item counts by type (Movie, Series, Season, Episode) and saves to disk

### Unused Media Report
1. Fetches the full item list from Jellyfin (movies and/or series)
2. Checks which items are already on the disk cache
3. For **uncached items only**: fetches play records for all users and Overseerr request data, then saves each result individually to `server/data/cache/media/{id}.json`
4. Returns all results — cached and newly fetched — in a single response
5. The "Unwatched only" toggle filters client-side; no re-query needed

### Cache
- Cache files: `server/data/cache/{reportName}/{jellyfinItemId}.json`
- No TTL — cache is permanent until manually cleared
- Clear from the **Settings** page (per-report or all at once), or `DELETE /api/cache`

---

## Project Structure

```
├── .github/
│   └── workflows/
│       └── docker-publish.yml   Build & push to GHCR on main / tags
├── Dockerfile                   Multi-stage build (client → server → runtime)
├── server/                      Express + TypeScript API
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── dashboard.ts     GET /api/dashboard
│   │   │   ├── media.ts         GET /api/media
│   │   │   ├── excluded.ts      CRUD /api/excluded
│   │   │   └── cache.ts         GET|DELETE /api/cache[/:report]
│   │   ├── services/
│   │   │   ├── jellyfin.ts      Jellyfin API + hybrid cache logic
│   │   │   ├── overseerr.ts     Overseerr / Jellyseerr integration
│   │   │   └── diskCache.ts     Per-item disk cache helpers
│   │   └── types/
│   ├── data/                    excluded.json (auto-created)
│   └── cache/                   Disk cache (auto-created)
└── client/                      React + Material UI frontend
    └── src/
        ├── pages/
        │   ├── DashboardPage.tsx
        │   ├── UnusedMediaPage.tsx
        │   └── SettingsPage.tsx
        ├── components/
        │   ├── MediaTable.tsx
        │   ├── QueryPanel.tsx
        │   └── ExcludeManager.tsx
        ├── context/
        │   └── SettingsContext.tsx
        └── services/
            └── api.ts
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dashboard` | Library statistics |
| `GET` | `/api/media` | All media items (cached, hybrid) |
| `GET` | `/api/excluded` | Excluded items list |
| `POST` | `/api/excluded` | Add item to exclude list |
| `DELETE` | `/api/excluded/:id` | Remove one excluded item |
| `DELETE` | `/api/excluded` | Clear all excluded items |
| `GET` | `/api/cache` | Cache stats (per-report item counts) |
| `DELETE` | `/api/cache` | Clear all cache |
| `DELETE` | `/api/cache/:report` | Clear one report cache |
| `GET` | `/api/health` | Health check |
