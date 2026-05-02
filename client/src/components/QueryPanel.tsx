import { Box, Card, CardContent, Typography, Grid, FormControlLabel, Checkbox, Switch, Button, Divider, CircularProgress, Alert, Chip, Autocomplete, TextField, MenuItem } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import dayjs from 'dayjs';
import { NoActivityWithinFilter, QueryParams } from '../types';

interface Props {
	params: QueryParams;
	onParamsChange: (params: QueryParams) => void;
	loading: boolean;
	resultCount?: number;
	totalCount?: number;
	requesterOptions: string[];
	error?: string | null;
}

const activityFilterOptions: { value: NoActivityWithinFilter; label: string }[] = [
	{ value: '', label: 'Ignore' },
	{ value: '1m', label: '1 month' },
	{ value: '2m', label: '2 months' },
	{ value: '3m', label: '3 months' },
	{ value: '6m', label: '6 months' },
	{ value: '1y', label: '1 year' },
	{ value: '18m', label: '18 months' },
	{ value: 'never', label: 'Never' },
];

export default function QueryPanel({ params, onParamsChange, loading, resultCount, totalCount, requesterOptions, error }: Props) {
	const startDate = params.startDate ? dayjs(params.startDate) : null;
	const endDate = params.endDate ? dayjs(params.endDate) : null;

	const updateParams = (patch: Partial<QueryParams>) => {
		onParamsChange({ ...params, ...patch });
	};

	const handleClearDates = () => {
		updateParams({ startDate: null, endDate: null });
	};

	return (
		<Card>
			<CardContent sx={{ p: { xs: 2, sm: 3 } }}>
				<Typography variant='h6' fontWeight={600} gutterBottom>
					Query Filters
				</Typography>
				<Divider sx={{ mb: 2 }} />

				<Grid container spacing={2} alignItems='flex-start'>
					{/* Date Range */}
					<Grid item xs={12} md={5}>
						<Typography variant='subtitle2' color='text.secondary' gutterBottom>
							Date Added to Library
						</Typography>
						<Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
							<DatePicker
								label='From'
								value={startDate}
								onChange={(v) => updateParams({ startDate: v ? v.format('YYYY-MM-DD') : null })}
								maxDate={endDate ?? undefined}
								slotProps={{
									textField: { size: 'small', sx: { flex: 1, minWidth: 130 } },
									field: { clearable: true },
								}}
							/>
							<DatePicker
								label='To'
								value={endDate}
								onChange={(v) => updateParams({ endDate: v ? v.format('YYYY-MM-DD') : null })}
								minDate={startDate ?? undefined}
								slotProps={{
									textField: { size: 'small', sx: { flex: 1, minWidth: 130 } },
									field: { clearable: true },
								}}
							/>
							{(startDate || endDate) && (
								<Button size='small' variant='text' onClick={handleClearDates} sx={{ alignSelf: 'center' }}>
									Clear
								</Button>
							)}
						</Box>
					</Grid>

					{/* Media Types */}
					<Grid item xs={12} sm={6} md={3}>
						<Typography variant='subtitle2' color='text.secondary' gutterBottom>
							Media Types
						</Typography>
						<Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
							<FormControlLabel
								control={<Checkbox checked={params.includeMovies} onChange={(e) => updateParams({ includeMovies: e.target.checked })} icon={<MovieIcon />} checkedIcon={<MovieIcon color='primary' />} />}
								label='Movies'
							/>
							<FormControlLabel
								control={<Checkbox checked={params.includeShows} onChange={(e) => updateParams({ includeShows: e.target.checked })} icon={<TvIcon />} checkedIcon={<TvIcon color='primary' />} />}
								label='TV Shows'
							/>
						</Box>
					</Grid>

					{/* Activity + Requester Filters */}
					<Grid item xs={12} sm={6} md={4} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
						<TextField
							select
							size='small'
							label='No activity within'
							value={params.noActivityWithin}
							onChange={(e) => updateParams({ noActivityWithin: e.target.value as NoActivityWithinFilter })}
							helperText='Filter by the most recent watch activity'
						>
							{activityFilterOptions.map((option) => (
								<MenuItem key={option.value || 'ignore'} value={option.value}>
									{option.label}
								</MenuItem>
							))}
						</TextField>

						<FormControlLabel
							control={<Switch checked={params.showUnwatchedOnly} onChange={(e) => updateParams({ showUnwatchedOnly: e.target.checked })} color='warning' />}
							label={
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
									<VisibilityOffIcon fontSize='small' />
									<Typography variant='body2'>Unwatched only</Typography>
								</Box>
							}
						/>
					</Grid>

					<Grid item xs={12} md={8}>
						<Autocomplete
							multiple
							options={requesterOptions}
							value={params.excludeRequesters}
							onChange={(_, value) => updateParams({ excludeRequesters: value })}
							renderInput={(inputParams) => (
								<TextField {...inputParams} label='Exclude requesters' placeholder={params.excludeRequesters.length === 0 ? 'None' : ''} size='small' />
							)}
							renderTags={(value, getTagProps) =>
								value.map((requester, index) => {
									const { key, ...tagProps } = getTagProps({ index });
									return <Chip key={key} icon={<PersonOffIcon />} label={requester} size='small' {...tagProps} />;
								})
							}
						/>
					</Grid>

					<Grid item xs={12} md={4}>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', minHeight: 40 }}>
							{loading && <Chip icon={<CircularProgress size={14} />} label='Searching...' color='primary' variant='outlined' />}
							{resultCount !== undefined && !loading && (
								<Chip
									label={totalCount !== undefined && totalCount !== resultCount ? `${resultCount} of ${totalCount}` : `${resultCount} result${resultCount !== 1 ? 's' : ''}`}
									color='primary'
									variant='outlined'
								/>
							)}
							{!params.includeMovies && !params.includeShows && <Chip label='Select at least one media type' color='warning' variant='outlined' />}
						</Box>
					</Grid>
				</Grid>

				{error && (
					<Alert severity='error' sx={{ mt: 2 }}>
						{error}
					</Alert>
				)}

				{!loading && resultCount === undefined && (
					<Typography variant='body2' color='text.secondary' sx={{ mt: 2 }}>
						Loading saved filters and media results.
					</Typography>
				)}
			</CardContent>
		</Card>
	);
}
