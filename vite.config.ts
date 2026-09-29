import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'

const target = process.env.SLATE_API_URL ?? 'http://localhost:8081'
const apiProxy: ProxyOptions = {
  target,
  changeOrigin: true,
  configure(proxy) {
    proxy.on('proxyReq', (proxyReq) => {
      proxyReq.setHeader('origin', 'http://localhost:5173')
    })
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': apiProxy,
      '/mock': apiProxy,
    },
  },
})
