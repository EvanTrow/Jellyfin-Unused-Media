# Jellyfin Unused Media

A web tool to find movies and TV shows in your Jellyfin library that have **never been played by any user**.

## Features

- 🎬 Query unplayed **movies** and **TV shows** (episodes rolled up to series level)
- 📅 Filter by **date added to library** range
- 🚫 **Exclude list** – permanently hide specific items from results (persisted to disk)
- 🌙 Light/dark mode
- 🔍 Client-side result filtering/sorting

## Setup

### 1. Get a Jellyfin API Key

In Jellyfin: **Dashboard → API Keys → + (New Key)**

### 2. Configure Environment

Copy the example env file and fill in your details:

```bash
cp .env.example server/.env
```

Edit `server/.env`:
```env
JELLYFIN_URL=http://your-jellyfin-server:8096
JELLYFIN_API_KEY=your_api_key_here
PORT=3001
```

### 3. Install Dependencies

```bash
npm run install:all
```

### 4. Run in Development

```bash
npm run dev
```

- **Client**: http://localhost:3000
- **Server API**: http://localhost:3001

### 5. Build for Production

```bash
npm run build
npm start
```

The server will serve the React app at http://localhost:3001.

## How It Works

1. Fetches all users from Jellyfin
2. For each user, collects their played movies and played episodes
3. Any movie played by **at least one user** is considered watched
4. Any series with **at least one played episode** by any user is considered watched  
5. Returns only items with **zero plays across all users**
6. Items in the exclude list are always hidden from results

## Project Structure

```
├── server/         Express + TypeScript API
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   └── services/
│   └── data/
│       └── excluded.json   (auto-created, persisted)
└── client/         React + MUI frontend
    └── src/
        ├── components/
        └── services/
```
