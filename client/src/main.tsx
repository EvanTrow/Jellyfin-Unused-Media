import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,   // server disk cache is permanent — clear cache to refresh
      gcTime: 60 * 60 * 1000,
      retry: 1,
    },
  },
});

// Expose queryClient globally so Settings page can clear it
(window as unknown as { __queryClient: QueryClient }).__queryClient = queryClient;
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
