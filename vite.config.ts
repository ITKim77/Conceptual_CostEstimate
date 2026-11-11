import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  base: '/Conceptual_CostEstimate/',
  plugins: [react()],
  server: {
    port: 5173,
    open: false
  }
});

