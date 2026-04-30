import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Typography,
  Chip,
  Divider,
  Skeleton,
  Alert,
} from '@mui/material';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats } from '../services/api';
import { LibraryStats } from '../types';
import NowPlaying from '../components/NowPlaying';

function collectionIcon(type: string) {
  const t = type.toLowerCase();
  if (t === 'movies') return <MovieIcon />;
  if (t === 'tvshows') return <TvIcon />;
  return <VideoLibraryIcon />;
}

function collectionLabel(type: string) {
  const t = type.toLowerCase();
  if (t === 'movies') return 'Movies';
  if (t === 'tvshows') return 'TV Shows';
  if (t === 'music') return 'Music';
  if (t === 'books') return 'Books';
  return type || 'Mixed';
}

function StatBadge({ label, value, color }: { label: string; value: number; color?: 'primary' | 'secondary' | 'default' }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h5" fontWeight={700} color={`${color ?? 'text'}.primary`}>
        {value.toLocaleString()}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

function LibraryCard({ lib }: { lib: LibraryStats }) {
  const isTV = lib.collectionType.toLowerCase() === 'tvshows';
  const isMovie = lib.collectionType.toLowerCase() === 'movies';

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardHeader
        avatar={collectionIcon(lib.collectionType)}
        title={lib.name}
        subheader={
          <Chip
            label={collectionLabel(lib.collectionType)}
            size="small"
            variant="outlined"
            sx={{ mt: 0.5 }}
          />
        }
        sx={{ pb: 1 }}
      />
      <Divider />
      <CardContent>
        <Grid container spacing={2} justifyContent="space-around">
          {(isMovie || (!isTV)) && lib.movies > 0 && (
            <Grid item xs={6} sm={3}>
              <StatBadge label="Movies" value={lib.movies} color="primary" />
            </Grid>
          )}
          {(isTV || (!isMovie)) && lib.series > 0 && (
            <Grid item xs={6} sm={3}>
              <StatBadge label="Series" value={lib.series} color="secondary" />
            </Grid>
          )}
          {lib.seasons > 0 && (
            <Grid item xs={6} sm={3}>
              <StatBadge label="Seasons" value={lib.seasons} />
            </Grid>
          )}
          {lib.episodes > 0 && (
            <Grid item xs={6} sm={3}>
              <StatBadge label="Episodes" value={lib.episodes} />
            </Grid>
          )}
          {lib.movies === 0 && lib.series === 0 && lib.seasons === 0 && lib.episodes === 0 && (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                No media found
              </Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardStats,
  });

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Library Overview
        </Typography>
        <Grid container spacing={3}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    const axiosErr = error as { response?: { data?: { error?: string } } };
    const msg = axiosErr?.response?.data?.error ?? (error instanceof Error ? error.message : 'Failed to load');
    return <Alert severity="error">{msg}</Alert>;
  }

  if (!stats) return null;

  const { libraries, totals } = stats;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Dashboard
      </Typography>

      {/* Now Playing */}
      <NowPlaying />

      <Typography variant="h6" fontWeight={700} gutterBottom>
        Library Overview
      </Typography>

      {/* Totals summary card */}
      <Card sx={{ mb: 3 }} variant="outlined">
        <CardHeader
          avatar={<LibraryBooksIcon />}
          title="All Libraries"
          subheader={`${libraries.length} librar${libraries.length !== 1 ? 'ies' : 'y'}`}
        />
        <Divider />
        <CardContent>
          <Grid container spacing={2} justifyContent="space-around">
            <Grid item xs={6} sm={3}>
              <StatBadge label="Movies" value={totals.movies} color="primary" />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatBadge label="Series" value={totals.series} color="secondary" />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatBadge label="Seasons" value={totals.seasons} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatBadge label="Episodes" value={totals.episodes} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Per-library cards */}
      <Grid container spacing={3}>
        {libraries.map((lib) => (
          <Grid item xs={12} md={6} xl={4} key={lib.id}>
            <LibraryCard lib={lib} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
