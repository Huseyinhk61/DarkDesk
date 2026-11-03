import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ command }) => ({
  base: './',
  build: { rollupOptions: { output: { manualChunks: { 'regex-engine': ['re2js'] } } } },
  plugins: [
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
