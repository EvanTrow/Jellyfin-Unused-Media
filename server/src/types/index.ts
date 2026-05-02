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
	noActivityWithin?: NoActivityWithinFilter;
	excludeRequesters?: string[];
}

export type NoActivityWithinFilter = '' | '1m' | '2m' | '3m' | '6m' | '1y' | '18m' | 'never';

export interface UnusedMediaOptions {
	startDate: string | null;
	endDate: string | null;
	includeMovies: boolean;
	includeShows: boolean;
	showUnwatchedOnly: boolean;
	noActivityWithin: NoActivityWithinFilter;
	excludeRequesters: string[];
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
	SeasonName?: string;
	IndexNumber?: number;
	ParentIndexNumber?: number;
	DateCreated?: string;
	ProductionYear?: number;
	Overview?: string;
	Genres?: string[];
	OfficialRating?: string;
	CriticRating?: number;
	CommunityRating?: number;
	RunTimeTicks?: number;
	Size?: number;
	ImageTags?: { Primary?: string; Thumb?: string };
	ProviderIds?: { Tmdb?: string; Tvdb?: string; [key: string]: string | undefined };
	MediaSources?: { Size?: number }[];
	UserData?: {
		LastPlayedDate?: string;
		PlayCount?: number;
		Played?: boolean;
		PlaybackPositionTicks?: number;
	};
}

export interface PlaybackReportingQueryResult {
	colums: string[]; // note: plugin typo is intentional
	results: (string | number | null)[][];
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

export interface JellyfinQueryResult {
	Items: JellyfinItem[];
	TotalRecordCount: number;
}

export interface JellyfinVirtualFolder {
	Name: string;
	CollectionType: string;
	ItemId: string;
	Locations: string[];
}

// ---- Sessions / Now Playing ----

export interface JellyfinSession {
	Id: string;
	UserId: string;
	UserName?: string;
	Client?: string;
	DeviceName?: string;
	RemoteEndPoint?: string;
	LastPlaybackCheckIn?: string;
	NowPlayingItem?: JellyfinNowPlayingItem;
	PlayState?: JellyfinPlayState;
	TranscodingInfo?: JellyfinTranscodingInfo;
	AdditionalUsers?: { UserId: string; UserName: string }[];
}

export interface JellyfinNowPlayingItem {
	Id: string;
	Name: string;
	Type: string;
	SeriesName?: string;
	SeasonName?: string;
	IndexNumber?: number;
	ParentIndexNumber?: number;
	ProductionYear?: number;
	Overview?: string;
	RunTimeTicks?: number;
	Genres?: string[];
	ImageTags?: { Primary?: string; Thumb?: string };
}

export interface JellyfinPlayState {
	PositionTicks?: number;
	IsPaused?: boolean;
	IsMuted?: boolean;
	PlayMethod?: 'Transcode' | 'DirectStream' | 'DirectPlay';
	MediaSourceId?: string;
}

export interface JellyfinTranscodingInfo {
	AudioCodec?: string;
	VideoCodec?: string;
	IsVideoDirect?: boolean;
	IsAudioDirect?: boolean;
	Framerate?: number;
	Bitrate?: number;
	TranscodeReasons?: string[];
	VideoDecoder?: string;
	VideoDecoderIsHardware?: boolean;
	VideoEncoder?: string;
	VideoEncoderIsHardware?: boolean;
	Width?: number;
	Height?: number;
}

export interface NowPlayingSession {
	sessionId: string;
	userName: string;
	userId: string;
	client: string;
	deviceName: string;
	remoteEndPoint: string;
	nowPlaying: {
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
	};
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
