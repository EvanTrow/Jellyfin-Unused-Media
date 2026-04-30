export interface MediaItem {
id: string;
name: string;
type: 'Movie' | 'Series';
watched: boolean;
dateAdded: string | null;
year: number | null;
genres: string[];
runtimeMinutes: number | null;
overview: string | null;
imageUrl: string | null;
lastWatchedBy: string | null;
lastWatchedDate: string | null;
}

export interface ExcludedItem {
id: string;
name: string;
type: 'Movie' | 'Series';
dateExcluded: string;
}

export interface QueryParams {
startDate: string | null;
endDate: string | null;
includeMovies: boolean;
includeShows: boolean;
}

export interface QueryResult {
items: MediaItem[];
totalCount: number;
}

export type SortDirection = 'asc' | 'desc';
export type SortField = 'name' | 'type' | 'dateAdded' | 'year' | 'watched' | 'lastWatchedBy' | 'lastWatchedDate';
