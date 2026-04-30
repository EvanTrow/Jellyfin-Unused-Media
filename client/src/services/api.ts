import axios from 'axios';
import { DashboardStats, ExcludedItem, MediaItem, QueryParams } from '../types';

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
