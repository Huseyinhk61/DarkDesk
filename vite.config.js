import weatherPreviewModule from './scripts/weather-preview.cjs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ command }) => ({
  base: './',
  server: {
    watch: {
      // Native main/preload code needs an Electron restart. It must not
      // reset renderer state when backend tests or packaging touch files.
      // Reports, assets and documentation are not renderer dependencies.
      ignored: [
        '**/electron/**',
        '**/build/**',
        '**/release/**',
        '**/dist/**',
        '**/playwright-report/**',
        '**/test-results/**',
        '**/docs/**',
        '**/scripts/**',
        '**/tests/**',
        '**/*.md',
      ],
    },
  },
  build: { rollupOptions: { output: { manualChunks: { 'regex-engine': ['re2js'] } } } },
  plugins: [
    weatherPreviewModule.weatherPreview(),
    react(),
    tailwindcss(),
    {
      name: 'development-csp',
      transformIndexHtml(html) {
        // React Refresh adds an inline bootstrap only in development.
        return command === 'serve'
          ? html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';")
          : html;
      },
    },
  ],
}));
