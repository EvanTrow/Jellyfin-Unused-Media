import axios, { AxiosInstance } from 'axios';
import {
  JellyfinUser, JellyfinItem, JellyfinQueryResult, JellyfinVirtualFolder,
  MediaItem, PlayRecord, QueryOptions, DashboardStats, LibraryStats,
} from '../types';
import { getOverseerrRequests } from './overseerr';

function createJellyfinClient(): AxiosInstance {
  const baseURL = process.env.JELLYFIN_URL || 'http://localhost:8096';
  const apiKey = process.env.JELLYFIN_API_KEY || '';
  return axios.create({
    baseURL,
    headers: {
      Authorization: `MediaBrowser Token="${apiKey}"`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

async function fetchAllItems(
  client: AxiosInstance,
  endpoint: string,
  params: Record<string, unknown>
): Promise<JellyfinItem[]> {
  const allItems: JellyfinItem[] = [];
  let startIndex = 0;
  const limit = 500;
  while (true) {
    const response = await client.get<JellyfinQueryResult>(endpoint, {
      params: { ...params, startIndex, limit },
    });
    const items = response.data.Items || [];
    allItems.push(...items);
    if (items.length === 0 || allItems.length >= response.data.TotalRecordCount) break;
    startIndex += limit;
  }
  return allItems;
}

async function fetchCount(
  client: AxiosInstance,
  params: Record<string, unknown>
): Promise<number> {
  const response = await client.get<JellyfinQueryResult>('/Items', {
    params: { ...params, limit: 0, enableTotalRecordCount: true },
  });
  return response.data.TotalRecordCount ?? 0;
}

function mergePlayRecord(
  map: Map<string, PlayRecord>,
  itemId: string,
  userName: string,
  lastPlayedDate: string | undefined
): void {
  if (!lastPlayedDate) return;
  const existing = map.get(itemId);
  if (!existing || lastPlayedDate > existing.date) {
    map.set(itemId, { userName, date: lastPlayedDate });
  }
}

export async function getUsers(): Promise<JellyfinUser[]> {
  const client = createJellyfinClient();
  const response = await client.get<JellyfinUser[]>('/Users');
  return response.data;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const client = createJellyfinClient();

  const foldersResponse = await client.get<JellyfinVirtualFolder[]>('/Library/VirtualFolders');
  const folders = foldersResponse.data ?? [];

  const libraries: LibraryStats[] = await Promise.all(
    folders.map(async (folder) => {
      const parentId = folder.ItemId;
      const base = { recursive: true, parentId, enableTotalRecordCount: true };
      const ct = (folder.CollectionType ?? '').toLowerCase();

      const [movies, series, seasons, episodes] = await Promise.all([
        ct === 'movies' || ct === 'mixed' ? fetchCount(client, { ...base, includeItemTypes: 'Movie' }) : Promise.resolve(0),
        ct === 'tvshows' || ct === 'mixed' ? fetchCount(client, { ...base, includeItemTypes: 'Series' }) : Promise.resolve(0),
        ct === 'tvshows' || ct === 'mixed' ? fetchCount(client, { ...base, includeItemTypes: 'Season' }) : Promise.resolve(0),
        ct === 'tvshows' || ct === 'mixed' ? fetchCount(client, { ...base, includeItemTypes: 'Episode' }) : Promise.resolve(0),
      ]);

      return { id: parentId, name: folder.Name, collectionType: folder.CollectionType ?? '', movies, series, seasons, episodes };
    })
  );

  const totals = libraries.reduce(
    (acc, lib) => ({
      movies: acc.movies + lib.movies,
      series: acc.series + lib.series,
      seasons: acc.seasons + lib.seasons,
      episodes: acc.episodes + lib.episodes,
    }),
    { movies: 0, series: 0, seasons: 0, episodes: 0 }
  );

  return { libraries, totals };
}

export async function getAllMedia(options: QueryOptions): Promise<MediaItem[]> {
  const { startDate, endDate, includeMovies, includeShows } = options;
  const client = createJellyfinClient();
  const jellyfinUrl = process.env.JELLYFIN_URL || 'http://localhost:8096';
  const apiKey = process.env.JELLYFIN_API_KEY || '';

  const overseerrMap = await getOverseerrRequests().catch((err) => {
    console.warn('Overseerr fetch failed, skipping:', (err as Error).message);
    return null;
  });

  const users = await getUsers();

  const playedMovieIds = new Set<string>();
  const playedSeriesIds = new Set<string>();
  const moviePlayRecords = new Map<string, PlayRecord>();
  const seriesPlayRecords = new Map<string, PlayRecord>();

  for (const user of users) {
    if (includeMovies) {
      const playedMovies = await fetchAllItems(client, `/Users/${user.Id}/Items`, {
        recursive: true, filters: 'IsPlayed', includeItemTypes: 'Movie', fields: 'UserData',
      });
      for (const item of playedMovies) {
        playedMovieIds.add(item.Id);
        mergePlayRecord(moviePlayRecords, item.Id, user.Name, item.UserData?.LastPlayedDate);
      }
    }
    if (includeShows) {
      const playedEpisodes = await fetchAllItems(client, `/Users/${user.Id}/Items`, {
        recursive: true, filters: 'IsPlayed', includeItemTypes: 'Episode', fields: 'SeriesId,UserData',
      });
      for (const item of playedEpisodes) {
        if (item.SeriesId) {
          playedSeriesIds.add(item.SeriesId);
          mergePlayRecord(seriesPlayRecords, item.SeriesId, user.Name, item.UserData?.LastPlayedDate);
        }
      }
    }
  }

  const results: MediaItem[] = [];
  const commonFields = 'DateCreated,Overview,Genres,ProductionYear,RunTimeTicks,ImageTags,ProviderIds';

  if (includeMovies) {
    const movies = await fetchAllItems(client, '/Items', {
      recursive: true, includeItemTypes: 'Movie', fields: commonFields,
      sortBy: 'SortName', sortOrder: 'Ascending',
    });
    for (const movie of movies) {
      if (!passesDateFilter(movie.DateCreated, startDate, endDate)) continue;
      const tmdbId = movie.ProviderIds?.Tmdb ? parseInt(movie.ProviderIds.Tmdb, 10) : undefined;
      const requestedBy = (overseerrMap && tmdbId != null) ? (overseerrMap.get(tmdbId) ?? null) : null;
      results.push(buildMediaItem(movie, 'Movie', jellyfinUrl, apiKey, playedMovieIds.has(movie.Id), requestedBy, moviePlayRecords.get(movie.Id)));
    }
  }

  if (includeShows) {
    const series = await fetchAllItems(client, '/Items', {
      recursive: true, includeItemTypes: 'Series', fields: commonFields,
      sortBy: 'SortName', sortOrder: 'Ascending',
    });
    for (const show of series) {
      if (!passesDateFilter(show.DateCreated, startDate, endDate)) continue;
      const tmdbId = show.ProviderIds?.Tmdb ? parseInt(show.ProviderIds.Tmdb, 10) : undefined;
      const requestedBy = (overseerrMap && tmdbId != null) ? (overseerrMap.get(tmdbId) ?? null) : null;
      results.push(buildMediaItem(show, 'Series', jellyfinUrl, apiKey, playedSeriesIds.has(show.Id), requestedBy, seriesPlayRecords.get(show.Id)));
    }
  }

  return results;
}

function passesDateFilter(dateCreated: string | undefined, startDate?: string, endDate?: string): boolean {
  if (!startDate && !endDate) return true;
  if (!dateCreated) return true;
  const itemDate = dateCreated.substring(0, 10);
  if (startDate && itemDate < startDate) return false;
  if (endDate && itemDate > endDate) return false;
  return true;
}

function buildMediaItem(
  item: JellyfinItem, type: 'Movie' | 'Series', jellyfinUrl: string, apiKey: string,
  watched: boolean, requestedBy: string | null, playRecord?: PlayRecord
): MediaItem {
  const imageUrl = item.ImageTags?.Primary
    ? `${jellyfinUrl}/Items/${item.Id}/Images/Primary?tag=${item.ImageTags.Primary}&maxWidth=120&api_key=${apiKey}`
    : null;
  return {
    id: item.Id, name: item.Name, type, watched,
    dateAdded: item.DateCreated ?? null, year: item.ProductionYear ?? null,
    genres: item.Genres ?? [],
    runtimeMinutes: item.RunTimeTicks != null ? Math.round(item.RunTimeTicks / 600000000) : null,
    overview: item.Overview ?? null, imageUrl, requestedBy,
    lastWatchedBy: playRecord?.userName ?? null, lastWatchedDate: playRecord?.date ?? null,
  };
}
