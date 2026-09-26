import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3050,
    strictPort: true,
    host: '127.0.0.1',
    open: false
  },
  preview: {
    port: 3050,
    strictPort: true,
    host: '127.0.0.1'
  }
});
