import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControlLabel,
  Checkbox,
  Switch,
  Button,
  Divider,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import SearchIcon from '@mui/icons-material/Search';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Dayjs } from 'dayjs';
import { QueryParams } from '../types';

interface Props {
  onQuery: (params: QueryParams) => void;
  loading: boolean;
  resultCount?: number;
  totalCount?: number;
  showUnwatchedOnly: boolean;
  onShowUnwatchedOnlyChange: (value: boolean) => void;
  error?: string | null;
}

export default function QueryPanel({
  onQuery,
  loading,
  resultCount,
  totalCount,
  showUnwatchedOnly,
  onShowUnwatchedOnlyChange,
  error,
}: Props) {
  const [startDate, setStartDate] = React.useState<Dayjs | null>(null);
  const [endDate, setEndDate] = React.useState<Dayjs | null>(null);
  const [includeMovies, setIncludeMovies] = React.useState(true);
  const [includeShows, setIncludeShows] = React.useState(true);

  const handleQuery = () => {
    onQuery({
      startDate: startDate ? startDate.format('YYYY-MM-DD') : null,
      endDate: endDate ? endDate.format('YYYY-MM-DD') : null,
      includeMovies,
      includeShows,
    });
  };

  const handleClearDates = () => {
    setStartDate(null);
    setEndDate(null);
  };

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Query Filters
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={3} alignItems="flex-start">
          {/* Date Range */}
          <Grid item xs={12} md={5}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Date Added to Library
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <DatePicker
                label="From"
                value={startDate}
                onChange={(v) => setStartDate(v)}
                maxDate={endDate ?? undefined}
                slotProps={{
                  textField: { size: 'small', sx: { minWidth: 150 } },
                  field: { clearable: true },
                }}
              />
              <DatePicker
                label="To"
                value={endDate}
                onChange={(v) => setEndDate(v)}
                minDate={startDate ?? undefined}
                slotProps={{
                  textField: { size: 'small', sx: { minWidth: 150 } },
                  field: { clearable: true },
                }}
              />
              {(startDate || endDate) && (
                <Button size="small" variant="text" onClick={handleClearDates}>
                  Clear
                </Button>
              )}
            </Box>
          </Grid>

          {/* Media Types */}
          <Grid item xs={12} md={3}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Media Types
            </Typography>
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeMovies}
                    onChange={(e) => setIncludeMovies(e.target.checked)}
                    icon={<MovieIcon />}
                    checkedIcon={<MovieIcon color="primary" />}
                  />
                }
                label="Movies"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeShows}
                    onChange={(e) => setIncludeShows(e.target.checked)}
                    icon={<TvIcon />}
                    checkedIcon={<TvIcon color="primary" />}
                  />
                }
                label="TV Shows"
              />
            </Box>
          </Grid>

          {/* Unwatched Filter + Run Button */}
          <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showUnwatchedOnly}
                  onChange={(e) => onShowUnwatchedOnlyChange(e.target.checked)}
                  color="warning"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <VisibilityOffIcon fontSize="small" />
                  <Typography variant="body2">Unwatched only</Typography>
                </Box>
              }
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
                onClick={handleQuery}
                disabled={loading || (!includeMovies && !includeShows)}
                sx={{ minWidth: 160 }}
              >
                {loading ? 'Searching…' : 'Run Query'}
              </Button>

              {resultCount !== undefined && !loading && (
                <Chip
                  label={
                    totalCount !== undefined && totalCount !== resultCount
                      ? `${resultCount} of ${totalCount}`
                      : `${resultCount} result${resultCount !== 1 ? 's' : ''}`
                  }
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && resultCount === undefined && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Configure filters above and click <strong>Run Query</strong> to browse your Jellyfin
            media library.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
