import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process';
import packageJson from './package.json';

// Get current git commit hash
let gitHash = 'unknown';
try {
  gitHash = execSync('git rev-parse --short HEAD').toString().trim();
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
     gitHash = process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7);
  }
} catch (e) {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
     gitHash = process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7);
  }
}

// Get total commit count as build number
let buildNumber = '0';
try {
  buildNumber = execSync('git rev-list --count HEAD').toString().trim();
} catch (e) {
  // Fallback
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __GIT_HASH__: JSON.stringify(gitHash),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  }
})
