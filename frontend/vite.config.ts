import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const api = 'http://localhost:8000';
const proxied = ['/route', '/health', '/models', '/audit', '/benchmark', '/telemetry', '/keys'];

// The backend serves only dist/index.html, so everything is inlined into that one file.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { emptyOutDir: false },
  server: {
    port: 5173,
    proxy: Object.fromEntries(proxied.map((p) => [p, api])),
  },
});
