import axios from 'axios';
import { DashboardStats, ExcludedItem, JellyfinUser, MediaItem, QueryParams, WatchHistoryPage, WatchHistoryParams } from '../types';

const api = axios.create({ baseURL: '/api' });

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await api.get('/dashboard');
  return response.data;
}

export async function fetchUnplayedMedia(
  params: QueryParams
): Promise<{ items: MediaItem[]; totalCount: number }> {
  const queryParams: Record<string, string> = {
    includeMovies: String(params.includeMovies),
    includeShows: String(params.includeShows),
  };
  if (params.startDate) queryParams.startDate = params.startDate;
  if (params.endDate) queryParams.endDate = params.endDate;
  const response = await api.get('/media', { params: queryParams });
  return response.data;
}

export async function fetchExcluded(): Promise<ExcludedItem[]> {
  const response = await api.get('/excluded');
  return response.data;
}

export async function addExcluded(
  item: Pick<MediaItem, 'id' | 'name' | 'type'>
): Promise<ExcludedItem> {
  const response = await api.post('/excluded', item);
  return response.data;
}

export async function removeExcluded(id: string): Promise<void> {
  await api.delete(`/excluded/${id}`);
}

export async function clearExcluded(): Promise<void> {
  await api.delete('/excluded');
}

export async function clearServerCache(): Promise<void> {
  await api.delete('/cache');
}

export async function clearServerCacheReport(report: string): Promise<void> {
  await api.delete(`/cache/${report}`);
}

export interface AppSettings {
  cacheTtlHours: number;
}

export async function fetchSettings(): Promise<AppSettings> {
  const response = await api.get<AppSettings>('/settings');
  return response.data;
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const response = await api.put<AppSettings>('/settings', settings);
  return response.data;
}

export async function fetchNowPlaying(): Promise<import('../types').NowPlayingSession[]> {
  const response = await api.get('/sessions/now-playing');
  return response.data;
}

export async function fetchUsers(): Promise<JellyfinUser[]> {
  const response = await api.get<JellyfinUser[]>('/users');
  return response.data;
}

export async function fetchWatchHistory(
  params: WatchHistoryParams & { offset: number; limit?: number }
): Promise<WatchHistoryPage> {
  const queryParams: Record<string, string> = {
    offset: String(params.offset),
    limit: String(params.limit ?? 50),
  };
  if (params.users.length > 0) queryParams.users = params.users.join(',');
  const response = await api.get<WatchHistoryPage>('/watch-history', { params: queryParams });
  return response.data;
}
