import React from 'react';
import {
	Box,
	Card,
	CardContent,
	Typography,
	Divider,
	CircularProgress,
	Alert,
	Autocomplete,
	TextField,
	Avatar,
	Chip,
	Skeleton,
	Stack,
} from '@mui/material';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import HistoryIcon from '@mui/icons-material/History';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { fetchWatchHistory, fetchUsers } from '../services/api';
import { JellyfinUser, WatchHistoryItem } from '../types';

const PAGE_SIZE = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string): string {
	return new Date(dateStr).toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function formatDuration(minutes: number): string {
	if (minutes < 60) return `${minutes}m`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatRuntime(minutes: number | null): string {
	if (minutes == null) return '—';
	return formatDuration(minutes);
}

function buildTitle(item: WatchHistoryItem): string {
	if (item.itemType === 'Episode' && item.seriesName) {
		const season = item.seasonNumber != null ? `S${String(item.seasonNumber).padStart(2, '0')}` : '';
		const episode = item.episodeNumber != null ? `E${String(item.episodeNumber).padStart(2, '0')}` : '';
		const se = season || episode ? ` · ${season}${episode}` : '';
		return `${item.seriesName}${se}`;
	}
	return item.name;
}

function buildSubtitle(item: WatchHistoryItem): string | null {
	if (item.itemType === 'Episode') return item.name;
	return null;
}

// ─── Single history row ───────────────────────────────────────────────────────

function HistoryRow({ item }: { item: WatchHistoryItem }) {
	const title = buildTitle(item);
	const subtitle = buildSubtitle(item);

	return (
		<Box
			sx={{
				display: 'flex',
				alignItems: 'center',
				gap: 2,
				py: 1.5,
				px: 2,
				borderBottom: 1,
				borderColor: 'divider',
				'&:last-child': { borderBottom: 0 },
			}}
		>
			{/* Thumbnail */}
			<Avatar
				variant='rounded'
				src={item.imageUrl ?? undefined}
				alt={title}
				sx={{ width: 64, height: 48, flexShrink: 0, bgcolor: 'action.hover' }}
			>
				{item.itemType === 'Movie' ? <MovieIcon /> : <TvIcon />}
			</Avatar>

			{/* Title / subtitle */}
			<Box sx={{ flex: 1, minWidth: 0 }}>
				<Typography variant='body2' fontWeight={600} noWrap title={title}>
					{title}
				</Typography>
				{subtitle && (
					<Typography variant='caption' color='text.secondary' noWrap title={subtitle}>
						{subtitle}
					</Typography>
				)}
			</Box>

			{/* Chips: type, year, runtime */}
			<Stack direction='row' spacing={0.5} sx={{ flexShrink: 0, display: { xs: 'none', sm: 'flex' } }}>
				<Chip
					size='small'
					icon={item.itemType === 'Movie' ? <MovieIcon /> : <TvIcon />}
					label={item.itemType}
					variant='outlined'
					sx={{ fontSize: '0.7rem' }}
				/>
				{item.year && (
					<Chip size='small' label={item.year} variant='outlined' sx={{ fontSize: '0.7rem' }} />
				)}
				{item.runtimeMinutes != null && (
					<Chip
						size='small'
						icon={<AccessTimeIcon />}
						label={formatRuntime(item.runtimeMinutes)}
						variant='outlined'
						sx={{ fontSize: '0.7rem' }}
					/>
				)}
			</Stack>

			{/* User */}
			<Box
				sx={{
					display: { xs: 'none', md: 'flex' },
					alignItems: 'center',
					gap: 0.5,
					flexShrink: 0,
					minWidth: 100,
				}}
			>
				<PersonIcon fontSize='small' color='action' />
				<Typography variant='caption' noWrap>
					{item.userName}
				</Typography>
			</Box>

			{/* Start date */}
			<Box sx={{ display: { xs: 'none', lg: 'block' }, flexShrink: 0, minWidth: 140, textAlign: 'right' }}>
				<Typography variant='caption' color='text.secondary'>
					{formatDateTime(item.playbackStartDate)}
				</Typography>
			</Box>

			{/* Playback duration */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 0.5,
					flexShrink: 0,
					minWidth: 56,
					justifyContent: 'flex-end',
				}}
			>
				<PlayArrowIcon fontSize='small' color='action' />
				<Typography variant='caption' fontWeight={600}>
					{formatDuration(item.playbackDurationMinutes)}
				</Typography>
			</Box>
		</Box>
	);
}

function HistoryRowSkeleton() {
	return (
		<Box
			sx={{
				display: 'flex',
				alignItems: 'center',
				gap: 2,
				py: 1.5,
				px: 2,
				borderBottom: 1,
				borderColor: 'divider',
			}}
		>
			<Skeleton variant='rounded' width={64} height={48} sx={{ flexShrink: 0 }} />
			<Box sx={{ flex: 1 }}>
				<Skeleton width='60%' />
				<Skeleton width='40%' />
			</Box>
			<Skeleton width={80} sx={{ display: { xs: 'none', sm: 'block' } }} />
			<Skeleton width={100} sx={{ display: { xs: 'none', md: 'block' } }} />
			<Skeleton width={140} sx={{ display: { xs: 'none', lg: 'block' } }} />
			<Skeleton width={56} />
		</Box>
	);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WatchHistoryPage() {
	const [selectedUsers, setSelectedUsers] = React.useState<JellyfinUser[]>([]);
	// Debounced user IDs that actually drive the query
	const [filterUsers, setFilterUsers] = React.useState<string[]>([]);

	React.useEffect(() => {
		const id = setTimeout(() => setFilterUsers(selectedUsers.map((u) => u.id)), 300);
		return () => clearTimeout(id);
	}, [selectedUsers]);

	// Fetch user list for autocomplete
	const { data: users = [] } = useQuery({
		queryKey: ['users'],
		queryFn: fetchUsers,
		staleTime: 5 * 60 * 1000,
	});

	// Infinite query for watch history — always enabled
	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		isFetching,
		error,
	} = useInfiniteQuery({
		queryKey: ['watchHistory', filterUsers],
		queryFn: ({ pageParam }) =>
			fetchWatchHistory({
				users: filterUsers,
				offset: pageParam as number,
				limit: PAGE_SIZE,
			}),
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
			return loaded < lastPage.totalCount ? loaded : undefined;
		},
	});

	// Flatten all pages
	const allItems = React.useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
	const totalCount = data?.pages[0]?.totalCount ?? 0;

	// Sentinel ref for infinite scroll
	const sentinelRef = React.useRef<HTMLDivElement>(null);
	React.useEffect(() => {
		const el = sentinelRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
					fetchNextPage();
				}
			},
			{ rootMargin: '200px' }
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	const errorMsg = error
		? ((error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
				(error instanceof Error ? error.message : 'Query failed'))
		: null;

	const isFirstLoad = isLoading && !isFetchingNextPage;

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
			{/* Filter panel */}
			<Card>
				<CardContent sx={{ p: { xs: 2, sm: 3 } }}>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
						<HistoryIcon color='primary' />
						<Typography variant='h6' fontWeight={600}>
							Watch History
						</Typography>
						{isFetching && !isFetchingNextPage && (
							<CircularProgress size={18} sx={{ ml: 1 }} />
						)}
						{!isFirstLoad && totalCount > 0 && (
							<Chip
								label={`${allItems.length.toLocaleString()} of ${totalCount.toLocaleString()} record${totalCount !== 1 ? 's' : ''}`}
								color='primary'
								variant='outlined'
								size='small'
								sx={{ ml: 'auto' }}
							/>
						)}
					</Box>
					<Divider sx={{ mb: 2 }} />

					{/* User multi-select */}
					<Autocomplete
						multiple
						options={users}
						getOptionLabel={(u) => u.name}
						isOptionEqualToValue={(a, b) => a.id === b.id}
						value={selectedUsers}
						onChange={(_, value) => setSelectedUsers(value)}
						renderInput={(params) => (
							<TextField {...params} label='Filter by user' placeholder={selectedUsers.length === 0 ? 'All users' : ''} size='small' />
						)}
						renderTags={(value, getTagProps) =>
							value.map((u, index) => {
								const { key, ...tagProps } = getTagProps({ index });
								return <Chip key={key} label={u.name} size='small' {...tagProps} />;
							})
						}
						sx={{ minWidth: 260, maxWidth: 480 }}
					/>

					{errorMsg && (
						<Alert severity='error' sx={{ mt: 2 }}>
							{errorMsg}
						</Alert>
					)}
				</CardContent>
			</Card>

			{/* Results */}
			<Card>
					{/* Column header */}
					<Box
						sx={{
							display: { xs: 'none', sm: 'flex' },
							alignItems: 'center',
							gap: 2,
							px: 2,
							py: 1,
							bgcolor: 'action.hover',
							borderBottom: 1,
							borderColor: 'divider',
						}}
					>
						<Box sx={{ width: 64, flexShrink: 0 }} />
						<Typography variant='caption' color='text.secondary' fontWeight={600} sx={{ flex: 1 }}>
							TITLE
						</Typography>
						<Typography
							variant='caption'
							color='text.secondary'
							fontWeight={600}
							sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 170 }}
						>
							TYPE / YEAR / RUNTIME
						</Typography>
						<Typography
							variant='caption'
							color='text.secondary'
							fontWeight={600}
							sx={{ display: { xs: 'none', md: 'block' }, minWidth: 100 }}
						>
							USER
						</Typography>
						<Typography
							variant='caption'
							color='text.secondary'
							fontWeight={600}
							sx={{ display: { xs: 'none', lg: 'block' }, minWidth: 140, textAlign: 'right' }}
						>
							STARTED
						</Typography>
						<Typography variant='caption' color='text.secondary' fontWeight={600} sx={{ minWidth: 56, textAlign: 'right' }}>
							WATCHED
						</Typography>
					</Box>

					{/* Skeleton rows while loading */}
					{isFirstLoad &&
						Array.from({ length: 10 }).map((_, i) => <HistoryRowSkeleton key={i} />)}

					{/* Actual rows */}
					{!isFirstLoad && allItems.map((item, idx) => (
						<HistoryRow key={`${item.userId}-${item.itemId}-${item.playbackStartDate}-${idx}`} item={item} />
					))}

					{/* Empty state */}
					{!isFirstLoad && allItems.length === 0 && !isLoading && (
						<Box sx={{ py: 6, textAlign: 'center' }}>
							<HistoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
							<Typography color='text.secondary'>No watch history found.</Typography>
						</Box>
					)}

					{/* Load-more sentinel */}
					<Box ref={sentinelRef} sx={{ py: 1 }} />

					{/* Fetching next page indicator */}
					{isFetchingNextPage && (
						<Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
							<CircularProgress size={24} />
						</Box>
					)}

					{/* End-of-list message */}
					{!hasNextPage && allItems.length > 0 && !isFetchingNextPage && (
						<Box sx={{ py: 2, textAlign: 'center' }}>
							<Typography variant='caption' color='text.secondary'>
								All {totalCount.toLocaleString()} records loaded
							</Typography>
						</Box>
					)}
				</Card>
		</Box>
	);
}
