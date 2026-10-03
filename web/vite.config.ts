import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// 데모 모드 공유 상태: dev 서버 메모리에 보관해 이용자·도우미(다른 브라우저/프로필)가 같은 진행 상태를 본다.
// GET /__demo/state → 전체 상태, POST {rid,stage,result} → 병합, DELETE → 초기화. 개발 전용.
type DemoEntry = { stage?: string; result?: string; messages?: unknown[]; successFee?: number; upfront?: number }
function demoState(): Plugin {
  let state: Record<string, DemoEntry> = {}
  // 데모 업로드 파일: PUT /__demo/file/{key}로 받아 메모리에 두고, GET으로 돌려준다(증빙 사진을 화면에 보여 주려고).
  const files = new Map<string, { type: string; body: Buffer }>()
  return {
    name: 'pico-demo-state',
    configureServer(server) {
      server.middlewares.use('/__demo/file/', (req, res) => {
        const key = decodeURIComponent((req.url ?? '').replace(/^\//, '').split('?')[0])
        if (req.method === 'PUT') {
          const chunks: Buffer[] = []
          req.on('data', (c: Buffer) => chunks.push(c))
          req.on('end', () => {
            files.set(key, { type: String(req.headers['content-type'] || 'application/octet-stream'), body: Buffer.concat(chunks) })
            res.end()
          })
          return
        }
        const f = files.get(key)
        if (!f) {
          res.statusCode = 404
          return res.end()
        }
        res.setHeader('Content-Type', f.type)
        res.end(f.body)
      })
      server.middlewares.use('/__demo/state', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method === 'DELETE') {
          state = {}
          files.clear()
          return res.end('{}')
        }
        if (req.method === 'POST') {
          let raw = ''
          req.on('data', (c) => (raw += c))
          req.on('end', () => {
            try {
              const { rid, addMessage, ...fields } = JSON.parse(raw || '{}')
              if (rid) {
                const prev = state[rid] ?? {}
                state[rid] = {
                  ...prev,
                  ...fields, // stage·result·successFee·upfront 등 넘어온 필드를 병합
                  messages: addMessage ? [...(prev.messages ?? []), addMessage] : prev.messages,
                }
              }
            } catch {
              /* ignore */
            }
            res.end(JSON.stringify(state))
          })
          return
        }
        res.end(JSON.stringify(state))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // .env.local의 API_PROXY_TARGET으로 /api 요청을 넘겨 개발 중 CORS 없이 백엔드에 붙는다.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), demoState()],
    server: {
      proxy: {
        '/api': { target: env.API_PROXY_TARGET || 'http://localhost:8080', changeOrigin: true },
      },
    },
  }
})
