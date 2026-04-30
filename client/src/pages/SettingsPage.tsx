import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Button,
  Stack,
  Divider,
  Alert,
  Chip,
} from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import CachedIcon from '@mui/icons-material/Cached';
import MovieIcon from '@mui/icons-material/Movie';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface Props {
  onSnackbar: (msg: string, severity?: 'success' | 'error' | 'info') => void;
}

interface ReportStat { report: string; count: number }

const api = axios.create({ baseURL: '/api' });

async function fetchCacheStats(): Promise<ReportStat[]> {
  const res = await api.get<{ reports: ReportStat[] }>('/cache');
  return res.data.reports ?? [];
}

async function clearCache(report?: string): Promise<void> {
  if (report) {
    await api.delete(`/cache/${report}`);
  } else {
    await api.delete('/cache');
  }
}

export default function SettingsPage({ onSnackbar }: Props) {
  const queryClient = useQueryClient();
  const [stats, setStats] = React.useState<ReportStat[]>([]);
  const [loadingStats, setLoadingStats] = React.useState(false);
  const [clearing, setClearing] = React.useState<string | null>(null);

  const loadStats = React.useCallback(async () => {
    setLoadingStats(true);
    try {
      const s = await fetchCacheStats();
      setStats(s);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  React.useEffect(() => { loadStats(); }, [loadStats]);

  const handleClear = async (report?: string) => {
    const key = report ?? '__all__';
    setClearing(key);
    try {
      await clearCache(report);
      queryClient.clear();
      onSnackbar(report ? `"${report}" cache cleared` : 'All cache cleared', 'success');
      await loadStats();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      onSnackbar(axiosError?.response?.data?.error ?? 'Failed to clear cache', 'error');
    } finally {
      setClearing(null);
    }
  };

  const reportIcon = (report: string) => {
    if (report === 'media') return <MovieIcon fontSize="small" />;
    if (report === 'dashboard') return <DashboardIcon fontSize="small" />;
    return <CachedIcon fontSize="small" />;
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Settings
      </Typography>

      <Stack spacing={3}>
        {/* Cache info */}
        <Card variant="outlined">
          <CardHeader
            avatar={<CachedIcon />}
            title="Disk Cache"
            subheader="Cached data is stored on disk and persists across server restarts"
          />
          <Divider />
          <CardContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              Each Jellyfin item is cached individually by its unique ID under the report name.
              New items discovered on the next query will be fetched fresh and added to the cache.
              Cached items are reused automatically — <strong>clear the cache to force a full refresh</strong>.
            </Alert>

            {/* Per-report stats */}
            {stats.length > 0 && (
              <Stack spacing={1} sx={{ mb: 2 }}>
                {stats.map((s) => (
                  <Box key={s.report} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {reportIcon(s.report)}
                    <Typography variant="body2" sx={{ flex: 1, textTransform: 'capitalize' }}>
                      {s.report}
                    </Typography>
                    <Chip label={`${s.count} item${s.count !== 1 ? 's' : ''}`} size="small" />
                    <Button
                      size="small"
                      color="warning"
                      variant="outlined"
                      disabled={clearing !== null}
                      onClick={() => handleClear(s.report)}
                    >
                      {clearing === s.report ? 'Clearing…' : 'Clear'}
                    </Button>
                  </Box>
                ))}
              </Stack>
            )}

            {!loadingStats && stats.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Cache is empty — data will be fetched fresh on the next query.
              </Typography>
            )}

            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={() => handleClear()}
              disabled={clearing !== null}
            >
              {clearing === '__all__' ? 'Clearing…' : 'Clear All Cache'}
            </Button>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
