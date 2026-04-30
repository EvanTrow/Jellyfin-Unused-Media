import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Stack,
  Tooltip,
  Skeleton,
  Divider,
  useTheme,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import PersonIcon from '@mui/icons-material/Person';
import TvIcon from '@mui/icons-material/Tv';
import MovieIcon from '@mui/icons-material/Movie';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import DevicesIcon from '@mui/icons-material/Devices';
import { useQuery } from '@tanstack/react-query';
import { fetchNowPlaying } from '../services/api';
import { NowPlayingSession } from '../types';

// ---- Helpers ----------------------------------------------------------------

function ticksToSeconds(ticks: number): number {
  return ticks / 10_000_000;
}

function formatDuration(ticks: number): string {
  const total = Math.floor(ticksToSeconds(ticks));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function progressPercent(positionTicks: number, runtimeTicks: number): number {
  if (!runtimeTicks) return 0;
  return Math.min(100, (positionTicks / runtimeTicks) * 100);
}

function formatBitrate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  return `${Math.round(bps / 1000)} kbps`;
}

function mediaIcon(type: string) {
  const t = type.toLowerCase();
  if (t === 'episode' || t === 'series') return <TvIcon fontSize="small" />;
  if (t === 'audio') return <MusicNoteIcon fontSize="small" />;
  return <MovieIcon fontSize="small" />;
}

function buildTitle(session: NowPlayingSession): { primary: string; secondary: string | null } {
  const { nowPlaying } = session;
  if (nowPlaying.type === 'Episode' && nowPlaying.seriesName) {
    const ep =
      nowPlaying.seasonNumber != null && nowPlaying.episodeNumber != null
        ? `S${String(nowPlaying.seasonNumber).padStart(2, '0')}E${String(nowPlaying.episodeNumber).padStart(2, '0')}`
        : '';
    return {
      primary: nowPlaying.seriesName,
      secondary: ep ? `${ep} — ${nowPlaying.name}` : nowPlaying.name,
    };
  }
  return {
    primary: nowPlaying.name,
    secondary: nowPlaying.year ? String(nowPlaying.year) : null,
  };
}

// ---- Stream info chips ------------------------------------------------------

function StreamChips({ session }: { session: NowPlayingSession }) {
  const chips: { label: string; color?: 'success' | 'warning' | 'error' | 'default'; tooltip?: string }[] = [];

  const method = session.playMethod;
  if (method === 'DirectPlay') {
    chips.push({ label: 'Direct Play', color: 'success', tooltip: 'No transcoding — stream sent as-is' });
  } else if (method === 'DirectStream') {
    chips.push({ label: 'Direct Stream', color: 'warning', tooltip: 'Container remuxed, codecs unchanged' });
  } else {
    chips.push({ label: 'Transcoding', color: 'error', tooltip: 'Video/audio is being transcoded' });
  }

  if (session.videoCodec) {
    const label = `${session.isVideoDirect ? '▶' : '⚙'} ${session.videoCodec.toUpperCase()}`;
    chips.push({ label, tooltip: session.isVideoDirect ? 'Video: direct copy' : 'Video: transcoding' });
  }
  if (session.audioCodec) {
    const label = `${session.isAudioDirect ? '▶' : '⚙'} ${session.audioCodec.toUpperCase()}`;
    chips.push({ label, tooltip: session.isAudioDirect ? 'Audio: direct copy' : 'Audio: transcoding' });
  }
  if (session.bitrate) {
    chips.push({ label: formatBitrate(session.bitrate), tooltip: 'Stream bitrate' });
  }
  if (session.framerate) {
    chips.push({ label: `${session.framerate.toFixed(2)} fps`, tooltip: 'Framerate' });
  }

  return (
    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.75 }}>
      {chips.map((c, i) => (
        <Tooltip key={i} title={c.tooltip ?? ''} arrow>
          <Chip
            label={c.label}
            size="small"
            color={c.color ?? 'default'}
            variant={c.color ? 'filled' : 'outlined'}
            sx={{ fontSize: '0.68rem' }}
          />
        </Tooltip>
      ))}
    </Stack>
  );
}

// ---- Single session card ----------------------------------------------------

