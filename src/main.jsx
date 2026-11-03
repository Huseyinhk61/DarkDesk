import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './themes.css';
import { PreferencesProvider } from './preferences';
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </React.StrictMode>,
);
