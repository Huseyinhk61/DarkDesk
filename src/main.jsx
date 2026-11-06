import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
const Launcher = React.lazy(() => import('./components/Launcher'));
const WidgetWindow = React.lazy(() => import('./components/WidgetWindow'));
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
const widget = /^#widget=(system|note|todos|currency|clock|focus)$/.test(window.location.hash);
if (widget) document.documentElement.dataset.window = 'widget';
if (launcher) document.documentElement.dataset.window = 'launcher';
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PreferencesProvider>
      {widget ? (
        <React.Suspense fallback={null}>
          <WidgetWindow />
        </React.Suspense>
      ) : launcher ? (
        <React.Suspense fallback={null}>
          <Launcher />
        </React.Suspense>
      ) : (
        <App />
      )}
    </PreferencesProvider>
  </React.StrictMode>,
);
