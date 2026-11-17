import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// 小红书小工具（离线 H5）专用构建：单文件 IIFE 经典脚本，无 module/import，
// 目标 Chrome 61 / ES2017，产物写入 dist-tool，由 scripts/build-tool.sh 组装 index.html 后打包 zip。
export default defineConfig({
  base: './',
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    target: ['es2017', 'chrome61'], cssTarget: 'chrome61',
    outDir: 'dist-tool',
    emptyOutDir: true,
    lib: { entry: 'src/main.tsx', formats: ['iife'], name: 'ShanghaiRanger', fileName: () => 'app.js', cssFileName: 'shanghai-ranger' },
    cssCodeSplit: false,
  },
});
