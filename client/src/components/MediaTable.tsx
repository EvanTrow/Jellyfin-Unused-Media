import React from 'react';
import {
	Box,
	TableSortLabel,
	Paper,
	Avatar,
	Typography,
	Chip,
	IconButton,
	Tooltip,
	TextField,
	InputAdornment,
	Stack,
	Skeleton,
	Card,
	CardContent,
	useTheme,
	useMediaQuery,
} from '@mui/material';
import { VariableSizeList, ListChildComponentProps } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import BlockIcon from '@mui/icons-material/Block';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import PersonIcon from '@mui/icons-material/Person';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { MediaItem, SortDirection, SortField } from '../types';

// ─── Row / card height constants ────────────────────────────────────────────
const DESKTOP_ROW_H = 72;       // height of one (collapsed) desktop row
const DESKTOP_HEADER_H = 48;    // height of the sticky header bar
const DESKTOP_EXPANDED = 120;   // extra height when the overview is shown

const MOBILE_CARD_H = 128;      // height of one collapsed mobile card
const MOBILE_EXPANDED = 130;    // extra height when the details are shown

// Approximate px occupied by chrome above each virtual list.
// Adjust if the page layout changes significantly.
const DESKTOP_LIST_OFFSET = 428;
const MOBILE_LIST_OFFSET  = 460;
const MIN_LIST_H = 300;

