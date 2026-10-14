import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages serves this repo at /portfolio/, so built asset URLs need that
  // prefix. Dev keeps the root path.
  base: command === 'build' ? '/portfolio/' : '/',
}))
