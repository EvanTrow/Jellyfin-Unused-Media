import React from 'react';
import { Box } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

  // activeParams drives the query — null means "not yet run"
  const [activeParams, setActiveParams] = React.useState<QueryParams | null>(null);
  const [showUnwatchedOnly, setShowUnwatchedOnly] = React.useState(true);

  const queryKey = ['media', activeParams] as const;

  const {
    data,
    isFetching,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => fetchUnplayedMedia(activeParams!),
    enabled: activeParams !== null,
  });

  const mediaItems = data?.items ?? [];
  const hasQueried = activeParams !== null;

  const handleQuery = (params: QueryParams) => {
    if (activeParams && JSON.stringify(activeParams) === JSON.stringify(params)) {
      // Same params — force refetch (invalidate cache for this key)
      queryClient.invalidateQueries({ queryKey });
      refetch();
    } else {
      setActiveParams(params);
    }
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

  const visibleItems = React.useMemo(() => {
    const excludedIds = new Set(excluded.map((e) => e.id));
    const filtered = mediaItems.filter((i) => !excludedIds.has(i.id));
    return showUnwatchedOnly ? filtered.filter((i) => !i.watched) : filtered;
  }, [mediaItems, excluded, showUnwatchedOnly]);

  const errorMsg = queryError
    ? ((queryError as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (queryError instanceof Error ? queryError.message : 'Query failed'))
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <QueryPanel
        onQuery={handleQuery}
        loading={isFetching}
        resultCount={hasQueried ? visibleItems.length : undefined}
        totalCount={hasQueried ? mediaItems.length : undefined}
        showUnwatchedOnly={showUnwatchedOnly}
        onShowUnwatchedOnlyChange={setShowUnwatchedOnly}
        error={errorMsg}
      />
      <MediaTable
        items={visibleItems}
        loading={isFetching}
        onExclude={handleExclude}
      />
    </Box>
  );
}
