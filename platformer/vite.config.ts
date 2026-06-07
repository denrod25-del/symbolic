import { defineConfig } from 'vite';

// `base: './'` keeps asset URLs relative so the static build works whether it's
// served from a domain root (Vercel/Netlify) or a subpath (GitHub Pages).
export default defineConfig({
  base: './',
});