// ─── Desktop column widths (px) ──────────────────────────────────────────────
// The "title" column is flex:1 and takes whatever remains.
const C = {
	expand:          40,
	poster:          56,
	// title: flex 1 (min 140 px)
	type:           100,
	year:            55,
	dateAdded:      105,
	runtime:         68,
	status:         105,
	requestedBy:    120,
	lastWatchedBy:  120,
	lastWatchedDate:105,
	actions:         52,
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface Props {
	items: MediaItem[];
	loading: boolean;
	onExclude: (item: MediaItem) => void;
}

function formatDate(dateStr: string | null): string {
	if (!dateStr) return '—';
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}

function formatRuntime(minutes: number | null): string {
	if (minutes == null) return '—';
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function descendingComparator(a: MediaItem, b: MediaItem, orderBy: SortField): number {
	const aVal = a[orderBy];
	const bVal = b[orderBy];
	if (aVal == null && bVal == null) return 0;
	if (aVal == null) return 1;
	if (bVal == null) return -1;
	if (typeof aVal === 'boolean' && typeof bVal === 'boolean') return (bVal ? 1 : 0) - (aVal ? 1 : 0);
	if (typeof aVal === 'string'  && typeof bVal === 'string')  return bVal.localeCompare(aVal);
	if (typeof aVal === 'number'  && typeof bVal === 'number')  return bVal - aVal;
	return 0;
}

function getComparator(order: SortDirection, orderBy: SortField) {
	return order === 'desc'
		? (a: MediaItem, b: MediaItem) =>  descendingComparator(a, b, orderBy)
		: (a: MediaItem, b: MediaItem) => -descendingComparator(a, b, orderBy);
}

// ─── Desktop: sortable column label ──────────────────────────────────────────

function SortLabel({ id, label, orderBy, order, onSort }: {
	id: SortField; label: string;
	orderBy: SortField; order: SortDirection;
	onSort: (f: SortField) => void;
}) {
	return (
		<TableSortLabel
			active={orderBy === id}
			direction={orderBy === id ? order : 'asc'}
			onClick={() => onSort(id)}
			sx={{ fontSize: '0.75rem', fontWeight: 600 }}
		>
			{label}
		</TableSortLabel>
	);
}

// ─── Desktop: sticky header row ───────────────────────────────────────────────

function DesktopHeader({ orderBy, order, onSort }: {
	orderBy: SortField; order: SortDirection; onSort: (f: SortField) => void;
}) {
	const sp = { orderBy, order, onSort };
	return (
		<Box
			role='rowgroup'
			sx={{
				display: 'flex',
				alignItems: 'center',
				height: DESKTOP_HEADER_H,
				borderBottom: 2,
				borderColor: 'divider',
				bgcolor: 'background.paper',
				userSelect: 'none',
			}}
		>
			<Box sx={{ width: C.expand, flexShrink: 0 }} />
			<Box sx={{ width: C.poster, flexShrink: 0 }} />
			<Box sx={{ flex: 1, minWidth: 140, px: 1 }}>
				<SortLabel id='name' label='Title' {...sp} />
			</Box>
			<Box sx={{ width: C.type, flexShrink: 0, px: 1 }}>
				<SortLabel id='type' label='Type' {...sp} />
			</Box>
			<Box sx={{ width: C.year, flexShrink: 0, px: 1 }}>
				<SortLabel id='year' label='Year' {...sp} />
			</Box>
			<Box sx={{ width: C.dateAdded, flexShrink: 0, px: 1 }}>
				<SortLabel id='dateAdded' label='Date Added' {...sp} />
			</Box>
			<Box sx={{ width: C.runtime, flexShrink: 0, px: 1 }}>
				<Typography variant='caption' fontWeight={600} color='text.secondary'>
					Runtime
				</Typography>
			</Box>
			<Box sx={{ width: C.status, flexShrink: 0, px: 1 }}>
				<SortLabel id='watched' label='Status' {...sp} />
			</Box>
			<Box sx={{ width: C.requestedBy, flexShrink: 0, px: 1 }}>
				<SortLabel id='requestedBy' label='Requested By' {...sp} />
			</Box>
			<Box sx={{ width: C.lastWatchedBy, flexShrink: 0, px: 1 }}>
				<SortLabel id='lastWatchedBy' label='Last Watched By' {...sp} />
			</Box>
			<Box sx={{ width: C.lastWatchedDate, flexShrink: 0, px: 1 }}>
				<SortLabel id='lastWatchedDate' label='Last Watched' {...sp} />
			</Box>
			<Box sx={{ width: C.actions, flexShrink: 0 }} />
		</Box>
	);
}

// ─── Desktop: virtualized row ─────────────────────────────────────────────────

interface DesktopRowProps {
	item: MediaItem;
	style: React.CSSProperties;
	open: boolean;
	onToggle: () => void;
	onExclude: (item: MediaItem) => void;
}

const DesktopRow = React.memo(function DesktopRow({ item, style, open, onToggle, onExclude }: DesktopRowProps) {
	return (
		<Box
			style={style}
			role='row'
			sx={{
				display: 'flex',
				flexDirection: 'column',
				borderBottom: 1,
				borderColor: 'divider',
				'&:hover .dr-main': { bgcolor: 'action.selected' },
			}}
		>
			{/* Main content */}
			<Box
				className='dr-main'
				sx={{ display: 'flex', alignItems: 'center', height: DESKTOP_ROW_H, flexShrink: 0 }}
			>
				{/* Expand */}
				<Box sx={{ width: C.expand, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
					{item.overview && (
						<IconButton size='small' onClick={onToggle}>
							{open ? <ExpandLessIcon fontSize='small' /> : <ExpandMoreIcon fontSize='small' />}
						</IconButton>
					)}
				</Box>

				{/* Poster */}
				<Box sx={{ width: C.poster, flexShrink: 0, px: 1 }}>
					<Avatar
						src={item.imageUrl ?? undefined}
						variant='rounded'
						sx={{ width: 36, height: 50, bgcolor: 'action.selected' }}
					>
						{item.type === 'Movie' ? <MovieIcon fontSize='small' /> : <TvIcon fontSize='small' />}
					</Avatar>
				</Box>

				{/* Title + genres */}
				<Box sx={{ flex: 1, minWidth: 140, px: 1, overflow: 'hidden' }}>
					<Typography variant='body2' fontWeight={500} noWrap>
						{item.name}
					</Typography>
					{item.genres.length > 0 && (
						<Stack direction='row' spacing={0.5} sx={{ mt: 0.25, overflow: 'hidden' }}>
							{item.genres.slice(0, 3).map((g) => (
								<Chip key={g} label={g} size='small' variant='outlined' sx={{ height: 16, fontSize: 9, flexShrink: 0 }} />
							))}
						</Stack>
					)}
				</Box>

				{/* Type */}
				<Box sx={{ width: C.type, flexShrink: 0, px: 1 }}>
					<Chip
						label={item.type}
						size='small'
						color={item.type === 'Movie' ? 'primary' : 'secondary'}
						variant='filled'
						icon={item.type === 'Movie' ? <MovieIcon /> : <TvIcon />}
						sx={{ fontSize: '0.7rem', height: 22 }}
					/>
				</Box>

				{/* Year */}
				<Box sx={{ width: C.year, flexShrink: 0, px: 1 }}>
					<Typography variant='body2'>{item.year ?? '—'}</Typography>
				</Box>

				{/* Date Added */}
				<Box sx={{ width: C.dateAdded, flexShrink: 0, px: 1 }}>
					<Typography variant='body2'>{formatDate(item.dateAdded)}</Typography>
				</Box>

				{/* Runtime */}
				<Box sx={{ width: C.runtime, flexShrink: 0, px: 1 }}>
					<Typography variant='body2'>{formatRuntime(item.runtimeMinutes)}</Typography>
				</Box>

				{/* Status */}
				<Box sx={{ width: C.status, flexShrink: 0, px: 1 }}>
					{item.watched ? (
						<Chip icon={<CheckCircleIcon />} label='Watched' size='small' color='success' variant='outlined' sx={{ fontSize: '0.7rem', height: 22 }} />
					) : (
						<Chip icon={<RadioButtonUncheckedIcon />} label='Unwatched' size='small' color='default' variant='outlined' sx={{ fontSize: '0.7rem', height: 22 }} />
					)}
				</Box>

				{/* Requested By */}
				<Box sx={{ width: C.requestedBy, flexShrink: 0, px: 1, overflow: 'hidden' }}>
					{item.requestedBy ? (
						<Chip icon={<AddCircleOutlineIcon />} label={item.requestedBy} size='small' color='info' variant='outlined' sx={{ fontSize: '0.7rem', height: 22, maxWidth: '100%' }} />
					) : (
						<Typography variant='caption' color='text.disabled'>—</Typography>
					)}
				</Box>

				{/* Last Watched By */}
				<Box sx={{ width: C.lastWatchedBy, flexShrink: 0, px: 1, overflow: 'hidden' }}>
					{item.lastWatchedBy ? (
						<Chip icon={<PersonIcon />} label={item.lastWatchedBy} size='small' variant='outlined' sx={{ fontSize: '0.7rem', height: 22, maxWidth: '100%' }} />
					) : (
						<Typography variant='caption' color='text.disabled'>Never</Typography>
					)}
				</Box>

				{/* Last Watched Date */}
				<Box sx={{ width: C.lastWatchedDate, flexShrink: 0, px: 1 }}>
					{item.lastWatchedDate ? (
						<Typography variant='body2'>{formatDate(item.lastWatchedDate)}</Typography>
					) : (
						<Typography variant='caption' color='text.disabled'>Never</Typography>
					)}
				</Box>

				{/* Actions */}
				<Box sx={{ width: C.actions, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
					<Tooltip title='Add to exclude list'>
						<IconButton size='small' color='error' onClick={(e) => { e.stopPropagation(); onExclude(item); }}>
							<BlockIcon fontSize='small' />
						</IconButton>
					</Tooltip>
				</Box>
			</Box>

			{/* Expanded overview */}
			{open && item.overview && (
				<Box
					sx={{
						flex: 1,
						px: 2,
						py: 1.5,
						bgcolor: 'action.hover',
						overflow: 'hidden',
						borderTop: 1,
						borderColor: 'divider',
					}}
				>
					<Typography
						variant='body2'
						color='text.secondary'
						sx={{
							overflow: 'hidden',
							display: '-webkit-box',
							WebkitBoxOrient: 'vertical',
							WebkitLineClamp: 4,
						}}
					>
						{item.overview}
					</Typography>
				</Box>
			)}
		</Box>
	);
});

// ─── Mobile: virtualized card ─────────────────────────────────────────────────

interface MobileCardProps {
	item: MediaItem;
	style: React.CSSProperties;
	open: boolean;
	onToggle: () => void;
	onExclude: (item: MediaItem) => void;
}

const MobileMediaCard = React.memo(function MobileMediaCard({ item, style, open, onToggle, onExclude }: MobileCardProps) {
	const hasDetails =
		!!item.overview || item.genres.length > 0 || !!item.dateAdded ||
		item.runtimeMinutes != null || !!item.lastWatchedDate;

	return (
		<Box style={style} sx={{ px: 0, pb: '1px' }}>
			<Card variant='outlined' sx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
				<CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
					<Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
						{/* Poster */}
						<Avatar
							src={item.imageUrl ?? undefined}
							variant='rounded'
							sx={{ width: 44, height: 60, flexShrink: 0, bgcolor: 'action.selected' }}
						>
							{item.type === 'Movie' ? <MovieIcon fontSize='small' /> : <TvIcon fontSize='small' />}
						</Avatar>

						{/* Main info */}
						<Box sx={{ flex: 1, minWidth: 0 }}>
							<Typography variant='body2' fontWeight={600} noWrap>
								{item.name}
							</Typography>
							<Stack direction='row' flexWrap='wrap' gap={0.5} sx={{ mt: 0.5 }}>
								<Chip
									label={item.type}
									size='small'
									color={item.type === 'Movie' ? 'primary' : 'secondary'}
									variant='filled'
									icon={item.type === 'Movie' ? <MovieIcon /> : <TvIcon />}
									sx={{ height: 20, fontSize: '0.7rem' }}
								/>
								{item.year != null && <Chip label={item.year} size='small' variant='outlined' sx={{ height: 20, fontSize: '0.7rem' }} />}
								{item.watched ? (
									<Chip icon={<CheckCircleIcon />} label='Watched' size='small' color='success' variant='outlined' sx={{ height: 20, fontSize: '0.7rem' }} />
								) : (
									<Chip icon={<RadioButtonUncheckedIcon />} label='Unwatched' size='small' variant='outlined' sx={{ height: 20, fontSize: '0.7rem' }} />
								)}
								{item.requestedBy && <Chip icon={<AddCircleOutlineIcon />} label={item.requestedBy} size='small' color='info' variant='outlined' sx={{ height: 20, fontSize: '0.7rem' }} />}
								{item.lastWatchedBy && <Chip icon={<PersonIcon />} label={item.lastWatchedBy} size='small' variant='outlined' sx={{ height: 20, fontSize: '0.7rem' }} />}
							</Stack>
						</Box>

						{/* Action buttons */}
						<Stack direction='column' alignItems='center' sx={{ flexShrink: 0 }}>
							<Tooltip title='Add to exclude list'>
								<IconButton size='small' color='error' onClick={() => onExclude(item)}>
									<BlockIcon fontSize='small' />
								</IconButton>
							</Tooltip>
							{hasDetails && (
								<IconButton size='small' onClick={onToggle}>
									{open ? <ExpandLessIcon fontSize='small' /> : <ExpandMoreIcon fontSize='small' />}
								</IconButton>
							)}
						</Stack>
					</Box>

					{/* Expanded details (no animation — height is managed by react-window) */}
					{open && (
						<Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider', overflow: 'hidden' }}>
							{item.overview && (
								<Typography
									variant='caption'
									color='text.secondary'
									sx={{
										display: '-webkit-box',
										overflow: 'hidden',
										WebkitBoxOrient: 'vertical',
										WebkitLineClamp: 4,
										mb: 0.5,
									}}
								>
									{item.overview}
								</Typography>
							)}
							<Stack spacing={0.25}>
								{item.dateAdded && (
									<Typography variant='caption' color='text.secondary'>
										Added: {formatDate(item.dateAdded)}
									</Typography>
								)}
								{item.runtimeMinutes != null && (
									<Typography variant='caption' color='text.secondary'>
										Runtime: {formatRuntime(item.runtimeMinutes)}
									</Typography>
								)}
								{item.lastWatchedDate && (
									<Typography variant='caption' color='text.secondary'>
										Last watched: {formatDate(item.lastWatchedDate)}
									</Typography>
								)}
							</Stack>
							{item.genres.length > 0 && (
								<Stack direction='row' flexWrap='wrap' gap={0.5} sx={{ mt: 0.5 }}>
									{item.genres.slice(0, 5).map((g) => (
										<Chip key={g} label={g} size='small' variant='outlined' sx={{ height: 18, fontSize: '0.65rem' }} />
									))}
								</Stack>
							)}
						</Box>
					)}
				</CardContent>
			</Card>
		</Box>
	);
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function MediaTable({ items, loading, onExclude }: Props) {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('md'));

	const [order,   setOrder]   = React.useState<SortDirection>('asc');
	const [orderBy, setOrderBy] = React.useState<SortField>('name');
	const [search,  setSearch]  = React.useState('');

	// Set of item IDs whose overview is currently expanded
	const [openRows, setOpenRows] = React.useState<Set<string>>(new Set());

	const desktopListRef = React.useRef<VariableSizeList>(null);
	const mobileListRef  = React.useRef<VariableSizeList>(null);

	const handleSort = (field: SortField) => {
		setOrder(orderBy === field && order === 'asc' ? 'desc' : 'asc');
		setOrderBy(field);
	};

	const filtered = React.useMemo(() => {
		const q = search.toLowerCase();
		return items
			.filter(
				(item) =>
					!q ||
					item.name.toLowerCase().includes(q) ||
					item.genres.some((g) => g.toLowerCase().includes(q)) ||
					(item.requestedBy  ?? '').toLowerCase().includes(q) ||
					(item.lastWatchedBy ?? '').toLowerCase().includes(q),
			)
			.sort(getComparator(order, orderBy));
	}, [items, search, order, orderBy]);

	// When the underlying data changes, collapse all expanded rows
	React.useEffect(() => {
		setOpenRows(new Set());
	}, [items]);

	// After every render, sync react-window's size cache with the current openRows
	// so expanded rows get the correct allocated height.
	React.useLayoutEffect(() => {
		desktopListRef.current?.resetAfterIndex(0);
		mobileListRef.current?.resetAfterIndex(0);
	}, [filtered, openRows]);

	const toggleRow = (id: string) => {
		setOpenRows((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id); else next.add(id);
			return next;
		});
	};

	const getDesktopItemSize = React.useCallback(
		(index: number) => {
			const item = filtered[index];
			return item && openRows.has(item.id)
				? DESKTOP_ROW_H + DESKTOP_EXPANDED
				: DESKTOP_ROW_H;
		},
		[filtered, openRows],
	);

	const getMobileItemSize = React.useCallback(
		(index: number) => {
			const item = filtered[index];
			return item && openRows.has(item.id)
				? MOBILE_CARD_H + MOBILE_EXPANDED
				: MOBILE_CARD_H;
		},
		[filtered, openRows],
	);

	if (loading) {
		return (
			<Box>
				{Array.from({ length: 8 }).map((_, i) => (
					<Skeleton key={i} variant='rectangular' height={64} sx={{ mb: 1, borderRadius: 1 }} />
				))}
			</Box>
		);
	}

	if (items.length === 0) return null;

	return (
		<Box>
			{/* Search / filter bar */}
			<Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
				<TextField
					size='small'
					placeholder='Filter by title, genre, user…'
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					InputProps={{
						startAdornment: (
							<InputAdornment position='start'>
								<SearchIcon fontSize='small' />
							</InputAdornment>
						),
					}}
					sx={{ minWidth: { xs: '100%', sm: 360 } }}
				/>
				{search && (
					<Typography variant='body2' color='text.secondary'>
						Showing {filtered.length} of {items.length}
					</Typography>
				)}
			</Box>

			{isMobile ? (
				/* ── Mobile virtualized card list ── */
				<Box sx={{ height: `calc(100vh - ${MOBILE_LIST_OFFSET}px)`, minHeight: MIN_LIST_H }}>
					<AutoSizer
						renderProp={({ height, width }) =>
							height == null || width == null ? null : (
								<VariableSizeList
									ref={mobileListRef}
									height={height}
									width={width}
									itemCount={filtered.length}
									itemSize={getMobileItemSize}
									overscanCount={4}
								>
									{({ index, style }: ListChildComponentProps) => (
										<MobileMediaCard
											item={filtered[index]}
											style={style}
											open={openRows.has(filtered[index].id)}
											onToggle={() => toggleRow(filtered[index].id)}
											onExclude={onExclude}
										/>
									)}
								</VariableSizeList>
							)
						}
					/>
				</Box>
			) : (
				/* ── Desktop virtualized flex-table ── */
				<Box sx={{ overflowX: 'auto' }}>
					<Paper variant='outlined' sx={{ minWidth: 1050 }}>
						{/* Sticky header */}
						<DesktopHeader orderBy={orderBy} order={order} onSort={handleSort} />

						{/* Virtualized body */}
						<Box sx={{ height: `calc(100vh - ${DESKTOP_LIST_OFFSET}px)`, minHeight: MIN_LIST_H }}>
							<AutoSizer
								renderProp={({ height, width }) =>
									height == null || width == null ? null : (
										<VariableSizeList
											ref={desktopListRef}
											height={height}
											width={width}
											itemCount={filtered.length}
											itemSize={getDesktopItemSize}
											overscanCount={6}
										>
											{({ index, style }: ListChildComponentProps) => (
												<DesktopRow
													item={filtered[index]}
													style={style}
													open={openRows.has(filtered[index].id)}
													onToggle={() => toggleRow(filtered[index].id)}
													onExclude={onExclude}
												/>
											)}
										</VariableSizeList>
									)
								}
							/>
						</Box>
					</Paper>
				</Box>
			)}

			{filtered.length === 0 && search && (
				<Box sx={{ textAlign: 'center', py: 4 }}>
					<Typography color='text.secondary'>No results match &ldquo;{search}&rdquo;</Typography>
				</Box>
			)}
		</Box>
	);
}
