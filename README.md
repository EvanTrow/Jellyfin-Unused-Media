# Jellyfin Reports

A self-hosted web dashboard for your [Jellyfin](https://jellyfin.org) media server. Browse library statistics, review watch history, identify stale media, manage exclusions, and coordinate removal notices through Discord.

[![Build & Publish Docker Image](https://github.com/EvanTrow/Jellyfin-Reports/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/EvanTrow/Jellyfin-Reports/actions/workflows/docker-publish.yml)

---

## Features

### 📊 Dashboard
- Per-library counts for **movies**, **series**, **seasons**, and **episodes**
- Combined totals across all libraries
- Library growth data for recently added media trends
- **Now Playing** panel with a live view of active streams, refreshed every 10 seconds
  - Play / pause state with progress bar and position interpolation between polls
  - Stream method badge: **Direct Play**, **Direct Stream**, or **Transcoding**
  - Video and audio codec, bitrate, framerate, and transcode reasons
  - User and client device information

### 🎬 Unused Media Report
- Query **movies**, **TV shows**, or both; episodes are rolled up to the series level
- Filter by date added, activity age, requester, and watched state
- Saved query options so the report opens with your preferred filters
- Shows watched status, requester, last watched user, and last watched date
- Optional **Overseerr / Jellyseerr** integration for the **Requested By** column
- Exclude list for permanently hiding specific titles from unused media results
- Client-side search, sorting, expandable overviews, poster thumbnails, ratings, genres, and runtime

### 🗑️ Marked For Removal
- Mark unused media for future removal from the report table
- Posts a Discord removal notice with item details, requester, last watcher, scheduled removal date, and Jellyfin link
- Adds configurable keep / remove vote reactions and syncs reaction counts back into the app
- Tracks pending, overdue, and removed items in a dedicated **Marked for Removal** report
- Can mark an item as removed or clear the removal notice and saved mark

### 📜 Watch History
- Full playback history across all users
- Filter by one or more Jellyfin users
- Shows thumbnail, title, media type, year, runtime, user, start time, and playback duration
- Infinite-scroll pagination with 50 records per page

### ⚙️ Settings
- Cache TTL control from 0 to 24 hours; 0 means cached items never expire automatically
- Per-report cache stats and one-click cache clearing
- Public Jellyfin URL used for Discord links and thumbnails
- Discord bot token, channel verification, intro message, pinned intro posting, and vote emoji settings

### 💾 Disk Cache & Persistence
- Each Jellyfin item is cached individually on disk by its unique ID
- Cache survives server restarts and Docker container upgrades when `server/data` is mounted
- Hybrid fetch: cached items are returned instantly; missing or stale items are fetched fresh
- Persistent app data includes settings, exclusions, unused media options, marked removal records, and cache files
- Images are proxied through the backend so the Jellyfin API key is never exposed to the browser

---

## Docker

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
  ghcr.io/evantrow/jellyfin-reports:latest
```

### docker-compose.yml

```yaml
services:
  jellyfin-reports:
    image: ghcr.io/evantrow/jellyfin-reports:latest
    container_name: jellyfin-reports
    ports:
      - "3001:3001"
    environment:
      JELLYFIN_URL: http://your-jellyfin-server:8096
      JELLYFIN_API_KEY: your_api_key_here
      # Optional: enables "Requested By" data from Overseerr / Jellyseerr
      # OVERSEERR_URL: http://your-overseerr:5055
      # OVERSEERR_API_KEY: your_overseerr_api_key
    volumes:
      - jellyfin-reports-data:/app/server/data
    restart: unless-stopped

volumes:
  jellyfin-reports-data:
```

Open **http://localhost:3001** in your browser.

The `server/data` volume stores:
- `settings.json`
- `excluded.json`
- `unused-media-options.json`
- `marked-for-removal.json`
- `cache/`

---

## Manual Setup

### 1. Get a Jellyfin API Key

In Jellyfin, go to **Dashboard -> API Keys -> + (New Key)**.

### 2. Configure Environment

```bash
cp .env.example server/.env
```

Edit `server/.env`:

```env
# Required
JELLYFIN_URL=http://your-jellyfin-server:8096
JELLYFIN_API_KEY=your_api_key_here
PORT=3001

# Optional: enables "Requested By" data in unused media reports
OVERSEERR_URL=http://your-overseerr:5055
OVERSEERR_API_KEY=your_overseerr_api_key_here
```

If Overseerr / Jellyseerr is not configured, the app still works normally and requester fields remain blank. Generate the API key in Overseerr or Jellyseerr under **Settings -> General -> API Key**.

### 3. Install & Run

```bash
# Install all dependencies
npm run install:all

# Development with hot reload
npm run dev
# Client: http://localhost:3000
# API:    http://localhost:3001

# Production build
npm run build
npm start
# App: http://localhost:3001
```

---

## Discord Removal Notices

Discord settings are configured in the app under **Settings -> Discord**, not through environment variables.

1. Create a Discord bot in the Discord Developer Portal.
2. Invite the bot to your server with permission to view the target channel, send messages, manage messages, pin messages, add reactions, and read message history.
3. Copy the bot token and target channel ID into Jellyfin Reports.
4. Save settings to verify the bot can access the channel.
5. Optionally edit and send the pinned intro message.

The app can mention matched Discord users when their Discord member name matches the Jellyfin, Overseerr, or Jellyseerr user name exactly after normalizing punctuation and casing.

---

## How It Works

### Dashboard
1. Fetches the current library list from `/Library/VirtualFolders`
2. Checks the disk cache for each library count
3. Queries Jellyfin only for missing or stale counts
4. Fetches library growth data from recently added media

### Unused Media
1. Fetches movie and series lists from Jellyfin according to the saved query options
2. Checks which items are already in the disk cache
3. Fetches play records and Overseerr / Jellyseerr request data only for uncached or stale items
4. Filters excluded items, activity age, requester exclusions, and date ranges
5. Returns cached and newly fetched results in one response

### Marked For Removal
1. Creates a local removal mark with the item, scheduled removal date, requester, and last watcher
2. Sends a Discord embed using the configured public Jellyfin URL
3. Adds the configured keep / remove reactions
4. Refreshes reaction counts when marked items are loaded
5. Updates or deletes the Discord message when the item is marked removed or cleared

### Cache
- Cache files: `server/data/cache/{reportName}/{jellyfinItemId}.json`
- TTL is configurable from **Settings**; stale entries refresh automatically on the next query
- Clear cache from **Settings**, `DELETE /api/cache`, or `DELETE /api/cache/:report`

---

## Project Structure

```text
├── .github/
│   └── workflows/
│       └── docker-publish.yml   Build and publish to GHCR
├── Dockerfile                   Multi-stage client, server, runtime image
├── package.json                 Root scripts for install, dev, build, start
├── server/                      Express + TypeScript API
│   ├── src/
│   │   ├── index.ts             API bootstrap and static production client
│   │   ├── routes/
│   │   │   ├── dashboard.ts     Dashboard stats and library growth
│   │   │   ├── media.ts         Unused media, saved options, requesters
│   │   │   ├── excluded.ts      Excluded item CRUD
│   │   │   ├── cache.ts         Cache stats and clearing
│   │   │   ├── settings.ts      Persistent app settings
│   │   │   ├── sessions.ts      Now playing sessions
│   │   │   ├── watchHistory.ts  Watch history pagination
│   │   │   ├── users.ts         Jellyfin users
│   │   │   ├── discord.ts       Removal notices and Discord sync
│   │   │   └── proxy.ts         Jellyfin image proxy
│   │   ├── services/
│   │   │   ├── jellyfin.ts      Jellyfin API and hybrid cache logic
│   │   │   ├── overseerr.ts     Overseerr / Jellyseerr integration
│   │   │   ├── discord.ts       Discord REST API helpers
│   │   │   ├── diskCache.ts     Per-item disk cache helpers
│   │   │   ├── settings.ts      Settings persistence and defaults
│   │   │   ├── removalMarks.ts  Marked-for-removal persistence
│   │   │   └── unusedMediaOptions.ts
│   │   └── types/
│   └── data/                    Persistent JSON data and cache
└── client/                      React + Material UI frontend
    └── src/
        ├── pages/
        │   ├── DashboardPage.tsx
        │   ├── WatchHistoryPage.tsx
        │   ├── UnusedMediaPage.tsx
        │   ├── MarkedForRemovalPage.tsx
        │   └── SettingsPage.tsx
        ├── components/
        │   ├── MediaTable.tsx
        │   ├── NowPlaying.tsx
        │   ├── RecentlyWatched.tsx
        │   ├── QueryPanel.tsx
        │   └── ExcludeManager.tsx
        ├── services/
        │   └── api.ts
        └── utils/
            └── removalCache.ts
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dashboard` | Library statistics |
| `GET` | `/api/dashboard/library-growth` | Library growth data |
| `GET` | `/api/media` | Unused media items with filters |
| `GET` | `/api/media/options` | Get saved unused media query options |
| `PUT` | `/api/media/options` | Save unused media query options |
| `GET` | `/api/media/requesters` | List known media requesters |
| `GET` | `/api/excluded` | Excluded items list |
| `POST` | `/api/excluded` | Add item to exclude list |
| `DELETE` | `/api/excluded/:id` | Remove one excluded item |
| `DELETE` | `/api/excluded` | Clear all excluded items |
| `GET` | `/api/cache` | Cache stats by report |
| `DELETE` | `/api/cache` | Clear all cache |
| `DELETE` | `/api/cache/:report` | Clear one report cache |
| `GET` | `/api/settings` | Get app settings |
| `PUT` | `/api/settings` | Update app settings |
| `GET` | `/api/sessions/now-playing` | Active Jellyfin playback sessions |
| `GET` | `/api/watch-history` | Paginated watch history with `offset`, `limit`, and `users` query params |
| `GET` | `/api/users` | Jellyfin user list |
| `GET` | `/api/proxy/image` | Proxy Jellyfin item images |
| `GET` | `/api/discord/marked-for-removal` | List marked-for-removal media |
| `POST` | `/api/discord/mark-for-removal` | Create a Discord removal notice |
| `PATCH` | `/api/discord/mark-for-removal/:id/removed` | Mark a removal item as removed |
| `DELETE` | `/api/discord/mark-for-removal/:id` | Delete the Discord removal notice and local mark |
| `POST` | `/api/discord/intro-message` | Send or update the pinned Discord intro message |
| `GET` | `/api/health` | Health check |
