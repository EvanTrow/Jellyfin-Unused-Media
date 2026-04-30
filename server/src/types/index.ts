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

export interface PlayRecord {
userName: string;
date: string;
}

export interface ExcludedItem {
id: string;
name: string;
type: 'Movie' | 'Series';
dateExcluded: string;
}

export interface QueryOptions {
startDate?: string;
endDate?: string;
includeMovies: boolean;
includeShows: boolean;
}

export interface JellyfinUser {
Id: string;
Name: string;
}

export interface JellyfinItem {
Id: string;
Name: string;
Type: string;
SeriesId?: string;
SeriesName?: string;
DateCreated?: string;
ProductionYear?: number;
Overview?: string;
Genres?: string[];
OfficialRating?: string;
CommunityRating?: number;
RunTimeTicks?: number;
ImageTags?: { Primary?: string };
UserData?: {
LastPlayedDate?: string;
PlayCount?: number;
};
}

export interface JellyfinQueryResult {
Items: JellyfinItem[];
TotalRecordCount: number;
}
