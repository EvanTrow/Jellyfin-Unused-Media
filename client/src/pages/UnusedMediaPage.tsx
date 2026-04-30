import React from 'react';
import { Box } from '@mui/material';
import QueryPanel from '../components/QueryPanel';
import MediaTable from '../components/MediaTable';
import { fetchUnplayedMedia, addExcluded } from '../services/api';
import { ExcludedItem, MediaItem, QueryParams } from '../types';

interface Props {
  excluded: ExcludedItem[];
  onExcluded: (item: ExcludedItem) => void;
  onSnackbar: (msg: string, severity?: 'success' | 'error' | 'info') => void;
}

export default function UnusedMediaPage({ excluded, onExcluded, onSnackbar }: Props) {
  const [queryLoading, setQueryLoading] = React.useState(false);
  const [queryError, setQueryError] = React.useState<string | null>(null);
  const [mediaItems, setMediaItems] = React.useState<MediaItem[]>([]);
  const [hasQueried, setHasQueried] = React.useState(false);
  const [showUnwatchedOnly, setShowUnwatchedOnly] = React.useState(true);

  const handleQuery = async (params: QueryParams) => {
    setQueryLoading(true);
    setQueryError(null);
    setHasQueried(true);
    try {
      const result = await fetchUnplayedMedia(params);
      setMediaItems(result.items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Query failed';
      const axiosError = err as { response?: { data?: { error?: string } } };
      setQueryError(axiosError?.response?.data?.error || message);
      setMediaItems([]);
    } finally {
      setQueryLoading(false);
    }
  };

  const handleExclude = async (item: MediaItem) => {
    try {
      const newExcluded = await addExcluded(item);
      onExcluded(newExcluded);
      setMediaItems((prev) => prev.filter((m) => m.id !== item.id));
      onSnackbar(`"${item.name}" added to exclude list`);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      onSnackbar(axiosError?.response?.data?.error || 'Failed to exclude item', 'error');
    }
  };

  // Filter out items that are in the exclude list
  const visibleItems = React.useMemo(
    () => {
      const excludedIds = new Set(excluded.map((e) => e.id));
      const filtered = mediaItems.filter((i) => !excludedIds.has(i.id));
      return showUnwatchedOnly ? filtered.filter((i) => !i.watched) : filtered;
    },
    [mediaItems, excluded, showUnwatchedOnly]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <QueryPanel
        onQuery={handleQuery}
        loading={queryLoading}
        resultCount={hasQueried ? visibleItems.length : undefined}
        totalCount={hasQueried ? mediaItems.length : undefined}
        showUnwatchedOnly={showUnwatchedOnly}
        onShowUnwatchedOnlyChange={setShowUnwatchedOnly}
        error={queryError}
      />
      <MediaTable
        items={visibleItems}
        loading={queryLoading}
        onExclude={handleExclude}
      />
    </Box>
  );
}
