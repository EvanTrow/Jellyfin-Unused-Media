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
  Slider,
  TextField,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import CachedIcon from '@mui/icons-material/Cached';
import ScheduleIcon from '@mui/icons-material/Schedule';
import MovieIcon from '@mui/icons-material/Movie';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { useQueryClient } from '@tanstack/react-query';
import { fetchSettings, saveSettings, clearServerCache, clearServerCacheReport } from '../services/api';
import type { AppSettings } from '../services/api';
import axios from 'axios';

interface Props {
  onSnackbar: (msg: string, severity?: 'success' | 'error' | 'info') => void;
}

interface ReportStat {
  report: string;
  count: number;
  sizeBytes: number;
  oldestCachedAt: string | null;
  newestCachedAt: string | null;
}

const api = axios.create({ baseURL: '/api' });

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

async function fetchCacheStats(): Promise<ReportStat[]> {
  const res = await api.get<{ reports: ReportStat[] }>('/cache');
  return res.data.reports ?? [];
}

function reportIcon(report: string) {
  if (report === 'media') return <MovieIcon fontSize="small" />;
  if (report === 'dashboard') return <DashboardIcon fontSize="small" />;
  return <CachedIcon fontSize="small" />;
}

export default function SettingsPage({ onSnackbar }: Props) {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // TTL settings
  const [settings, setSettings]       = React.useState<AppSettings | null>(null);
  const [localTtl, setLocalTtl]       = React.useState<number>(4);
  const [savingTtl, setSavingTtl]     = React.useState(false);
  const [loadingSettings, setLoadingSettings] = React.useState(true);

  // Cache stats
  const [stats, setStats]             = React.useState<ReportStat[]>([]);
  const [loadingStats, setLoadingStats] = React.useState(false);
  const [clearing, setClearing]       = React.useState<string | null>(null);

  const loadSettings = React.useCallback(async () => {
    setLoadingSettings(true);
    try {
      const s = await fetchSettings();
      setSettings(s);
      setLocalTtl(s.cacheTtlHours);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  const loadStats = React.useCallback(async () => {
    setLoadingStats(true);
    try {
      const s = await fetchCacheStats();
      setStats(s);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  React.useEffect(() => {
    loadSettings();
    loadStats();
  }, [loadSettings, loadStats]);

  const handleSaveTtl = async () => {
    setSavingTtl(true);
    try {
      const updated = await saveSettings({ cacheTtlHours: localTtl });
      setSettings(updated);
      onSnackbar(`Cache TTL updated to ${localTtl} hour${localTtl !== 1 ? 's' : ''}`, 'success');
    } catch {
      onSnackbar('Failed to save settings', 'error');
    } finally {
      setSavingTtl(false);
    }
  };

  const handleClear = async (report?: string) => {
    const key = report ?? '__all__';
    setClearing(key);
    try {
      if (report) {
        await clearServerCacheReport(report);
        onSnackbar(`"${report}" cache cleared`, 'success');
      } else {
        await clearServerCache();
        onSnackbar('All cache cleared', 'success');
      }
      queryClient.clear();
      await loadStats();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      onSnackbar(axiosError?.response?.data?.error ?? 'Failed to clear cache', 'error');
    } finally {
      setClearing(null);
    }
  };

  const isDirty = settings !== null && localTtl !== settings.cacheTtlHours;
  const ttlLabel = localTtl === 0 ? 'Never expires' : `${localTtl} hour${localTtl !== 1 ? 's' : ''}`;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Settings
      </Typography>

      <Stack spacing={3}>
        {/* Cache TTL */}
        <Card variant="outlined">
          <CardHeader
            avatar={<ScheduleIcon />}
            title="Cache TTL"
            subheader="How long cached data is kept before being re-fetched from Jellyfin"
          />
          <Divider />
          <CardContent>
            {loadingSettings ? (
              <CircularProgress size={24} />
            ) : (
              <>
                <Typography variant="subtitle2" gutterBottom>
                  Cache duration — {ttlLabel}
                </Typography>
                <Stack direction={isMobile ? 'column' : 'row'} spacing={2} alignItems={isMobile ? 'stretch' : 'center'} sx={{ mb: 2 }}>
                  <Slider
                    min={0}
                    max={24}
                    step={1}
                    value={localTtl}
                    onChange={(_e, v) => setLocalTtl(v as number)}
                    marks={[
                      { value: 0,  label: '∞' },
                      { value: 4,  label: '4h' },
                      { value: 12, label: '12h' },
                      { value: 24, label: '24h' },
                    ]}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    type="number"
                    size="small"
                    value={localTtl}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!isNaN(v)) setLocalTtl(Math.max(0, Math.min(24, v)));
                    }}
                    inputProps={{ min: 0, max: 24 }}
                    sx={{ width: 80 }}
                  />
                </Stack>

                <Alert severity="info" sx={{ mb: 2 }}>
                  {localTtl === 0
                    ? 'Cache never expires — items are only refreshed when you manually clear the cache.'
                    : `Cached items older than ${ttlLabel} will be re-fetched on the next query.`}
                </Alert>

                <Button
                  variant="contained"
                  disabled={!isDirty || savingTtl}
                  onClick={handleSaveTtl}
                >
                  {savingTtl ? 'Saving…' : 'Save'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Cache stats + clear */}
        <Card variant="outlined">
          <CardHeader
            avatar={<CachedIcon />}
            title="Disk Cache"
            subheader="Per-item cache stored on disk — survives server restarts"
          />
          <Divider />
          <CardContent>
            {loadingStats ? (
              <CircularProgress size={24} />
            ) : stats.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Cache is empty — data will be fetched fresh on the next query.
              </Typography>
            ) : (
              <Stack spacing={1.5} sx={{ mb: 2 }}>
                {stats.map((s) => (
                  <Box key={s.report}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                      {reportIcon(s.report)}
                      <Typography variant="body2" fontWeight={600} sx={{ flex: 1, textTransform: 'capitalize' }}>
                        {s.report}
                      </Typography>
                      <Chip label={`${s.count} item${s.count !== 1 ? 's' : ''}`} size="small" />
                      <Chip label={formatBytes(s.sizeBytes)} size="small" variant="outlined" />
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
                    <Stack direction="row" spacing={2} sx={{ pl: 3.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Oldest: {formatDate(s.oldestCachedAt)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Newest: {formatDate(s.newestCachedAt)}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}

            <Alert severity="warning" sx={{ mb: 2 }}>
              Clearing the cache forces a full re-fetch from Jellyfin on the next query.
            </Alert>

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
