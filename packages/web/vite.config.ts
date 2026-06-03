import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { URL } from 'url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const authToken = env.TOKENWATCH_AUTH_TOKEN || ''

  return {
    plugins: [react()],
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
          configure: (proxy) => {
            proxy.on('proxyReqWs', (proxyReq, _req, socket) => {
              if (authToken) {
                const url = new URL(proxyReq.path || '/', 'http://localhost')
                url.searchParams.set('token', authToken)
                proxyReq.path = url.pathname + url.search
              }
            })
          },
        },
      },
    },
  }
})