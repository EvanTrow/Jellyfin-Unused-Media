import React from 'react';
import {
  ThemeProvider,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Badge,
  Divider,
  Container,
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import BlockIcon from '@mui/icons-material/Block';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SettingsIcon from '@mui/icons-material/Settings';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import { lightTheme, darkTheme } from './theme';
import DashboardPage from './pages/DashboardPage';
import UnusedMediaPage from './pages/UnusedMediaPage';
import SettingsPage from './pages/SettingsPage';
import ExcludeManager from './components/ExcludeManager';
import { fetchExcluded, removeExcluded, clearExcluded } from './services/api';
import { ExcludedItem, Page } from './types';
import { SettingsProvider } from './context/SettingsContext';

const DRAWER_WIDTH = 240;

export default function App() {
  const [darkMode, setDarkMode] = React.useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [page, setPage] = React.useState<Page>('dashboard');

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

  React.useEffect(() => {
    fetchExcluded()
      .then(setExcluded)
      .catch(() => showSnackbar('Failed to load excluded items', 'error'))
      .finally(() => setExcludedLoading(false));
  }, []);

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

  const theme = darkMode ? darkTheme : lightTheme;

  const navItems: { id: Page; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  ];

  const reportItems: { id: Page; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'unused-media', label: 'Unused Media', icon: <MovieFilterIcon /> },
    { id: 'excluded', label: 'Excluded Items', icon: <BlockIcon />, badge: excluded.length || undefined },
  ];

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Spacer matching AppBar height */}
      <Toolbar />
      <Divider />

      <List dense disablePadding sx={{ pt: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.id}
            selected={page === item.id}
            onClick={() => setPage(item.id)}
            sx={{ borderRadius: 1, mx: 1, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>

      <Divider sx={{ mx: 2, my: 1 }} />

      <List
        dense
        disablePadding
        subheader={
          <ListSubheader
            disableSticky
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, lineHeight: '32px', px: 2 }}
          >
            <AssessmentIcon fontSize="small" />
            Reports
          </ListSubheader>
        }
      >
        {reportItems.map((item) => (
          <ListItemButton
            key={item.id}
            selected={page === item.id}
            onClick={() => setPage(item.id)}
            sx={{ borderRadius: 1, mx: 1, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
            {item.badge != null && item.badge > 0 && (
              <Badge badgeContent={item.badge} color="error" max={999} />
            )}
          </ListItemButton>
        ))}
      </List>

      {/* Push settings to the bottom */}
      <Box sx={{ flexGrow: 1 }} />
      <Divider />
      <List dense disablePadding sx={{ pb: 1 }}>
        <ListItemButton
          selected={page === 'settings'}
          onClick={() => setPage('settings')}
          sx={{ borderRadius: 1, mx: 1, mt: 0.5 }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}><SettingsIcon /></ListItemIcon>
          <ListItemText primary="Settings" />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <SettingsProvider>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
          {/* Top AppBar */}
          <AppBar
            position="fixed"
            elevation={0}
            sx={{
              zIndex: (t) => t.zIndex.drawer + 1,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Toolbar>
              <MovieFilterIcon sx={{ mr: 1.5, fontSize: 28 }} />
              <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
                Jellyfin Reports
              </Typography>
              <Tooltip title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
                <IconButton color="inherit" onClick={() => setDarkMode(!darkMode)}>
                  {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
                </IconButton>
              </Tooltip>
            </Toolbar>
          </AppBar>

          {/* Left Drawer */}
          <Drawer
            variant="permanent"
            sx={{
              width: DRAWER_WIDTH,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                boxSizing: 'border-box',
                borderRight: 1,
                borderColor: 'divider',
              },
            }}
          >
            {drawer}
          </Drawer>

          {/* Main content */}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
            }}
          >
            {/* Offset for AppBar */}
            <Toolbar />
            <Container maxWidth="xl" sx={{ py: 3, flexGrow: 1 }}>
              {page === 'dashboard' && <DashboardPage />}
              {page === 'unused-media' && (
                <UnusedMediaPage
                  excluded={excluded}
                  onExcluded={(item) => setExcluded((prev) => [...prev, item])}
                  onSnackbar={showSnackbar}
                />
              )}
              {page === 'excluded' && (
                <ExcludeManager
                  items={excluded}
                  loading={excludedLoading}
                  onRemove={handleRemoveExcluded}
                  onClearAll={handleClearExcluded}
                />
              )}
              {page === 'settings' && (
                <SettingsPage onSnackbar={showSnackbar} />
              )}
            </Container>
          </Box>
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
    </SettingsProvider>
  );
}
