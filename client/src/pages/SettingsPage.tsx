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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Autocomplete,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import CachedIcon from '@mui/icons-material/Cached';
import ScheduleIcon from '@mui/icons-material/Schedule';
import MovieIcon from '@mui/icons-material/Movie';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LanguageIcon from '@mui/icons-material/Language';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SendIcon from '@mui/icons-material/Send';
import { useQueryClient } from '@tanstack/react-query';
import { fetchSettings, saveSettings, clearServerCache, clearServerCacheReport, sendDiscordIntroMessage } from '../services/api';
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

interface EmojiOption {
  emoji: string;
  label: string;
  keywords: string;
}

const api = axios.create({ baseURL: '/api' });

const VOTE_EMOJI_OPTIONS: EmojiOption[] = [
  { emoji: '👍', label: 'Thumbs Up', keywords: 'approve agree yes remove delete ok' },
  { emoji: '👎', label: 'Thumbs Down', keywords: 'reject disagree no keep' },
  { emoji: '✅', label: 'Check Mark', keywords: 'approve yes ok done keep' },
  { emoji: '❌', label: 'Cross Mark', keywords: 'reject no remove delete' },
  { emoji: '🗑️', label: 'Trash', keywords: 'remove delete bin garbage' },
  { emoji: '🚫', label: 'No Entry', keywords: 'block no reject remove' },
  { emoji: '👌', label: 'OK Hand', keywords: 'ok approve agree' },
  { emoji: '🙌', label: 'Raised Hands', keywords: 'approve celebrate agree keep' },
  { emoji: '👏', label: 'Clap', keywords: 'approve agree' },
  { emoji: '🤷', label: 'Shrug', keywords: 'unsure neutral abstain' },
  { emoji: '❤️', label: 'Heart', keywords: 'love favorite keep' },
  { emoji: '⭐', label: 'Star', keywords: 'favorite keep good' },
  { emoji: '🔥', label: 'Fire', keywords: 'hot good favorite keep' },
  { emoji: '💀', label: 'Skull', keywords: 'dead remove delete' },
  { emoji: '👀', label: 'Eyes', keywords: 'watch review look' },
];

function getEmojiOption(value: string): EmojiOption | null {
  return VOTE_EMOJI_OPTIONS.find((option) => option.emoji === value.trim()) ?? null;
}

function getEmojiValue(value: string | EmojiOption | null): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.emoji;
}

