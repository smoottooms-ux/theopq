import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './lib/store';
import { ToastProvider } from './components/ui';
import './index.css';

// HashRouter, not BrowserRouter: the Android WebView serves the bundle from
// file://-style origins where path routing does not survive a reload.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AppProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AppProvider>
    </HashRouter>
  </StrictMode>,
);
