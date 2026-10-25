import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildTimestamp = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date())

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('0.2.0'),
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
  },
})
