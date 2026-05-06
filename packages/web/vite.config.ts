import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const authToken = env.TOKENWATCH_AUTH_TOKEN || ''

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_TOKENWATCH_AUTH_TOKEN': JSON.stringify(authToken),
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:57821',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (authToken) {
                proxyReq.setHeader('Authorization', `Bearer ${authToken}`)
              }
            })
          },
        },
        '/ws': {
          target: 'ws://localhost:57821',
          ws: true,
        },
      },
    },
  }
})