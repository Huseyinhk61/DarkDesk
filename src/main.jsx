import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Launcher from './components/Launcher';
import './styles.css';
import './themes.css';
import './ecosystem.css';
import './usability.css';
import './item-presentations.css';
import './receipt.css';
import './desktop.css';
import { PreferencesProvider } from './preferences';
const launcher = window.location.hash === '#launcher';
if (launcher) document.documentElement.dataset.window = 'launcher';
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PreferencesProvider>{launcher ? <Launcher /> : <App />}</PreferencesProvider>
  </React.StrictMode>,
);
