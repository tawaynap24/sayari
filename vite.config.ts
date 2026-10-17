import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Discovery evidence contains upstream HTML. Only scan the application's entry.
  optimizeDeps: { entries: ['index.html'] },
  server: {
    watch: {
      ignored: ['**/.nanoka/**', '**/evidence/**', '**/tools/**', '**/public/nanoka/**', '**/public/localization/**', '**/SAYARI_NANOKA_ZZZ_CODEX_KIT_20261018/**'],
    },
  },
})
