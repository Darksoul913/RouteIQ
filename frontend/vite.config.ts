import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/route': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/models': 'http://localhost:8000',
      '/chaos': 'http://localhost:8000',
      '/audit': 'http://localhost:8000',
      '/benchmark': 'http://localhost:8000',
      '/telemetry': 'http://localhost:8000',
      '/events': 'http://localhost:8000'
    }
  }
});
