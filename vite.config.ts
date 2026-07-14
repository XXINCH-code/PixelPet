import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths let the same build work at a domain root or a GitHub Pages subpath.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
