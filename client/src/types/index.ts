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
	requestedBy: string | null;
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

export interface LibraryStats {
	id: string;
	name: string;
	collectionType: string;
	movies: number;
	series: number;
	seasons: number;
	episodes: number;
}

export interface DashboardStats {
	libraries: LibraryStats[];
	totals: {
		movies: number;
		series: number;
		seasons: number;
		episodes: number;
	};
}

export type SortDirection = 'asc' | 'desc';
export type SortField = 'name' | 'type' | 'dateAdded' | 'year' | 'watched' | 'requestedBy' | 'lastWatchedBy' | 'lastWatchedDate';

export interface NowPlayingItem {
	id: string;
	name: string;
	type: string;
	seriesName: string | null;
	seasonName: string | null;
	episodeNumber: number | null;
	seasonNumber: number | null;
	year: number | null;
	overview: string | null;
	imageUrl: string | null;
	runtimeTicks: number;
}

export interface NowPlayingSession {
	sessionId: string;
	userName: string;
	userId: string;
	client: string;
	deviceName: string;
	remoteEndPoint: string;
	nowPlaying: NowPlayingItem;
	positionTicks: number;
	isPaused: boolean;
	playMethod: string;
	isVideoDirect: boolean;
	isAudioDirect: boolean;
	videoCodec: string | null;
	audioCodec: string | null;
	transcodeReasons: string[];
	bitrate: number | null;
	framerate: number | null;
	additionalUsers: string[];
}
