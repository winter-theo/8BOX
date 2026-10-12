import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Fixed port: the server's ALLOWED_ORIGINS defaults to http://localhost:5173.
  server: { port: 5173, strictPort: true },
});
