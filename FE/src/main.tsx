import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Web3Provider } from './contexts/Web3Context';
import './index.css';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <Web3Provider>
          <App />
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: '!bg-surface-800 !text-white !border !border-surface-700 !rounded-xl',
              duration: 4000,
            }}
          />
        </Web3Provider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
