import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { watch: { ignored: [decodeURIComponent(new URL('./output/**', import.meta.url).pathname), '**/.playwright-cli/**'] } },
  build: {
    target: ['es2017', 'chrome61'], cssTarget: 'chrome61',
    rollupOptions: { output: { manualChunks: { three: ['three'], react: ['react', 'react-dom'] } } },
  },
});
