import React from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import MediaTable from '../components/MediaTable';
import { fetchMarkedForRemovalMedia, markMediaRemoved, removeMediaRemovalMark } from '../services/api';
import { MediaItem } from '../types';
import { cacheClearedMediaRemovalMark, cacheMediaMarkedRemoved, MARKED_FOR_REMOVAL_QUERY_KEY, sortMarkedForRemovalItems } from '../utils/removalCache';

interface Props {
	onSnackbar: (msg: string, severity?: 'success' | 'error' | 'info') => void;
}

export default function MarkedForRemovalPage({ onSnackbar }: Props) {
	const queryClient = useQueryClient();
	const [pendingClearItem, setPendingClearItem] = React.useState<MediaItem | null>(null);
	const [clearingId, setClearingId] = React.useState<string | null>(null);
	const [markingRemovedId, setMarkingRemovedId] = React.useState<string | null>(null);
	const [showRemoved, setShowRemoved] = React.useState(false);

	const queryKey = MARKED_FOR_REMOVAL_QUERY_KEY;
	const {
		data,
		isFetching,
		error: queryError,
	} = useQuery({
		queryKey,
		queryFn: fetchMarkedForRemovalMedia,
		refetchOnMount: 'always',
	});

	const [now, setNow] = React.useState(() => Date.now());
	React.useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 60_000);
		return () => window.clearInterval(timer);
	}, []);

	const items = React.useMemo(() => sortMarkedForRemovalItems(data?.items ?? [], now), [data, now]);
	const visibleItems = React.useMemo(
		() => (showRemoved ? items : items.filter((item) => item.markedForRemoval?.status !== 'removed')),
		[items, showRemoved],
	);
	const removedCount = React.useMemo(() => items.filter((item) => item.markedForRemoval?.status === 'removed').length, [items]);
	const errorMsg = queryError
		? ((queryError as { response?: { data?: { error?: string } } })?.response?.data?.error ??
			(queryError instanceof Error ? queryError.message : 'Failed to load marked items'))
		: null;

	const handleClearRemovalMark = async (item: MediaItem) => {
		setClearingId(item.id);
		try {
			await removeMediaRemovalMark(item.id);
			cacheClearedMediaRemovalMark(queryClient, item);
			onSnackbar(`Removal message removed for "${item.name}"`, 'success');
			setPendingClearItem(null);
		} catch (err: unknown) {
			const axiosError = err as { response?: { data?: { error?: string } } };
			onSnackbar(axiosError?.response?.data?.error || 'Failed to remove removal message', 'error');
		} finally {
			setClearingId(null);
		}
	};

	const handleMarkRemoved = async (item: MediaItem) => {
		setMarkingRemovedId(item.id);
		try {
			const marked = await markMediaRemoved(item.id);
			cacheMediaMarkedRemoved(queryClient, marked);
			onSnackbar(`"${item.name}" marked as removed`, 'success');
		} catch (err: unknown) {
			const axiosError = err as { response?: { data?: { error?: string } } };
			onSnackbar(axiosError?.response?.data?.error || 'Failed to mark item as removed', 'error');
		} finally {
			setMarkingRemovedId(null);
		}
	};

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
			<Box>
				<Typography variant='h5' fontWeight={700} gutterBottom>
					Marked for Removal
				</Typography>
				<Typography variant='body2' color='text.secondary'>
					Items with an active Discord removal notice.
				</Typography>
			</Box>

			{errorMsg && <Alert severity='error'>{errorMsg}</Alert>}

			{items.length > 0 && (
				<Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
					<FormControlLabel
						control={<Switch checked={showRemoved} onChange={(event) => setShowRemoved(event.target.checked)} />}
						label={`Show removed${removedCount > 0 ? ` (${removedCount})` : ''}`}
					/>
				</Box>
			)}

			{!isFetching && !errorMsg && visibleItems.length === 0 ? (
				<Alert severity='info' icon={<EventBusyIcon />}>
					{items.length > 0 ? 'No items match the current filter.' : 'No items are currently marked for removal.'}
				</Alert>
			) : (
				<MediaTable
					items={visibleItems}
					loading={isFetching}
					preserveItemOrder
					onMarkRemoved={markingRemovedId === null ? handleMarkRemoved : undefined}
					onClearRemovalMark={clearingId === null ? setPendingClearItem : undefined}
				/>
			)}

			<Dialog open={!!pendingClearItem} onClose={() => !clearingId && setPendingClearItem(null)} fullWidth maxWidth='xs'>
				<DialogTitle>Remove removal mark?</DialogTitle>
				<DialogContent>
					<Typography variant='body2' color='text.secondary'>
						Delete the Discord removal message and remove the saved removal mark for "{pendingClearItem?.name}".
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setPendingClearItem(null)} disabled={!!clearingId}>
						Cancel
					</Button>
					<Button variant='contained' color='warning' onClick={() => pendingClearItem && handleClearRemovalMark(pendingClearItem)} disabled={!!clearingId}>
						{clearingId ? 'Removing...' : 'Remove'}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}
