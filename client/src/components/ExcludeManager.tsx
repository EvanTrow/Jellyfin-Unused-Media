import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SearchIcon from '@mui/icons-material/Search';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import { ExcludedItem } from '../types';

interface Props {
  items: ExcludedItem[];
  loading: boolean;
  onRemove: (id: string) => Promise<void>;
  onClearAll: () => Promise<void>;
}

export default function ExcludeManager({ items, loading, onRemove, onClearAll }: Props) {
  const [search, setSearch] = React.useState('');
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [removing, setRemoving] = React.useState<string | null>(null);
  const [clearing, setClearing] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(
      (item) => !q || item.name.toLowerCase().includes(q) || item.type.toLowerCase().includes(q)
    );
  }, [items, search]);

  const handleRemove = async (id: string) => {
    setRemoving(id);
    try {
      await onRemove(id);
    } finally {
      setRemoving(null);
    }
  };

  const handleClearAll = async () => {
    setConfirmClear(false);
    setClearing(true);
    try {
      await onClearAll();
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Excluded Items
          <Chip label={items.length} size="small" sx={{ ml: 1 }} />
        </Typography>

        {items.length > 0 && (
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={clearing ? <CircularProgress size={16} /> : <DeleteSweepIcon />}
            onClick={() => setConfirmClear(true)}
            disabled={clearing}
          >
            Clear All
          </Button>
        )}
      </Box>

      {items.length === 0 ? (
        <Alert severity="info">
          No items are currently excluded. Use the <strong>block</strong> button in the query
          results to exclude items from future searches.
        </Alert>
      ) : (
        <>
          <TextField
            size="small"
            placeholder="Filter excluded items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2, minWidth: 280 }}
          />

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Excluded On</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {item.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.type}
                        size="small"
                        color={item.type === 'Movie' ? 'primary' : 'secondary'}
                        variant="outlined"
                        icon={item.type === 'Movie' ? <MovieIcon /> : <TvIcon />}
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(item.dateExcluded).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Remove from excluded list">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemove(item.id)}
                            disabled={removing === item.id}
                          >
                            {removing === item.id ? (
                              <CircularProgress size={16} />
                            ) : (
                              <DeleteIcon fontSize="small" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {filtered.length === 0 && search && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography color="text.secondary">No excluded items match "{search}"</Typography>
            </Box>
          )}
        </>
      )}

      {/* Confirm Clear Dialog */}
      <Dialog open={confirmClear} onClose={() => setConfirmClear(false)} maxWidth="xs">
        <DialogTitle>Clear All Excluded Items?</DialogTitle>
        <DialogContent>
          <Typography>
            This will remove all {items.length} item{items.length !== 1 ? 's' : ''} from the
            exclude list. They will appear in future query results again.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClear(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleClearAll}>
            Clear All
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
