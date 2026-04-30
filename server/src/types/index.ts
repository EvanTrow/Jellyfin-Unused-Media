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
	CommunityRating?: number;
	RunTimeTicks?: number;
	ImageTags?: { Primary?: string; Thumb?: string };
	ProviderIds?: { Tmdb?: string; Tvdb?: string; [key: string]: string | undefined };
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
