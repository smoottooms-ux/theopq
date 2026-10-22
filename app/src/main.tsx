import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './lib/store';
import { ToastProvider } from './components/ui';
import './index.css';

/*
 * Ask the browser to keep this data.
 *
 * Safari evicts site storage for an app that has not been opened in a while,
 * and on an iPhone installed to the home screen this app's recordings are the
 * only copy. Persistence is granted on a heuristic rather than a prompt, and
 * being installed to the home screen counts towards it, so asking is worth
 * doing and costs nothing when it is refused.
 */
void navigator.storage?.persist?.().catch(() => undefined);

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
