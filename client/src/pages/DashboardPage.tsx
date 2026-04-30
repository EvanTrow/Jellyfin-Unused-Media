import { Box, Card, CardContent, CardHeader, Grid, Typography, Chip, Divider, Skeleton, Alert, ToggleButton, ToggleButtonGroup } from '@mui/material';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats, fetchLibraryGrowth } from '../services/api';
import { LibraryGrowthPoint, LibraryStats } from '../types';
import NowPlaying from '../components/NowPlaying';
import RecentlyWatched from '../components/RecentlyWatched';
import { useState, useMemo } from 'react';
import { LineChart } from '@mui/x-charts/LineChart';

function collectionIcon(type: string) {
	const t = type.toLowerCase();
	if (t === 'movies') return <MovieIcon />;
	if (t === 'tvshows') return <TvIcon />;
	return <VideoLibraryIcon />;
}

function collectionLabel(type: string) {
	const t = type.toLowerCase();
	if (t === 'movies') return 'Movies';
	if (t === 'tvshows') return 'TV Shows';
	if (t === 'music') return 'Music';
	if (t === 'books') return 'Books';
	return type || 'Mixed';
}

function StatBadge({ label, value, color }: { label: string; value: number; color?: 'primary' | 'secondary' | 'default' }) {
	return (
		<Box sx={{ textAlign: 'center' }}>
			<Typography variant='h5' fontWeight={700} color={`${color ?? 'text'}.primary`}>
				{value.toLocaleString()}
			</Typography>
			<Typography variant='caption' color='text.secondary'>
				{label}
			</Typography>
		</Box>
	);
}

function LibraryCard({ lib }: { lib: LibraryStats }) {
	const isTV = lib.collectionType.toLowerCase() === 'tvshows';
	const isMovie = lib.collectionType.toLowerCase() === 'movies';

	return (
		<Card variant='outlined' sx={{ height: '100%' }}>
			<CardHeader
				avatar={collectionIcon(lib.collectionType)}
				title={lib.name}
				subheader={<Chip label={collectionLabel(lib.collectionType)} size='small' variant='outlined' sx={{ mt: 0.5 }} />}
				sx={{ pb: 1 }}
			/>
			<Divider />
			<CardContent>
				<Grid container spacing={2} justifyContent='space-around'>
					{(isMovie || !isTV) && lib.movies > 0 && (
						<Grid item xs={6} sm={3}>
							<StatBadge label='Movies' value={lib.movies} color='primary' />
						</Grid>
					)}
					{(isTV || !isMovie) && lib.series > 0 && (
						<Grid item xs={6} sm={3}>
							<StatBadge label='Series' value={lib.series} color='secondary' />
						</Grid>
					)}
					{lib.seasons > 0 && (
						<Grid item xs={6} sm={3}>
							<StatBadge label='Seasons' value={lib.seasons} />
						</Grid>
					)}
					{lib.episodes > 0 && (
						<Grid item xs={6} sm={3}>
							<StatBadge label='Episodes' value={lib.episodes} />
						</Grid>
					)}
					{lib.movies === 0 && lib.series === 0 && lib.seasons === 0 && lib.episodes === 0 && (
						<Grid item xs={12}>
							<Typography variant='body2' color='text.secondary' textAlign='center'>
								No media found
							</Typography>
						</Grid>
					)}
				</Grid>
			</CardContent>
		</Card>
	);
}

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
	'7d': '7 Days',
	'30d': '30 Days',
	'90d': '90 Days',
	'1y': '1 Year',
	all: 'All',
};

function filterByRange(data: LibraryGrowthPoint[], range: TimeRange): LibraryGrowthPoint[] {
	if (range === 'all') return data;
	const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - days);
	const cutoffStr = cutoff.toISOString().substring(0, 10);
	// Keep cumulative values intact and only show points from the selected range onward.
	return data.filter((p) => p.date >= cutoffStr);
}