function SessionCard({ session }: { session: NowPlayingSession }) {
  const theme = useTheme();
  const { primary, secondary } = buildTitle(session);
  const pct = progressPercent(session.positionTicks, session.nowPlaying.runtimeTicks);

  const allUsers = [session.userName, ...session.additionalUsers];

  return (
    <Card
      variant="outlined"
      sx={{
        display: 'flex',
        overflow: 'hidden',
        borderRadius: 2,
        borderColor: session.isPaused ? 'divider' : 'primary.main',
        transition: 'border-color 0.3s',
      }}
    >
      {/* Poster */}
      <Box
        sx={{
          width: { xs: 80, sm: 110 },
          flexShrink: 0,
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {session.nowPlaying.imageUrl ? (
          <Box
            component="img"
            src={session.nowPlaying.imageUrl}
            alt={primary}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Box sx={{ opacity: 0.3 }}>{mediaIcon(session.nowPlaying.type)}</Box>
        )}
        {/* Paused overlay */}
        {session.isPaused && (
          <Box
            sx={{
              position: 'absolute', inset: 0,
              bgcolor: 'rgba(0,0,0,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <PauseIcon sx={{ fontSize: 32, color: 'white', opacity: 0.9 }} />
          </Box>
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ pb: '8px !important', flex: 1 }}>
          {/* Title row */}
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" alignItems="center" gap={0.5}>
                {session.isPaused
                  ? <PauseIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  : <PlayArrowIcon sx={{ fontSize: 16, color: 'success.main' }} />
                }
                <Typography variant="subtitle1" fontWeight={700} noWrap>
                  {primary}
                </Typography>
              </Stack>
              {secondary && (
                <Typography variant="body2" color="text.secondary" noWrap sx={{ ml: 2.5 }}>
                  {secondary}
                </Typography>
              )}
            </Box>
          </Stack>

          {/* User + device */}
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
            {allUsers.map((u) => (
              <Chip
                key={u}
                icon={<PersonIcon />}
                label={u}
                size="small"
                variant="outlined"
              />
            ))}
            {session.client && (
              <Tooltip title={`${session.client} on ${session.deviceName}`} arrow>
                <Chip
                  icon={<DevicesIcon />}
                  label={session.client}
                  size="small"
                  variant="outlined"
                  color="default"
                />
              </Tooltip>
            )}
          </Stack>

          {/* Stream info */}
          <StreamChips session={session} />

          {/* Transcoding reasons */}
          {session.transcodeReasons.length > 0 && (
            <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
              ⚠ {session.transcodeReasons.join(', ')}
            </Typography>
          )}
        </CardContent>

        {/* Progress bar */}
        <Box sx={{ px: 2, pb: 1.5 }}>
          <LinearProgress
            variant="determinate"
            value={pct}
            color={session.isPaused ? 'inherit' : 'primary'}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: theme.palette.action.hover,
              mb: 0.5,
            }}
          />
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">
              {formatDuration(session.positionTicks)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDuration(session.nowPlaying.runtimeTicks)}
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Card>
  );
}

// ---- Skeleton ---------------------------------------------------------------

function SessionSkeleton() {
  return (
    <Card variant="outlined" sx={{ display: 'flex', height: 140, borderRadius: 2 }}>
      <Skeleton variant="rectangular" width={110} height="100%" />
      <Box sx={{ flex: 1, p: 2 }}>
        <Skeleton width="60%" height={24} sx={{ mb: 1 }} />
        <Skeleton width="40%" height={20} sx={{ mb: 2 }} />
        <Skeleton width="80%" height={8} sx={{ borderRadius: 2 }} />
      </Box>
    </Card>
  );
}

// ---- Main component ---------------------------------------------------------

export default function NowPlaying() {
  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['now-playing'],
    queryFn: fetchNowPlaying,
    refetchInterval: 10_000,   // poll every 10 s
    staleTime: 0,              // always fresh
    gcTime: 0,
  });

  const [tick, setTick] = React.useState(0);

  // Client-side progress interpolation between polls
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Interpolate position ticks locally (adds 1 s worth of ticks per second while playing)
  const [interpolated, setInterpolated] = React.useState<NowPlayingSession[]>([]);
  const sessionsRef = React.useRef<NowPlayingSession[]>([]);
  const lastFetchRef = React.useRef<number>(Date.now());

  React.useEffect(() => {
    if (sessions) {
      sessionsRef.current = sessions;
      lastFetchRef.current = Date.now();
      setInterpolated(sessions);
    }
  }, [sessions]);

  React.useEffect(() => {
    const elapsedMs = Date.now() - lastFetchRef.current;
    const elapsedTicks = elapsedMs * 10_000; // ms → 100-nanosecond ticks
    setInterpolated(
      sessionsRef.current.map((s) =>
        s.isPaused
          ? s
          : { ...s, positionTicks: s.positionTicks + elapsedTicks }
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  if (isLoading) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Now Playing
        </Typography>
        <Stack spacing={2}>
          <SessionSkeleton />
          <SessionSkeleton />
        </Stack>
      </Box>
    );
  }

  if (error) return null; // silently hide if sessions endpoint fails

  if (!interpolated || interpolated.length === 0) return null;

  return (
    <Box sx={{ mb: 4 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
        <Typography variant="h6" fontWeight={700}>
          Now Playing
        </Typography>
        <Chip
          label={interpolated.length}
          size="small"
          color="primary"
          sx={{ height: 20, fontSize: '0.72rem' }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="caption" color="text.secondary">
          Updates every 10s
        </Typography>
      </Stack>
      <Stack spacing={2}>
        {interpolated.map((s) => (
          <SessionCard key={s.sessionId} session={s} />
        ))}
      </Stack>
      <Divider sx={{ mt: 3 }} />
    </Box>
  );
}
