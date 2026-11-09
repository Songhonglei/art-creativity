import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { watch: { ignored: ['**/output/**', '**/.playwright-cli/**'] } },
  build: {
    target: 'es2017',
    rollupOptions: { output: { manualChunks: { three: ['three'], react: ['react', 'react-dom'] } } },
  },
});
