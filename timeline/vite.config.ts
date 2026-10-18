import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { entries: ['index.html'] },
  server: { watch: { ignored: ['**/.nanoka/**', '**/.timeline/**', '**/functions/lib/**', '**/evidence/**', '**/tools/**', '**/public/nanoka/**', '**/public/localization/**'] } },
})
