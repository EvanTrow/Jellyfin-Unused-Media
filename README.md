# Jellyfin Reports

A web-based reporting dashboard for your Jellyfin media server. Browse library statistics, find unwatched media, and manage an exclusion list — all in one place.

## Features

### 📊 Dashboard
- Per-library counts of **movies**, **series**, **seasons**, and **episodes**
- Combined totals across all libraries

### 🎬 Unused Media Report
- Query all **movies** and **TV shows** — episodes rolled up to series level
- Toggle to show only **unwatched** items
- Filter by **date added to library** range
- Includes **last watched by** user and date
- Optional **Overseerr / Jellyseerr** integration — shows who originally requested each item
- **Exclude list** – permanently hide specific titles from results (persisted to disk)
- Client-side search, sort, and filtering

### 🎨 UI
- Left sidebar navigation with **Dashboard** and **Reports** sections
- Light / dark mode (follows system preference)
- Poster thumbnails, genre chips, expandable overviews

## Setup

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

> **Overseerr / Jellyseerr** — if `OVERSEERR_URL` and `OVERSEERR_API_KEY` are not set the app works normally; the "Requested By" column simply shows `—`.  
> Generate the API key in Overseerr/Jellyseerr: **Settings → General → API Key**

### 3. Install Dependencies

```bash
npm run install:all
```

### 4. Run in Development

```bash
npm run dev
```

- **App (client)**: http://localhost:3000
- **API (server)**: http://localhost:3001

### 5. Build for Production

```bash
npm run build
npm start
```

The server serves the compiled React app at http://localhost:3001.

## How It Works

### Library Stats (Dashboard)
1. Calls Jellyfin `/Library/VirtualFolders` to list all libraries
2. For each library, queries item counts by type (Movie, Series, Season, Episode)

### Unused Media Report
1. Fetches all Jellyfin users
2. For each user, collects played movies and played episodes
3. A **movie** is "watched" if any user has played it
4. A **series** is "watched" if any user has played at least one episode
5. Returns **all** items with a `watched` flag — toggle the "Unwatched only" switch to filter
6. If Overseerr is configured, fetches all requests and matches by TMDB ID to show the requester
7. Items in the exclude list are always hidden from results

## Project Structure

```
├── server/                   Express + TypeScript API
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── dashboard.ts  GET /api/dashboard
│   │   │   ├── media.ts      GET /api/media
│   │   │   └── excluded.ts   CRUD /api/excluded
│   │   ├── services/
│   │   │   ├── jellyfin.ts   Jellyfin API logic
│   │   │   └── overseerr.ts  Overseerr / Jellyseerr integration
│   │   └── types/
│   └── data/
│       └── excluded.json     Auto-created, persisted exclude list
└── client/                   React + Material UI frontend
    └── src/
        ├── pages/
        │   ├── DashboardPage.tsx
        │   └── UnusedMediaPage.tsx
        ├── components/
        │   ├── MediaTable.tsx
        │   ├── QueryPanel.tsx
        │   └── ExcludeManager.tsx
        └── services/
            └── api.ts
```
