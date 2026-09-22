import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiHost = env.VITE_API_HOST || 'localhost:3000'

  return {
    plugins: [
      vue(),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // dev server 端代理，避免瀏覽器直接跨 origin 打後端被 CORS 擋下來
      proxy: {
        '/machines': `http://${apiHost}`,
        '/history': `http://${apiHost}`,
        '/metadata': `http://${apiHost}`,
      },
    },
  }
})
