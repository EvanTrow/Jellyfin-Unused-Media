import { Box, Card, CardActionArea, CardHeader, Divider, Skeleton, Typography, Avatar, Stack, Chip } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import PersonIcon from '@mui/icons-material/Person';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchWatchHistory } from '../services/api';
import { WatchHistoryItem } from '../types';

const LIMIT = 5;

function formatDateTime(dateStr: string): string {
	return new Date(dateStr).toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
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

function HistoryRow({ item, onClick }: { item: WatchHistoryItem; onClick: () => void }) {
	const title = buildTitle(item);
	const subtitle = buildSubtitle(item);

	return (
		<CardActionArea onClick={onClick}>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1.5,
					py: 1.25,
					px: 2,
					borderBottom: 1,
					borderColor: 'divider',
					'&:last-child': { borderBottom: 0 },
				}}
			>
				<Avatar variant='rounded' src={item.imageUrl ?? undefined} alt={title} sx={{ width: 52, height: 40, flexShrink: 0, bgcolor: 'action.hover' }}>
					{item.itemType === 'Movie' ? <MovieIcon fontSize='small' /> : <TvIcon fontSize='small' />}
				</Avatar>

				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Typography variant='body2' fontWeight={600} noWrap title={title}>
						{title}
					</Typography>
					{subtitle && (
						<Typography variant='caption' color='text.secondary' noWrap>
							{subtitle}
						</Typography>
					)}
				</Box>

				<Stack direction='row' spacing={0.5} alignItems='center' sx={{ flexShrink: 0, display: { xs: 'none', sm: 'flex' } }}>
					<Chip size='small' icon={item.itemType === 'Movie' ? <MovieIcon /> : <TvIcon />} label={item.itemType} variant='outlined' sx={{ fontSize: '0.68rem' }} />
				</Stack>

				<Box
					sx={{
						display: { xs: 'none', md: 'flex' },
						alignItems: 'center',
						gap: 0.5,
						flexShrink: 0,
						minWidth: 90,
					}}
				>
					<PersonIcon fontSize='small' color='action' />
					<Typography variant='caption' noWrap>
						{item.userName}
					</Typography>
				</Box>

				<Typography variant='caption' color='text.secondary' sx={{ flexShrink: 0, display: { xs: 'none', lg: 'block' }, minWidth: 110, textAlign: 'right' }}>
					{formatDateTime(item.playbackStartDate)}
				</Typography>

				<ChevronRightIcon fontSize='small' color='action' sx={{ flexShrink: 0 }} />
			</Box>
		</CardActionArea>
	);
}

function RowSkeleton() {
	return (
		<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, px: 2, borderBottom: 1, borderColor: 'divider' }}>
			<Skeleton variant='rounded' width={52} height={40} sx={{ flexShrink: 0 }} />
			<Box sx={{ flex: 1 }}>
				<Skeleton width='55%' />
				<Skeleton width='35%' />
			</Box>
			<Skeleton width={70} sx={{ display: { xs: 'none', sm: 'block' } }} />
			<Skeleton width={90} sx={{ display: { xs: 'none', md: 'block' } }} />
			<Skeleton width={110} sx={{ display: { xs: 'none', lg: 'block' } }} />
		</Box>
	);
}

export default function RecentlyWatched() {
	const navigate = useNavigate();

	const { data, isLoading, error } = useQuery({
		queryKey: ['watchHistory-recent'],
		queryFn: () => fetchWatchHistory({ users: [], offset: 0, limit: LIMIT }),
		staleTime: 60_000,
	});

	const goToHistory = () => navigate('/reports/watch-history');

	if (error) return null;

	const items = data?.items ?? [];

	return (
		<Card variant='outlined' sx={{ mb: 3 }}>
			<CardActionArea onClick={goToHistory}>
				<CardHeader
					avatar={<HistoryIcon color='primary' />}
					title={
						<Typography variant='subtitle1' fontWeight={700}>
							Recently Watched
						</Typography>
					}
					action={
						<Box sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
							<Typography variant='caption' color='text.secondary' sx={{ mr: 0.5 }}>
								View all
							</Typography>
							<ChevronRightIcon fontSize='small' color='action' />
						</Box>
					}
					sx={{ pb: 1 }}
				/>
			</CardActionArea>
			<Divider />

			{isLoading && Array.from({ length: LIMIT }).map((_, i) => <RowSkeleton key={i} />)}

			{!isLoading && items.length === 0 && (
				<Box sx={{ py: 4, textAlign: 'center' }}>
					<HistoryIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
					<Typography variant='body2' color='text.secondary'>
						No watch history yet.
					</Typography>
				</Box>
			)}

			{items.map((item, idx) => (
				<HistoryRow key={`${item.userId}-${item.itemId}-${item.playbackStartDate}-${idx}`} item={item} onClick={goToHistory} />
			))}
		</Card>
	);
}
