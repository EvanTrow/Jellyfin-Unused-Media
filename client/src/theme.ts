import { createTheme } from '@mui/material/styles';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#00a4dc' },
    secondary: { main: '#aa5cc3' },
    background: { default: '#f4f6f9', paper: '#ffffff' },
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
          },
        },
      },
    },
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00a4dc' },
    secondary: { main: '#aa5cc3' },
    background: { default: '#101418', paper: '#1c1f26' },
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: '0 2px 12px rgba(0,0,0,0.4)' },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
          },
        },
      },
    },
  },
});
