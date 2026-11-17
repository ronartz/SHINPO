import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

let commitHash = 'release-gate'
try {
  commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
} catch {
  // fallback if git is unavailable
}

export default defineConfig({
  plugins: [react()],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __APP_VERSION__: JSON.stringify('0.1.0-beta.1'),
  },
  build: {
    target: ['es2022', 'chrome100', 'safari15'],
  },
})
