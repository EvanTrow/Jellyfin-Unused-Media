import React from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import QueryPanel from '../components/QueryPanel';
import MediaTable from '../components/MediaTable';
import { fetchUnplayedMedia, addExcluded, fetchSettings, markMediaForRemoval, removeMediaRemovalMark, fetchUnusedMediaOptions, saveUnusedMediaOptions, fetchMediaRequesters } from '../services/api';
import { ExcludedItem, MediaItem, QueryParams } from '../types';
import { cacheClearedMediaRemovalMark, cacheMarkedMediaForRemoval } from '../utils/removalCache';

interface Props {
  excluded: ExcludedItem[];
  onExcluded: (item: ExcludedItem) => void;
  onSnackbar: (msg: string, severity?: 'success' | 'error' | 'info') => void;
}

export default function UnusedMediaPage({ excluded, onExcluded, onSnackbar }: Props) {
  const queryClient = useQueryClient();

  const [activeParams, setActiveParams] = React.useState<QueryParams | null>(null);
  const [pendingRemovalItem, setPendingRemovalItem] = React.useState<MediaItem | null>(null);
  const [removeAfterDays, setDeleteAfterDays] = React.useState(7);
  const [markingRemoval, setMarkingRemoval] = React.useState(false);
  const [clearingRemovalId, setClearingRemovalId] = React.useState<string | null>(null);
  const [pendingClearRemovalItem, setPendingClearRemovalItem] = React.useState<MediaItem | null>(null);

  const queryKey = ['media', activeParams] as const;

  const { data: savedOptions } = useQuery({
    queryKey: ['unused-media-options'],
    queryFn: fetchUnusedMediaOptions,
  });

  React.useEffect(() => {
    if (savedOptions && activeParams === null) {
      setActiveParams(savedOptions);
    }
  }, [savedOptions, activeParams]);

  const {
    data,
    isFetching,
    error: queryError,
  } = useQuery({
    queryKey,
    queryFn: () => fetchUnplayedMedia(activeParams!),
    enabled: activeParams !== null && (activeParams.includeMovies || activeParams.includeShows),
  });

  const { data: appSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const { data: requesterOptions = [] } = useQuery({
    queryKey: ['media-requesters'],
    queryFn: fetchMediaRequesters,
  });

  const mediaItems = data?.items ?? [];
  const hasQueried = activeParams !== null;

  const handleParamsChange = (params: QueryParams) => {
    setActiveParams(params);
    saveUnusedMediaOptions(params).catch(() => onSnackbar('Failed to save unused media filters', 'error'));
  };

  const handleExclude = async (item: MediaItem) => {
    try {
      const newExcluded = await addExcluded(item);
      onExcluded(newExcluded);
      // Remove item from cached data without refetching
      queryClient.setQueryData(queryKey, (old: typeof data) =>
        old ? { ...old, items: old.items.filter((m) => m.id !== item.id) } : old
      );
      onSnackbar(`"${item.name}" added to exclude list`);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      onSnackbar(axiosError?.response?.data?.error || 'Failed to exclude item', 'error');
    }
  };

  const handleConfirmRemovalMark = async () => {
    if (!pendingRemovalItem) return;

    setMarkingRemoval(true);
    try {
      const removeAt = new Date();
      removeAt.setDate(removeAt.getDate() + removeAfterDays);
      const marked = await markMediaForRemoval(pendingRemovalItem, removeAt.toISOString());

      cacheMarkedMediaForRemoval(queryClient, pendingRemovalItem, marked);
      onSnackbar(`"${pendingRemovalItem.name}" marked for removal`, 'success');
      setPendingRemovalItem(null);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      onSnackbar(axiosError?.response?.data?.error || 'Failed to mark item for removal', 'error');
    } finally {
      setMarkingRemoval(false);
    }
  };

  const handleClearRemovalMark = async (item: MediaItem) => {
    setClearingRemovalId(item.id);
    try {
      await removeMediaRemovalMark(item.id);
      cacheClearedMediaRemovalMark(queryClient, item);
      onSnackbar(`Removal message removed for "${item.name}"`, 'success');
      setPendingClearRemovalItem(null);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      onSnackbar(axiosError?.response?.data?.error || 'Failed to remove removal message', 'error');
    } finally {
      setClearingRemovalId(null);
    }
  };

  const visibleItems = React.useMemo(() => {
    const excludedIds = new Set(excluded.map((e) => e.id));
    const filtered = mediaItems.filter((i) => !excludedIds.has(i.id));
    return activeParams?.showUnwatchedOnly ? filtered.filter((i) => !i.watched) : filtered;
  }, [mediaItems, excluded, activeParams?.showUnwatchedOnly]);

  const errorMsg = queryError
    ? ((queryError as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (queryError instanceof Error ? queryError.message : 'Query failed'))
    : null;
  const discordRemoveEnabled = !!appSettings?.discordBotToken && !!appSettings.discordChannelId;
  const removalDatePreview = React.useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + removeAfterDays);
    return date.toLocaleString();
  }, [removeAfterDays]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <QueryPanel
        params={activeParams ?? savedOptions ?? {
          startDate: null,
          endDate: new Date().toISOString().substring(0, 10),
          includeMovies: true,
          includeShows: true,
          showUnwatchedOnly: true,
          noActivityWithin: '',
          excludeRequesters: [],
        }}
        onParamsChange={handleParamsChange}
        loading={isFetching}
        resultCount={hasQueried ? visibleItems.length : undefined}
        totalCount={hasQueried ? mediaItems.length : undefined}
        requesterOptions={requesterOptions}
        error={errorMsg}
      />
      <MediaTable
        items={visibleItems}
        loading={isFetching}
        onExclude={handleExclude}
        onMarkForRemoval={discordRemoveEnabled ? setPendingRemovalItem : undefined}
        onClearRemovalMark={discordRemoveEnabled && clearingRemovalId === null ? setPendingClearRemovalItem : undefined}
      />
      <Dialog open={!!pendingRemovalItem} onClose={() => !markingRemoval && setPendingRemovalItem(null)} fullWidth maxWidth="xs">
        <DialogTitle>Mark for removal</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Send a Discord notice and mark "{pendingRemovalItem?.name}" so it cannot be processed again.
          </Typography>
          <TextField
            select
            fullWidth
            label="Remove after"
            value={removeAfterDays}
            onChange={(e) => setDeleteAfterDays(Number(e.target.value))}
            helperText={`Scheduled for ${removalDatePreview}`}
          >
            <MenuItem value={1}>1 day</MenuItem>
            <MenuItem value={3}>3 days</MenuItem>
            <MenuItem value={7}>7 days</MenuItem>
            <MenuItem value={14}>14 days</MenuItem>
            <MenuItem value={30}>30 days</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRemovalItem(null)} disabled={markingRemoval}>
            Cancel
          </Button>
          <Button variant="contained" color="warning" onClick={handleConfirmRemovalMark} disabled={markingRemoval}>
            {markingRemoval ? 'Marking…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!pendingClearRemovalItem}
        onClose={() => !clearingRemovalId && setPendingClearRemovalItem(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Remove removal mark?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Delete the Discord removal message and remove the saved removal mark for "{pendingClearRemovalItem?.name}".
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingClearRemovalItem(null)} disabled={!!clearingRemovalId}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => pendingClearRemovalItem && handleClearRemovalMark(pendingClearRemovalItem)}
            disabled={!!clearingRemovalId}
          >
            {clearingRemovalId ? 'Removing…' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
