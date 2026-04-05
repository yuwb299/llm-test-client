import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import url from 'node:url'
import http from 'node:http'
import https from 'node:https'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

function corsProxyPlugin(): Plugin {
  return {
    name: 'vite-cors-proxy',
    configureServer(server) {
      server.middlewares.use('/api-proxy' as any, (req: any, res: any, next: any) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', '*')
          res.setHeader('Access-Control-Allow-Headers', '*')
          res.writeHead(204)
          res.end()
          return
        }

        const targetBase = req.headers['x-proxy-target'] as string
        if (!targetBase) {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end('Missing X-Proxy-Target header')
          return
        }

        let targetUrl: URL
        try {
          targetUrl = new URL(`${targetBase.replace(/\/+$/, '')}${req.url || ''}`)
        } catch {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end(`Invalid target URL: ${targetBase}${req.url}`)
          return
        }

        const lib = targetUrl.protocol === 'https:' ? https : http

        const fwdHeaders: Record<string, string> = {}
        for (const [k, v] of Object.entries(req.headers as Record<string, string | string[] | undefined>)) {
          if (['host', 'connection', 'origin', 'referer', 'x-proxy-target'].includes(k)) continue
          if (typeof v === 'string') fwdHeaders[k] = v
          else if (Array.isArray(v)) fwdHeaders[k] = v.join(', ')
        }
        fwdHeaders.host = targetUrl.host

        const proxyReq = lib.request(targetUrl.toString(), {
          method: req.method,
          headers: fwdHeaders,
        }, (proxyRes: any) => {
          const h: Record<string, string> = {}
          for (const [k, v] of Object.entries(proxyRes.headers as Record<string, string | string[]>)) {
            if (typeof v === 'string') h[k] = v
            else if (Array.isArray(v)) h[k] = v.join(', ')
          }
          h['access-control-allow-origin'] = '*'
          res.writeHead(proxyRes.statusCode || 502, h)
          proxyRes.pipe(res, { end: true })
        })

        proxyReq.on('error', (err: any) => {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' })
          }
          res.end(JSON.stringify({ error: { message: `Proxy error: ${err.message}` } }))
        })

        req.pipe(proxyReq)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), corsProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})