function VoteEmojiAutocomplete({
  label,
  value,
  helperText,
  onChange,
}: {
  label: string;
  value: string;
  helperText: string;
  onChange: (value: string) => void;
}) {
  return (
    <Autocomplete<EmojiOption, false, false, true>
      freeSolo
      options={VOTE_EMOJI_OPTIONS}
      value={getEmojiOption(value) ?? value}
      getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.emoji} ${option.label}`)}
      filterOptions={(options, state) => {
        const input = state.inputValue.trim().toLowerCase();
        if (!input) return options;
        return options.filter((option) => `${option.emoji} ${option.label} ${option.keywords}`.toLowerCase().includes(input));
      }}
      onChange={(_event, nextValue) => onChange(getEmojiValue(nextValue))}
      onInputChange={(_event, nextInput, reason) => {
        if (reason === 'input') onChange(nextInput);
      }}
      renderOption={(props, option) => (
        <Box component="li" {...props} sx={{ gap: 1 }}>
          <Typography component="span" sx={{ width: 28, fontSize: 20, lineHeight: 1 }}>
            {option.emoji}
          </Typography>
          <Typography component="span" variant="body2">
            {option.label}
          </Typography>
        </Box>
      )}
      renderInput={(params) => <TextField {...params} label={label} helperText={helperText} />}
    />
  );
}

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
  const [localJellyfinPublicUrl, setLocalJellyfinPublicUrl] = React.useState('');
  const [savingJellyfin, setSavingJellyfin] = React.useState(false);
  const [localDiscordBotToken, setLocalDiscordBotToken] = React.useState('');
  const [localDiscordChannelId, setLocalDiscordChannelId] = React.useState('');
  const [discordChannelName, setDiscordChannelName] = React.useState('');
  const [localDiscordIntroMessage, setLocalDiscordIntroMessage] = React.useState('');
  const [localDiscordKeepVoteEmoji, setLocalDiscordKeepVoteEmoji] = React.useState('');
  const [localDiscordRemoveVoteEmoji, setLocalDiscordRemoveVoteEmoji] = React.useState('');
  const [discordError, setDiscordError] = React.useState<string | null>(null);
  const [savingDiscord, setSavingDiscord] = React.useState(false);
  const [sendingIntro, setSendingIntro] = React.useState(false);
  const [confirmIntroOpen, setConfirmIntroOpen] = React.useState(false);

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
      setLocalJellyfinPublicUrl(s.jellyfinPublicUrl);
      setLocalDiscordBotToken(s.discordBotToken);
      setLocalDiscordChannelId(s.discordChannelId);
      setDiscordChannelName(s.discordChannelName);
      setLocalDiscordIntroMessage(s.discordIntroMessage);
      setLocalDiscordKeepVoteEmoji(s.discordKeepVoteEmoji);
      setLocalDiscordRemoveVoteEmoji(s.discordRemoveVoteEmoji);
      setDiscordError(null);
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

  const handleSaveJellyfin = async () => {
    setSavingJellyfin(true);
    try {
      const updated = await saveSettings({ jellyfinPublicUrl: localJellyfinPublicUrl });
      setSettings(updated);
      setLocalJellyfinPublicUrl(updated.jellyfinPublicUrl);
      onSnackbar('Jellyfin public URL saved', 'success');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      onSnackbar(axiosError?.response?.data?.error ?? 'Failed to save Jellyfin settings', 'error');
    } finally {
      setSavingJellyfin(false);
    }
  };

  const handleSaveDiscord = async () => {
    setSavingDiscord(true);
    setDiscordError(null);
    try {
      const updated = await saveSettings({
        discordBotToken: localDiscordBotToken,
        discordChannelId: localDiscordChannelId,
        discordIntroMessage: localDiscordIntroMessage,
        discordKeepVoteEmoji: localDiscordKeepVoteEmoji,
        discordRemoveVoteEmoji: localDiscordRemoveVoteEmoji,
      });
      setSettings(updated);
      setLocalDiscordBotToken(updated.discordBotToken);
      setLocalDiscordChannelId(updated.discordChannelId);
      setDiscordChannelName(updated.discordChannelName);
      setLocalDiscordIntroMessage(updated.discordIntroMessage);
      setLocalDiscordKeepVoteEmoji(updated.discordKeepVoteEmoji);
      setLocalDiscordRemoveVoteEmoji(updated.discordRemoveVoteEmoji);
      onSnackbar(updated.discordChannelId ? `Discord channel verified: #${updated.discordChannelName}` : 'Discord settings cleared', 'success');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const message = axiosError?.response?.data?.error ?? 'Failed to verify Discord channel';
      setDiscordError(message);
      onSnackbar(message, 'error');
    } finally {
      setSavingDiscord(false);
    }
  };

  const handleSendIntroMessage = async () => {
    setSendingIntro(true);
    try {
      const message = localDiscordIntroMessage.trim();
      const updated = await saveSettings({ discordIntroMessage: message });
      setSettings(updated);
      setLocalDiscordIntroMessage(updated.discordIntroMessage);
      await sendDiscordIntroMessage(updated.discordIntroMessage);
      await loadSettings();
      onSnackbar('Discord intro message sent and pinned', 'success');
      setConfirmIntroOpen(false);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      onSnackbar(axiosError?.response?.data?.error ?? 'Failed to send Discord intro message', 'error');
    } finally {
      setSendingIntro(false);
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
  const isJellyfinDirty = settings !== null && localJellyfinPublicUrl !== settings.jellyfinPublicUrl;
  const isDiscordDirty =
    settings !== null &&
    (localDiscordBotToken !== settings.discordBotToken ||
      localDiscordChannelId !== settings.discordChannelId ||
      localDiscordIntroMessage !== settings.discordIntroMessage ||
      localDiscordKeepVoteEmoji !== settings.discordKeepVoteEmoji ||
      localDiscordRemoveVoteEmoji !== settings.discordRemoveVoteEmoji);
  const canSendIntro = !!settings?.discordBotToken && !!settings.discordChannelId && localDiscordIntroMessage.trim().length > 0;
  const ttlLabel = localTtl === 0 ? 'Never expires' : `${localTtl} hour${localTtl !== 1 ? 's' : ''}`;
  const discordHelperText = discordError
    ? discordError
    : discordChannelName
      ? `Channel: #${discordChannelName}`
      : 'Save to verify the bot can access this channel';

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Settings
      </Typography>

      <Stack spacing={3}>
        {/* Jellyfin */}
        <Card variant="outlined">
          <CardHeader
            avatar={<LanguageIcon />}
            title="Jellyfin"
            subheader="Public URL used when linking to Jellyfin items outside your network"
          />
          <Divider />
          <CardContent>
            {loadingSettings ? (
              <CircularProgress size={24} />
            ) : (
              <>
                <TextField
                  fullWidth
                  label="Public Jellyfin URL"
                  placeholder="https://jellyfin.example.com"
                  value={localJellyfinPublicUrl}
                  onChange={(e) => setLocalJellyfinPublicUrl(e.target.value)}
                  helperText="Used to rewrite Jellyfin links sent to Discord"
                  sx={{ mb: 2 }}
                />
                <Button
                  variant="contained"
                  disabled={!isJellyfinDirty || savingJellyfin}
                  onClick={handleSaveJellyfin}
                >
                  {savingJellyfin ? 'Saving…' : 'Save'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Discord */}
        <Card variant="outlined">
          <CardHeader
            avatar={<SmartToyIcon />}
            title="Discord"
            subheader="Bot credentials used to post removal notices"
          />
          <Divider />
          <CardContent>
            {loadingSettings ? (
              <CircularProgress size={24} />
            ) : (
              <>
                <Stack spacing={2} sx={{ mb: 2 }}>
                  <TextField
                    fullWidth
                    type="password"
                    label="Bot Token"
                    value={localDiscordBotToken}
                    onChange={(e) => {
                      setLocalDiscordBotToken(e.target.value);
                      setDiscordError(null);
                    }}
                    autoComplete="off"
                  />
                  <TextField
                    fullWidth
                    label="Channel ID"
                    value={localDiscordChannelId}
                    onChange={(e) => {
                      setLocalDiscordChannelId(e.target.value);
                      setDiscordError(null);
                      if (e.target.value !== settings?.discordChannelId) setDiscordChannelName('');
                    }}
                    helperText={discordHelperText}
                    error={!!discordError}
                  />
                  <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      <VoteEmojiAutocomplete
                        label="Keep Vote Emoji"
                        value={localDiscordKeepVoteEmoji}
                        onChange={setLocalDiscordKeepVoteEmoji}
                        helperText="Reaction added for keep votes"
                      />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <VoteEmojiAutocomplete
                        label="Remove Vote Emoji"
                        value={localDiscordRemoveVoteEmoji}
                        onChange={setLocalDiscordRemoveVoteEmoji}
                        helperText="Reaction added for remove votes"
                      />
                    </Box>
                  </Stack>
                  <TextField
                    fullWidth
                    multiline
                    minRows={8}
                    label="Intro Message Markdown"
                    value={localDiscordIntroMessage}
                    onChange={(e) => setLocalDiscordIntroMessage(e.target.value)}
                    helperText="Markdown message posted and pinned in the configured Discord channel"
                  />
                </Stack>
                <Stack direction={isMobile ? 'column' : 'row'} spacing={1.5}>
                  <Button
                    variant="contained"
                    disabled={!isDiscordDirty || savingDiscord}
                    onClick={handleSaveDiscord}
                  >
                    {savingDiscord ? 'Verifying…' : 'Save'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<SendIcon />}
                    disabled={!canSendIntro || savingDiscord || sendingIntro}
                    onClick={() => setConfirmIntroOpen(true)}
                  >
                    {sendingIntro ? 'Sending…' : 'Send Intro Message'}
                  </Button>
                </Stack>
              </>
            )}
          </CardContent>
        </Card>

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

      <Dialog open={confirmIntroOpen} onClose={() => !sendingIntro && setConfirmIntroOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Send Discord intro message?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will post or update the intro message in #{discordChannelName || 'the configured channel'} and pin it.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmIntroOpen(false)} disabled={sendingIntro}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSendIntroMessage} disabled={sendingIntro}>
            {sendingIntro ? 'Sending…' : 'Send and Pin'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
