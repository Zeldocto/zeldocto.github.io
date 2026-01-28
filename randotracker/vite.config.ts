
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // This ensures assets are linked correctly for zeldocto.github.io/randotracker/
  base: '/randotracker/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
