import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// Réglages › À propos shows the version of package.json.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  root: 'web',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version)
  },
  build: {
    outDir: '../dist/web',
    emptyOutDir: true
  },
  server: {
    // Forward API calls to a locally running server during development.
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/health': 'http://127.0.0.1:3000'
    }
  }
})
