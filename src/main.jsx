import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
const Launcher = React.lazy(() => import('./components/Launcher'));
import './styles.css';
import './themes.css';
import './ecosystem.css';
import './usability.css';
import './item-presentations.css';
import './receipt.css';
import './desktop.css';
import './workspace-polish.css';
import { PreferencesProvider } from './preferences';
const launcher = window.location.hash === '#launcher';
if (launcher) document.documentElement.dataset.window = 'launcher';
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PreferencesProvider>
      {launcher ? (
        <React.Suspense fallback={null}>
          <Launcher />
        </React.Suspense>
      ) : (
        <App />
      )}
    </PreferencesProvider>
  </React.StrictMode>,
);
