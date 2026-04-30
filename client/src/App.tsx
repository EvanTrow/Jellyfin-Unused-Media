import React from 'react';
import {
  ThemeProvider,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Badge,
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import BlockIcon from '@mui/icons-material/Block';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import { lightTheme, darkTheme } from './theme';
import QueryPanel from './components/QueryPanel';
import MediaTable from './components/MediaTable';
import ExcludeManager from './components/ExcludeManager';
import { fetchUnplayedMedia, fetchExcluded, addExcluded, removeExcluded, clearExcluded } from './services/api';
import { ExcludedItem, MediaItem, QueryParams } from './types';

export default function App() {
  const [darkMode, setDarkMode] = React.useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [activeTab, setActiveTab] = React.useState(0);

  // Query state
  const [queryLoading, setQueryLoading] = React.useState(false);
  const [queryError, setQueryError] = React.useState<string | null>(null);
  const [mediaItems, setMediaItems] = React.useState<MediaItem[]>([]);
  const [hasQueried, setHasQueried] = React.useState(false);

  // Filter state
  const [showUnwatchedOnly, setShowUnwatchedOnly] = React.useState(true);

  // Excluded state
  const [excluded, setExcluded] = React.useState<ExcludedItem[]>([]);
  const [excludedLoading, setExcludedLoading] = React.useState(true);

  // Snackbar
  const [snackbar, setSnackbar] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Load excluded items on mount
  React.useEffect(() => {
    fetchExcluded()
      .then(setExcluded)
      .catch(() => showSnackbar('Failed to load excluded items', 'error'))
      .finally(() => setExcludedLoading(false));
  }, []);

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
      const serverMsg = axiosError?.response?.data?.error;
      setQueryError(serverMsg || message);
      setMediaItems([]);
    } finally {
      setQueryLoading(false);
    }
  };

  const handleExclude = async (item: MediaItem) => {
    try {
      const newExcluded = await addExcluded(item);
      setExcluded((prev) => [...prev, newExcluded]);
      setMediaItems((prev) => prev.filter((m) => m.id !== item.id));
      showSnackbar(`"${item.name}" added to exclude list`);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError?.response?.data?.error || 'Failed to exclude item';
      showSnackbar(msg, 'error');
    }
  };

  const handleRemoveExcluded = async (id: string) => {
    await removeExcluded(id);
    setExcluded((prev) => prev.filter((item) => item.id !== id));
    showSnackbar('Item removed from exclude list');
  };

  const handleClearExcluded = async () => {
    await clearExcluded();
    setExcluded([]);
    showSnackbar('Exclude list cleared');
  };

  // Client-side filter: optionally show only unwatched
  const displayedItems = React.useMemo(
    () => (showUnwatchedOnly ? mediaItems.filter((i) => !i.watched) : mediaItems),
    [mediaItems, showUnwatchedOnly]
  );

  const theme = darkMode ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          {/* App Bar */}
          <AppBar position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Toolbar>
              <MovieFilterIcon sx={{ mr: 1.5, fontSize: 28 }} />
              <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
                Jellyfin Unused Media
              </Typography>
              <Tooltip title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
                <IconButton color="inherit" onClick={() => setDarkMode(!darkMode)}>
                  {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
                </IconButton>
              </Tooltip>
            </Toolbar>

            <Tabs
              value={activeTab}
              onChange={(_e, v) => setActiveTab(v)}
              sx={{ px: 2, minHeight: 42 }}
              TabIndicatorProps={{ style: { height: 3 } }}
            >
              <Tab
                label={
                  hasQueried
                    ? `Media (${displayedItems.length}${displayedItems.length !== mediaItems.length ? ` of ${mediaItems.length}` : ''})`
                    : 'Media'
                }
                sx={{ minHeight: 42 }}
              />
              <Tab
                label={
                  <Badge badgeContent={excluded.length} color="error" max={999}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <BlockIcon fontSize="small" />
                      Excluded Items
                    </Box>
                  </Badge>
                }
                sx={{ minHeight: 42 }}
              />
            </Tabs>
          </AppBar>

          {/* Main Content */}
          <Container maxWidth="xl" sx={{ py: 3, flexGrow: 1 }}>
            {/* Query Tab */}
            {activeTab === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <QueryPanel
                  onQuery={handleQuery}
                  loading={queryLoading}
                  resultCount={hasQueried ? displayedItems.length : undefined}
                  totalCount={hasQueried ? mediaItems.length : undefined}
                  showUnwatchedOnly={showUnwatchedOnly}
                  onShowUnwatchedOnlyChange={setShowUnwatchedOnly}
                  error={queryError}
                />
                <MediaTable
                  items={displayedItems}
                  loading={queryLoading}
                  onExclude={handleExclude}
                />
              </Box>
            )}

            {/* Excluded Tab */}
            {activeTab === 1 && (
              <ExcludeManager
                items={excluded}
                loading={excludedLoading}
                onRemove={handleRemoveExcluded}
                onClearAll={handleClearExcluded}
              />
            )}
          </Container>
        </Box>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            severity={snackbar.severity}
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
            variant="filled"
            elevation={6}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
