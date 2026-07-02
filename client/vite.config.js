import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Hämta miljövariabler från projektets rotmapp (där .env ligger)
  const env = loadEnv(mode, process.cwd() + '/../', '')
  const port = env.PORT || '8085'
  const target = `http://127.0.0.1:${port}`

  return {
    base: '/iot/',
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      // Proxya API-anrop och WebSocket till Express-servern
      // under development. I produktion serveras appen av Express.
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
        },
        '/socket.io': {
          target,
          changeOrigin: true,
          ws: true, // WebSocket-proxy
        },
        '/code-graph': {
          target,
          changeOrigin: true,
        },
        '/graphify-out': {
          target,
          changeOrigin: true,
        },
      },
    },
  }
})
