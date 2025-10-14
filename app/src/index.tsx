import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SolanaProvider } from './context/SolanaProvider';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <SolanaProvider>
      <App />
    </SolanaProvider>
  </React.StrictMode>
);