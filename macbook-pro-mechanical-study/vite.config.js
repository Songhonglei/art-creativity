import { defineConfig } from 'vite';

// base './' keeps dist/ portable (sub-path hosting and file:// inspection)
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/examples/')) return 'three-addons';
          if (id.includes('/node_modules/three/build/three.module.js')) return 'three-renderer';
          if (id.includes('/node_modules/three/')) return 'three-core';
          if (id.includes('/node_modules/lucide/')) return 'icons';
        },
      },
    },
  },
});
