import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Backend NestJS en desarrollo. Cámbialo si la API corre en otro puerto. */
const API_TARGET = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  preview: { port: 5173 },
});
