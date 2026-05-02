export interface MediaItem {
	id: string;
	name: string;
	type: 'Movie' | 'Series';
	watched: boolean;
	dateAdded: string | null;
	year: number | null;
	genres: string[];
	runtimeMinutes: number | null;
	criticRating: number | null;
	communityRating: number | null;
	overview: string | null;
	imageUrl: string | null;
	requestedBy: string | null;
	lastWatchedBy: string | null;
	lastWatchedDate: string | null;
	jellyfinUrl: string | null;
	markedForRemoval?: MarkedRemovalSummary;
}

export interface RemovalReactionSummary {
	thumbsUp: number;
	thumbsDown: number;
	updatedAt: string;
}

export interface RemovalDiscordMentions {
	requestedBy?: string;
	lastWatchedBy?: string;
}

export interface MarkedRemovalSummary {
	removeAt: string;
	markedAt: string;
	status: 'Pending' | 'removed';
	reactions?: RemovalReactionSummary;
}

export interface MarkedRemovalItem extends MarkedRemovalSummary {
	id: string;
	name: string;
	type: 'Movie' | 'Series';
	jellyfinUrl: string | null;
	requestedBy?: string | null;
	lastWatchedBy?: string | null;
	discordMentions?: RemovalDiscordMentions;
	discordMessageId?: string;
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
	showUnwatchedOnly: boolean;
	noActivityWithin: NoActivityWithinFilter;
	excludeRequesters: string[];
}

export type NoActivityWithinFilter = '' | '1m' | '2m' | '3m' | '6m' | '1y' | '18m' | 'never';

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

export interface LibraryGrowthPoint {
	date: string; // YYYY-MM-DD
	movies: number; // cumulative bytes
	series: number; // cumulative bytes
	total: number; // cumulative bytes
}

export type SortDirection = 'asc' | 'desc';
export type SortField = 'name' | 'type' | 'dateAdded' | 'year' | 'criticRating' | 'communityRating' | 'watched' | 'requestedBy' | 'lastWatchedBy' | 'lastWatchedDate';

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

export interface JellyfinUser {
	id: string;
	name: string;
}

export interface WatchHistoryItem {
	itemId: string;
	itemType: 'Movie' | 'Episode';
	name: string;
	seriesName: string | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
	year: number | null;
	runtimeMinutes: number | null;
	imageUrl: string | null;
	userName: string;
	userId: string;
	playbackStartDate: string;
	playbackDurationMinutes: number;
}

export interface WatchHistoryParams {
	users: string[]; // user IDs
}

export interface WatchHistoryPage {
	items: WatchHistoryItem[];
	totalCount: number;
	hasMore: boolean;
}