function formatXAxisDate(date: string, range: TimeRange): string {
	const d = new Date(date + 'T00:00:00');
	if (range === '7d' || range === '30d') {
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
	return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / Math.pow(1024, i)).toFixed(i >= 3 ? 2 : 1)} ${units[i]}`;
}

function LibraryGrowthChart() {
	const [range, setRange] = useState<TimeRange>('all');

	const {
		data: rawData,
		isLoading,
		error,
	} = useQuery({
		queryKey: ['library-growth'],
		queryFn: fetchLibraryGrowth,
		staleTime: 1000 * 60 * 10, // 10 min
	});

	const chartData = useMemo(() => {
		if (!rawData) return [];
		return filterByRange(rawData, range) as { date: string; movies: number; series: number; total: number; [key: string]: string | number | null | undefined }[];
	}, [rawData, range]);

	return (
		<Card variant='outlined' sx={{ mb: 3 }}>
			<CardHeader
				title='Library Growth'
				subheader='Cumulative disk usage of items added to Jellyfin over time'
				action={
					<ToggleButtonGroup
						value={range}
						exclusive
						onChange={(_e, v) => {
							if (v) setRange(v as TimeRange);
						}}
						size='small'
						sx={{ mr: 1, mt: 0.5 }}
					>
						{(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((r) => (
							<ToggleButton key={r} value={r}>
								{TIME_RANGE_LABELS[r]}
							</ToggleButton>
						))}
					</ToggleButtonGroup>
				}
			/>
			<Divider />
			<CardContent>
				{isLoading && <Skeleton variant='rectangular' height={300} sx={{ borderRadius: 1 }} />}
				{error && <Alert severity='error'>Failed to load library growth data</Alert>}
				{!isLoading && !error && chartData.length === 0 && (
					<Typography variant='body2' color='text.secondary' textAlign='center'>
						No data available
					</Typography>
				)}
				{!isLoading && !error && chartData.length > 0 && (
					<LineChart
						height={300}
						series={[
							{ dataKey: 'total', label: 'Total', color: '#90caf9', showMark: false, valueFormatter: (v) => formatBytes(v ?? 0) },
							{ dataKey: 'movies', label: 'Movies', color: '#ce93d8', showMark: false, valueFormatter: (v) => formatBytes(v ?? 0) },
							{ dataKey: 'series', label: 'TV', color: '#80cbc4', showMark: false, valueFormatter: (v) => formatBytes(v ?? 0) },
						]}
						dataset={chartData}
						xAxis={[
							{
								dataKey: 'date',
								scaleType: 'band',
								valueFormatter: (d) => formatXAxisDate(d, range),
								tickLabelInterval: (_value, index) => {
									const step = Math.max(1, Math.floor(chartData.length / 8));
									return index % step === 0;
								},
							},
						]}
						yAxis={[{ valueFormatter: (v) => formatBytes(v ?? 0) }]}
						slotProps={{ legend: { hidden: false } }}
						margin={{ top: 8, right: 24, left: 80, bottom: 0 }}
						sx={{ width: '100%' }}
					/>
				)}
			</CardContent>
		</Card>
	);
}

export default function DashboardPage() {
	const {
		data: stats,
		isLoading,
		error,
	} = useQuery({
		queryKey: ['dashboard'],
		queryFn: fetchDashboardStats,
	});

	if (isLoading) {
		return (
			<Box>
				<Typography variant='h5' fontWeight={700} gutterBottom>
					Library Overview
				</Typography>
				<Grid container spacing={3}>
					{Array.from({ length: 4 }).map((_, i) => (
						<Grid item xs={12} md={6} key={i}>
							<Skeleton variant='rectangular' height={160} sx={{ borderRadius: 2 }} />
						</Grid>
					))}
				</Grid>
			</Box>
		);
	}

	if (error) {
		const axiosErr = error as { response?: { data?: { error?: string } } };
		const msg = axiosErr?.response?.data?.error ?? (error instanceof Error ? error.message : 'Failed to load');
		return <Alert severity='error'>{msg}</Alert>;
	}

	if (!stats) return null;

	const { libraries, totals } = stats;

	return (
		<Box>
			<Typography variant='h5' fontWeight={700} gutterBottom>
				Dashboard
			</Typography>

			{/* Now Playing */}
			<NowPlaying />

			{/* Recently Watched */}
			<RecentlyWatched />

			{/* Library Growth Chart */}
			<LibraryGrowthChart />

			<Typography variant='h6' fontWeight={700} gutterBottom>
				Library Overview
			</Typography>

			{/* Totals summary card */}
			<Card sx={{ mb: 3 }} variant='outlined'>
				<CardHeader avatar={<LibraryBooksIcon />} title='All Libraries' subheader={`${libraries.length} librar${libraries.length !== 1 ? 'ies' : 'y'}`} />
				<Divider />
				<CardContent>
					<Grid container spacing={2} justifyContent='space-around'>
						<Grid item xs={6} sm={3}>
							<StatBadge label='Movies' value={totals.movies} color='primary' />
						</Grid>
						<Grid item xs={6} sm={3}>
							<StatBadge label='Series' value={totals.series} color='secondary' />
						</Grid>
						<Grid item xs={6} sm={3}>
							<StatBadge label='Seasons' value={totals.seasons} />
						</Grid>
						<Grid item xs={6} sm={3}>
							<StatBadge label='Episodes' value={totals.episodes} />
						</Grid>
					</Grid>
				</CardContent>
			</Card>

			{/* Per-library cards */}
			<Grid container spacing={3}>
				{libraries.map((lib) => (
					<Grid item xs={12} md={6} xl={4} key={lib.id}>
						<LibraryCard lib={lib} />
					</Grid>
				))}
			</Grid>
		</Box>
	);
}
