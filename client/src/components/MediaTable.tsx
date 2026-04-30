import React from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Avatar,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Stack,
  Collapse,
  Skeleton,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { MediaItem, SortDirection, SortField } from '../types';

interface Props {
  items: MediaItem[];
  loading: boolean;
  onExclude: (item: MediaItem) => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatRuntime(minutes: number | null): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function descendingComparator(a: MediaItem, b: MediaItem, orderBy: SortField): number {
  const aVal = a[orderBy];
  const bVal = b[orderBy];
  if (aVal == null && bVal == null) return 0;
  if (aVal == null) return 1;
  if (bVal == null) return -1;
  if (typeof aVal === 'boolean' && typeof bVal === 'boolean') return (bVal ? 1 : 0) - (aVal ? 1 : 0);
  if (typeof aVal === 'string' && typeof bVal === 'string') return bVal.localeCompare(aVal);
  if (typeof aVal === 'number' && typeof bVal === 'number') return bVal - aVal;
  return 0;
}

function getComparator(order: SortDirection, orderBy: SortField) {
  return order === 'desc'
    ? (a: MediaItem, b: MediaItem) => descendingComparator(a, b, orderBy)
    : (a: MediaItem, b: MediaItem) => -descendingComparator(a, b, orderBy);
}

function SortableHeader({
  id, label, numeric, orderBy, order, onSort,
}: {
  id: SortField; label: string; numeric?: boolean;
  orderBy: SortField; order: SortDirection; onSort: (f: SortField) => void;
}) {
  return (
    <TableCell align={numeric ? 'right' : 'left'} sortDirection={orderBy === id ? order : false}>
      <TableSortLabel
        active={orderBy === id}
        direction={orderBy === id ? order : 'asc'}
        onClick={() => onSort(id)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
}

function ExpandableRow({
  item, onExclude, orderBy, order, handleSort,
}: {
  item: MediaItem;
  onExclude: (item: MediaItem) => void;
  orderBy: SortField;
  order: SortDirection;
  handleSort: (f: SortField) => void;
}) {
  const [open, setOpen] = React.useState(false);
  void orderBy; void order; void handleSort; // used in parent only

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        {/* Expand */}
        <TableCell sx={{ width: 48, p: 1 }}>
          {item.overview ? (
            <IconButton size="small" onClick={() => setOpen(!open)}>
              {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          ) : null}
        </TableCell>

        {/* Poster */}
        <TableCell sx={{ width: 60, p: 1 }}>
          <Avatar
            src={item.imageUrl ?? undefined}
            variant="rounded"
            sx={{ width: 42, height: 58, bgcolor: 'action.selected' }}
          >
            {item.type === 'Movie' ? <MovieIcon fontSize="small" /> : <TvIcon fontSize="small" />}
          </Avatar>
        </TableCell>

        {/* Title + Genres */}
        <TableCell>
          <Typography variant="body2" fontWeight={500}>{item.name}</Typography>
          {item.genres.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
              {item.genres.slice(0, 3).map((g) => (
                <Chip key={g} label={g} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
              ))}
            </Stack>
          )}
        </TableCell>

        {/* Type */}
        <TableCell>
          <Chip
            label={item.type}
            size="small"
            color={item.type === 'Movie' ? 'primary' : 'secondary'}
            variant="filled"
            icon={item.type === 'Movie' ? <MovieIcon /> : <TvIcon />}
          />
        </TableCell>

        {/* Year */}
        <TableCell>{item.year ?? '—'}</TableCell>

        {/* Date Added */}
        <TableCell>{formatDate(item.dateAdded)}</TableCell>

        {/* Runtime */}
        <TableCell>{formatRuntime(item.runtimeMinutes)}</TableCell>

        {/* Status */}
        <TableCell>
          {item.watched ? (
            <Chip icon={<CheckCircleIcon />} label="Watched" size="small" color="success" variant="outlined" />
          ) : (
            <Chip icon={<RadioButtonUncheckedIcon />} label="Unwatched" size="small" color="default" variant="outlined" />
          )}
        </TableCell>

        {/* Last Watched By */}
        <TableCell>
          {item.lastWatchedBy ? (
            <Chip icon={<PersonIcon />} label={item.lastWatchedBy} size="small" variant="outlined" />
          ) : (
            <Typography variant="caption" color="text.disabled">Never</Typography>
          )}
        </TableCell>

        {/* Last Watched Date */}
        <TableCell>
          {item.lastWatchedDate ? formatDate(item.lastWatchedDate) : (
            <Typography variant="caption" color="text.disabled">Never</Typography>
          )}
        </TableCell>

        {/* Actions */}
        <TableCell align="right">
          <Tooltip title="Add to exclude list">
            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onExclude(item); }}>
              <BlockIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>

      {/* Detail row */}
      {item.overview && (
        <TableRow>
          <TableCell colSpan={11} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ py: 1.5, px: 2, bgcolor: 'action.hover', borderRadius: 1, my: 0.5 }}>
                <Typography variant="body2" color="text.secondary">{item.overview}</Typography>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function MediaTable({ items, loading, onExclude }: Props) {
  const [order, setOrder] = React.useState<SortDirection>('asc');
  const [orderBy, setOrderBy] = React.useState<SortField>('name');
  const [search, setSearch] = React.useState('');

  const handleSort = (field: SortField) => {
    setOrder(orderBy === field && order === 'asc' ? 'desc' : 'asc');
    setOrderBy(field);
  };

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return items
      .filter(
        (item) =>
          !q ||
          item.name.toLowerCase().includes(q) ||
          item.genres.some((g) => g.toLowerCase().includes(q)) ||
          (item.lastWatchedBy ?? '').toLowerCase().includes(q)
      )
      .sort(getComparator(order, orderBy));
  }, [items, search, order, orderBy]);

  if (loading) {
    return (
      <Box>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={64} sx={{ mb: 1, borderRadius: 1 }} />
        ))}
      </Box>
    );
  }

  if (items.length === 0) return null;

  const sortProps = { orderBy, order, onSort: handleSort };

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <TextField
          size="small"
          placeholder="Filter by title, genre, or last watched by…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 320 }}
        />
        {search && (
          <Typography variant="body2" color="text.secondary">
            Showing {filtered.length} of {items.length}
          </Typography>
        )}
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 48 }} />
              <TableCell sx={{ width: 60 }} />
              <SortableHeader id="name" label="Title" {...sortProps} />
              <SortableHeader id="type" label="Type" {...sortProps} />
              <SortableHeader id="year" label="Year" numeric {...sortProps} />
              <SortableHeader id="dateAdded" label="Date Added" {...sortProps} />
              <TableCell>Runtime</TableCell>
              <SortableHeader id="watched" label="Status" {...sortProps} />
              <SortableHeader id="lastWatchedBy" label="Last Watched By" {...sortProps} />
              <SortableHeader id="lastWatchedDate" label="Last Watched" {...sortProps} />
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((item) => (
              <ExpandableRow
                key={item.id}
                item={item}
                onExclude={onExclude}
                orderBy={orderBy}
                order={order}
                handleSort={handleSort}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {filtered.length === 0 && search && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary">No results match &ldquo;{search}&rdquo;</Typography>
        </Box>
      )}
    </Box>
  );
}
