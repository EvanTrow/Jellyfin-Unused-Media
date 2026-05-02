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
	Collapse,
	Skeleton,
	Card,
	CardContent,
	useTheme,
	useMediaQuery,
} from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
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
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import { MediaItem, SortDirection, SortField } from '../types';
import { isRemovalPastDue } from '../utils/removalCache';

const DESKTOP_HEADER_H = 48;
const DESKTOP_ROW_H = 72; // estimated height for collapsed desktop row
const MOBILE_CARD_H = 128; // estimated height for collapsed mobile card

// ─── Desktop column widths (px) ──────────────────────────────────────────────
// The "title" column is flex:1 and takes whatever remains.
const C = {
	expand: 40,
	poster: 56,
	// title: flex 1 (min 140 px)
	type: 100,
	year: 55,
	dateAdded: 105,
	runtime: 68,
	criticRating: 72,
	communityRating: 96,
	status: 235,
	requestedBy: 150,
	lastWatchedBy: 150,
	lastWatchedDate: 105,
	actions: 96,
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface Props {
	items: MediaItem[];
	loading: boolean;
	onExclude?: (item: MediaItem) => void;
	onMarkForRemoval?: (item: MediaItem) => void;
	onMarkRemoved?: (item: MediaItem) => void;
	onClearRemovalMark?: (item: MediaItem) => void;
	preserveItemOrder?: boolean;
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

function formatCriticRating(rating: number | null): string {
	if (rating == null) return '-';
	return `${Math.round(rating)}%`;
}

function formatCommunityRating(rating: number | null): string {
	if (rating == null) return '-';
	return Number.isInteger(rating) ? `${rating}/10` : `${rating.toFixed(1)}/10`;
}

function removalLabel(item: MediaItem): string {
	if (!item.markedForRemoval) return '';
	if (item.markedForRemoval.status === 'removed') return 'Removed';
	return isRemovalPastDue(item) ? 'Delete' : `Removes ${formatDate(item.markedForRemoval.removeAt)}`;
}

function RemovalStatusChip({ item, sx }: { item: MediaItem; sx: SxProps<Theme> }) {
	const removed = item.markedForRemoval?.status === 'removed';
	const pastDue = !removed && isRemovalPastDue(item);
	const Icon = removed || pastDue ? DeleteForeverIcon : DeleteIcon;

	return (
		<Chip
			icon={<Icon />}
			label={removalLabel(item)}
			size='small'
			color={removed || pastDue ? 'error' : 'warning'}
			variant='outlined'
			sx={sx}
		/>
	);
}

function RemovalReactionChips({ item, sx }: { item: MediaItem; sx: SxProps<Theme> }) {
	const reactions = item.markedForRemoval?.reactions;
	if (!reactions) return null;

	return (
		<Stack direction='row' spacing={0.5} sx={{ flexShrink: 0 }}>
			<Chip icon={<ThumbUpIcon />} label={reactions.thumbsUp} size='small' color='success' variant='outlined' sx={sx} />
			<Chip icon={<ThumbDownIcon />} label={reactions.thumbsDown} size='small' color='error' variant='outlined' sx={sx} />
		</Stack>
	);
}

function descendingComparator(a: MediaItem, b: MediaItem, orderBy: SortField): number {
	const aVal = a[orderBy];
	const bVal = b[orderBy];
	if (aVal == null && bVal == null) return 0;
	if (aVal == null) return 1;
	if (bVal == null) return -1;
	if (typeof aVal === 'boolean' && typeof bVal === 'boolean') return (bVal ? 1 : 0) - (aVal ? 1 : 0);
	if (typeof aVal === 'string' && typeof bVal === 'string') return bVal.localeCompare(aVal);
	if (typeof aVal === 'number' && typeof bVal === 'number') return bVal - aVal;
	return 0;
}

function getComparator(order: SortDirection, orderBy: SortField) {
	return order === 'desc' ? (a: MediaItem, b: MediaItem) => descendingComparator(a, b, orderBy) : (a: MediaItem, b: MediaItem) => -descendingComparator(a, b, orderBy);
}

// ─── Desktop: sortable column label ──────────────────────────────────────────

function SortLabel({ id, label, orderBy, order, onSort }: { id: SortField; label: string; orderBy: SortField; order: SortDirection; onSort: (f: SortField) => void }) {
	return (
		<TableSortLabel active={orderBy === id} direction={orderBy === id ? order : 'asc'} onClick={() => onSort(id)} sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
			{label}
		</TableSortLabel>
	);
}

// ─── Desktop: sticky header row ───────────────────────────────────────────────

function DesktopHeader({ orderBy, order, onSort }: { orderBy: SortField; order: SortDirection; onSort: (f: SortField) => void }) {
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
			<Box sx={{ width: C.criticRating, flexShrink: 0, px: 1 }}>
				<SortLabel id='criticRating' label='Critic' {...sp} />
			</Box>
			<Box sx={{ width: C.communityRating, flexShrink: 0, px: 1 }}>
				<SortLabel id='communityRating' label='Community' {...sp} />
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

// ─── Desktop: row ─────────────────────────────────────────────────────────────

interface DesktopRowProps {
	item: MediaItem;
	open: boolean;
	onToggle: () => void;
	onExclude?: (item: MediaItem) => void;
	onMarkForRemoval?: (item: MediaItem) => void;
	onMarkRemoved?: (item: MediaItem) => void;
	onClearRemovalMark?: (item: MediaItem) => void;
}

const DesktopRow = React.memo(function DesktopRow({ item, open, onToggle, onExclude, onMarkForRemoval, onMarkRemoved, onClearRemovalMark }: DesktopRowProps) {
	const isRemoved = item.markedForRemoval?.status === 'removed';

	return (
		<Box
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
			<Box className='dr-main' sx={{ display: 'flex', alignItems: 'center', height: DESKTOP_ROW_H, flexShrink: 0 }}>
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
					<Avatar src={item.imageUrl ?? undefined} variant='rounded' sx={{ width: 36, height: 50, bgcolor: 'action.selected' }}>
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

				{/* Critic Rating */}
				<Box sx={{ width: C.criticRating, flexShrink: 0, px: 1 }}>
					<Typography variant='body2'>{formatCriticRating(item.criticRating)}</Typography>
				</Box>

				{/* Community Rating */}
				<Box sx={{ width: C.communityRating, flexShrink: 0, px: 1 }}>
					<Typography variant='body2'>{formatCommunityRating(item.communityRating)}</Typography>
				</Box>

				{/* Status */}
				<Box sx={{ width: C.status, flexShrink: 0, px: 1 }}>
					<Stack direction='row' spacing={0.5} useFlexGap flexWrap='wrap'>
						{item.watched ? (
							<Chip icon={<CheckCircleIcon />} label='Watched' size='small' color='success' variant='outlined' sx={{ fontSize: '0.7rem', height: 22 }} />
						) : (
							<Chip icon={<RadioButtonUncheckedIcon />} label='Unwatched' size='small' color='default' variant='outlined' sx={{ fontSize: '0.7rem', height: 22 }} />
						)}
						{item.markedForRemoval && (
							<RemovalStatusChip item={item} sx={{ fontSize: '0.7rem', height: 22 }} />
						)}
						{item.markedForRemoval && <RemovalReactionChips item={item} sx={{ fontSize: '0.7rem', height: 22 }} />}
					</Stack>
				</Box>

				{/* Requested By */}
				<Box sx={{ width: C.requestedBy, flexShrink: 0, px: 1, overflow: 'hidden' }}>
					{item.requestedBy ? (
						<Chip icon={<AddCircleOutlineIcon />} label={item.requestedBy} size='small' color='info' variant='outlined' sx={{ fontSize: '0.7rem', height: 22, maxWidth: '100%' }} />
					) : (
						<Typography variant='caption' color='text.disabled'>
							—
						</Typography>
					)}
				</Box>

				{/* Last Watched By */}
				<Box sx={{ width: C.lastWatchedBy, flexShrink: 0, px: 1, overflow: 'hidden' }}>
					{item.lastWatchedBy ? (
						<Chip icon={<PersonIcon />} label={item.lastWatchedBy} size='small' variant='outlined' sx={{ fontSize: '0.7rem', height: 22, maxWidth: '100%' }} />
					) : (
						<Typography variant='caption' color='text.disabled'>
							Never
						</Typography>
					)}
				</Box>

				{/* Last Watched Date */}
				<Box sx={{ width: C.lastWatchedDate, flexShrink: 0, px: 1 }}>
					{item.lastWatchedDate ? (
						<Typography variant='body2'>{formatDate(item.lastWatchedDate)}</Typography>
					) : (
						<Typography variant='caption' color='text.disabled'>
							Never
						</Typography>
					)}
				</Box>

				{/* Actions */}
				<Box sx={{ width: C.actions, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
					{item.markedForRemoval ? (
						<>
							{onMarkRemoved && !isRemoved && (
								<Tooltip title='Mark as removed'>
									<IconButton
										size='small'
										color='error'
										onClick={(e) => {
											e.stopPropagation();
											onMarkRemoved(item);
										}}
									>
										<DeleteForeverIcon fontSize='small' />
									</IconButton>
								</Tooltip>
							)}
							{onClearRemovalMark && (
								<Tooltip title='Remove Discord message and remove mark'>
									<IconButton
										size='small'
										color='warning'
										onClick={(e) => {
											e.stopPropagation();
											onClearRemovalMark(item);
										}}
									>
										<EventBusyIcon fontSize='small' />
									</IconButton>
								</Tooltip>
							)}
						</>
					) : (
						onMarkForRemoval && (
								<Tooltip title='Mark for removal'>
									<IconButton
										size='small'
										color='warning'
										onClick={(e) => {
											e.stopPropagation();
											onMarkForRemoval(item);
										}}
									>
										<DeleteForeverIcon fontSize='small' />
									</IconButton>
								</Tooltip>
							)
					)}
					{onExclude && (
						<Tooltip title='Add to exclude list'>
							<IconButton
								size='small'
								color='error'
								onClick={(e) => {
									e.stopPropagation();
									onExclude(item);
								}}
							>
								<BlockIcon fontSize='small' />
							</IconButton>
						</Tooltip>
					)}
				</Box>
			</Box>

			{/* Expanded overview */}
			<Collapse in={open} unmountOnExit>
				{item.overview && (
					<Box
						sx={{
							px: 2,
							py: 1.5,
							bgcolor: 'action.hover',
							borderTop: 1,
							borderColor: 'divider',
						}}
					>
						<Typography variant='body2' color='text.secondary'>
							{item.overview}
						</Typography>
					</Box>
				)}
			</Collapse>
		</Box>
	);
});

// ─── Mobile: card ─────────────────────────────────────────────────────────────

interface MobileCardProps {
	item: MediaItem;
	open: boolean;
	onToggle: () => void;
	onExclude?: (item: MediaItem) => void;
	onMarkForRemoval?: (item: MediaItem) => void;
	onMarkRemoved?: (item: MediaItem) => void;
	onClearRemovalMark?: (item: MediaItem) => void;
}

const MobileMediaCard = React.memo(function MobileMediaCard({ item, open, onToggle, onExclude, onMarkForRemoval, onMarkRemoved, onClearRemovalMark }: MobileCardProps) {
	const hasDetails = !!item.overview || item.genres.length > 0 || !!item.dateAdded || item.runtimeMinutes != null || !!item.lastWatchedDate;
	const isRemoved = item.markedForRemoval?.status === 'removed';

	return (
		<Box sx={{ px: 0, pb: 1 }}>
			<Card variant='outlined'>
				<CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
					<Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
						{/* Poster */}
						<Avatar src={item.imageUrl ?? undefined} variant='rounded' sx={{ width: 44, height: 60, flexShrink: 0, bgcolor: 'action.selected' }}>
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
								{item.criticRating != null && (
									<Chip label={`Critic ${formatCriticRating(item.criticRating)}`} size='small' variant='outlined' sx={{ height: 20, fontSize: '0.7rem' }} />
								)}
								{item.communityRating != null && (
									<Chip label={`Community ${formatCommunityRating(item.communityRating)}`} size='small' variant='outlined' sx={{ height: 20, fontSize: '0.7rem' }} />
								)}
								{item.watched ? (
									<Chip icon={<CheckCircleIcon />} label='Watched' size='small' color='success' variant='outlined' sx={{ height: 20, fontSize: '0.7rem' }} />
								) : (
									<Chip icon={<RadioButtonUncheckedIcon />} label='Unwatched' size='small' variant='outlined' sx={{ height: 20, fontSize: '0.7rem' }} />
								)}
								{item.requestedBy && (
									<Chip icon={<AddCircleOutlineIcon />} label={item.requestedBy} size='small' color='info' variant='outlined' sx={{ height: 20, fontSize: '0.7rem' }} />
								)}
								{item.lastWatchedBy && <Chip icon={<PersonIcon />} label={item.lastWatchedBy} size='small' variant='outlined' sx={{ height: 20, fontSize: '0.7rem' }} />}
								{item.markedForRemoval && (
									<RemovalStatusChip item={item} sx={{ height: 20, fontSize: '0.7rem' }} />
								)}
								{item.markedForRemoval && <RemovalReactionChips item={item} sx={{ height: 20, fontSize: '0.7rem' }} />}
							</Stack>
						</Box>

						{/* Action buttons */}
						<Stack direction='column' alignItems='center' sx={{ flexShrink: 0 }}>
							{item.markedForRemoval ? (
								<>
									{onMarkRemoved && !isRemoved && (
										<Tooltip title='Mark as removed'>
											<IconButton size='small' color='error' onClick={() => onMarkRemoved(item)}>
												<DeleteForeverIcon fontSize='small' />
											</IconButton>
										</Tooltip>
									)}
									{onClearRemovalMark && (
											<Tooltip title='Remove Discord message and remove mark'>
												<IconButton size='small' color='warning' onClick={() => onClearRemovalMark(item)}>
													<EventBusyIcon fontSize='small' />
												</IconButton>
											</Tooltip>
										)}
								</>
							) : (
								onMarkForRemoval && (
										<Tooltip title='Mark for removal'>
											<IconButton size='small' color='warning' onClick={() => onMarkForRemoval(item)}>
												<DeleteForeverIcon fontSize='small' />
											</IconButton>
										</Tooltip>
									)
							)}
							{onExclude && (
								<Tooltip title='Add to exclude list'>
									<IconButton size='small' color='error' onClick={() => onExclude(item)}>
										<BlockIcon fontSize='small' />
									</IconButton>
								</Tooltip>
							)}
							{hasDetails && (
								<IconButton size='small' onClick={onToggle}>
									{open ? <ExpandLessIcon fontSize='small' /> : <ExpandMoreIcon fontSize='small' />}
								</IconButton>
							)}
						</Stack>
					</Box>

					{/* Expanded details */}
					<Collapse in={open} unmountOnExit>
						<Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
							{item.overview && (
								<Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 0.5 }}>
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
								{item.criticRating != null && (
									<Typography variant='caption' color='text.secondary'>
										Critic rating: {formatCriticRating(item.criticRating)}
									</Typography>
								)}
								{item.communityRating != null && (
									<Typography variant='caption' color='text.secondary'>
										Community rating: {formatCommunityRating(item.communityRating)}
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
					</Collapse>
				</CardContent>
			</Card>
		</Box>
	);
});

// ─── Desktop windowed list ────────────────────────────────────────────────────

interface DesktopVirtualListProps {
	items: MediaItem[];
	openRows: Set<string>;
	onToggle: (id: string) => void;
	onExclude?: (item: MediaItem) => void;
	onMarkForRemoval?: (item: MediaItem) => void;
	onMarkRemoved?: (item: MediaItem) => void;
	onClearRemovalMark?: (item: MediaItem) => void;
	orderBy: SortField;
	order: SortDirection;
	onSort: (f: SortField) => void;
}

function DesktopVirtualList({ items, openRows, onToggle, onExclude, onMarkForRemoval, onMarkRemoved, onClearRemovalMark, orderBy, order, onSort }: DesktopVirtualListProps) {
	const parentRef = React.useRef<HTMLDivElement>(null);

	// scrollMargin must be set after mount — parentRef.current is null during the first render.
	const [scrollMargin, setScrollMargin] = React.useState(0);
	React.useLayoutEffect(() => {
		if (parentRef.current) {
			setScrollMargin(parentRef.current.getBoundingClientRect().top + window.scrollY);
		}
	}, []);

	const virtualizer = useWindowVirtualizer({
		count: items.length,
		estimateSize: () => DESKTOP_ROW_H,
		overscan: 6,
		scrollMargin,
	});

	return (
		<Box sx={{ overflowX: 'auto' }}>
			<Paper variant='outlined' sx={{ minWidth: 1290 }}>
				{/* Sticky header — sticks just below the AppBar */}
				<Box>
					<DesktopHeader orderBy={orderBy} order={order} onSort={onSort} />
				</Box>

				{/* Virtualised rows container — height = total virtual height */}
				<div ref={parentRef} style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
					{virtualizer.getVirtualItems().map((vItem) => (
						<div
							key={vItem.key}
							data-index={vItem.index}
							ref={virtualizer.measureElement}
							style={{
								position: 'absolute',
								top: 0,
								left: 0,
								width: '100%',
								transform: `translateY(${vItem.start - virtualizer.options.scrollMargin}px)`,
							}}
						>
							<DesktopRow
								item={items[vItem.index]}
								open={openRows.has(items[vItem.index].id)}
								onToggle={() => onToggle(items[vItem.index].id)}
								onExclude={onExclude}
								onMarkForRemoval={onMarkForRemoval}
								onMarkRemoved={onMarkRemoved}
								onClearRemovalMark={onClearRemovalMark}
							/>
						</div>
					))}
				</div>
			</Paper>
		</Box>
	);
}

// ─── Mobile windowed list ─────────────────────────────────────────────────────

interface MobileVirtualListProps {
	items: MediaItem[];
	openRows: Set<string>;
	onToggle: (id: string) => void;
	onExclude?: (item: MediaItem) => void;
	onMarkForRemoval?: (item: MediaItem) => void;
	onMarkRemoved?: (item: MediaItem) => void;
	onClearRemovalMark?: (item: MediaItem) => void;
}

function MobileVirtualList({ items, openRows, onToggle, onExclude, onMarkForRemoval, onMarkRemoved, onClearRemovalMark }: MobileVirtualListProps) {
	const parentRef = React.useRef<HTMLDivElement>(null);

	const [scrollMargin, setScrollMargin] = React.useState(0);
	React.useLayoutEffect(() => {
		if (parentRef.current) {
			setScrollMargin(parentRef.current.getBoundingClientRect().top + window.scrollY);
		}
	}, []);

	const virtualizer = useWindowVirtualizer({
		count: items.length,
		estimateSize: () => MOBILE_CARD_H,
		overscan: 4,
		scrollMargin,
	});

	return (
		<div ref={parentRef} style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
			{virtualizer.getVirtualItems().map((vItem) => (
				<div
					key={vItem.key}
					data-index={vItem.index}
					ref={virtualizer.measureElement}
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						width: '100%',
						transform: `translateY(${vItem.start - virtualizer.options.scrollMargin}px)`,
					}}
				>
					<MobileMediaCard
						item={items[vItem.index]}
						open={openRows.has(items[vItem.index].id)}
						onToggle={() => onToggle(items[vItem.index].id)}
						onExclude={onExclude}
						onMarkForRemoval={onMarkForRemoval}
						onMarkRemoved={onMarkRemoved}
						onClearRemovalMark={onClearRemovalMark}
					/>
				</div>
			))}
		</div>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MediaTable({ items, loading, onExclude, onMarkForRemoval, onMarkRemoved, onClearRemovalMark, preserveItemOrder = false }: Props) {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('md'));

	const [order, setOrder] = React.useState<SortDirection>('desc');
	const [orderBy, setOrderBy] = React.useState<SortField>('dateAdded');
	const [search, setSearch] = React.useState('');

	const [openRows, setOpenRows] = React.useState<Set<string>>(new Set());

	const handleSort = (field: SortField) => {
		setOrder(orderBy === field && order === 'asc' ? 'desc' : 'asc');
		setOrderBy(field);
	};

	const filtered = React.useMemo(() => {
		const q = search.toLowerCase();
		const next = items.filter(
			(item) =>
				!q ||
				item.name.toLowerCase().includes(q) ||
				item.genres.some((g) => g.toLowerCase().includes(q)) ||
				(item.requestedBy ?? '').toLowerCase().includes(q) ||
				(item.lastWatchedBy ?? '').toLowerCase().includes(q),
		);
		return preserveItemOrder ? next : next.sort(getComparator(order, orderBy));
	}, [items, search, order, orderBy, preserveItemOrder]);

	React.useEffect(() => {
		setOpenRows(new Set());
	}, [items]);

	const toggleRow = (id: string) => {
		setOpenRows((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

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
				<MobileVirtualList items={filtered} openRows={openRows} onToggle={toggleRow} onExclude={onExclude} onMarkForRemoval={onMarkForRemoval} onMarkRemoved={onMarkRemoved} onClearRemovalMark={onClearRemovalMark} />
			) : (
				<DesktopVirtualList
					items={filtered}
					openRows={openRows}
					onToggle={toggleRow}
					onExclude={onExclude}
					onMarkForRemoval={onMarkForRemoval}
					onMarkRemoved={onMarkRemoved}
					onClearRemovalMark={onClearRemovalMark}
					orderBy={orderBy}
					order={order}
					onSort={handleSort}
				/>
			)}

			{filtered.length === 0 && search && (
				<Box sx={{ textAlign: 'center', py: 4 }}>
					<Typography color='text.secondary'>No results match &ldquo;{search}&rdquo;</Typography>
				</Box>
			)}
		</Box>
	);
}
