// 캔버스 원본(사전신청/design/project)의 2차 시안 보드를 src/boards/*.js 모듈로 옮긴다.
// 보드를 고친 뒤 `npm run sync`로 다시 만든다. 만들어진 파일은 직접 고치지 않는다.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOARDS } from '../src/routes.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const src = path.resolve(here, '../../사전신청/design/project')
const out = path.resolve(here, '../src/boards')

const between = (html, open, close) => {
  const i = html.indexOf(open)
  const j = html.indexOf(close, i + open.length)
  if (i < 0 || j < 0) throw new Error(`${open} … ${close} 를 찾지 못했어요`)
  return html.slice(i + open.length, j)
}

for (const { file, slug } of BOARDS) {
  const html = fs.readFileSync(path.join(src, file), 'utf8')
  // 글꼴은 index.html에서 CDN으로 불러오므로 캔버스 전용 @font-face(/_blob/…)는 뺀다.
  const css = between(html, '<style>', '</style>').replace(/@font-face\{[^}]*\}\n?/g, '').trim()
  const xdc = between(html, '<x-dc>', '</x-dc>')
  const template = xdc.slice(xdc.indexOf('</helmet>') + '</helmet>'.length).trim()
  const scriptOpen = html.indexOf('<script type="text/x-dc"')
  const script = scriptOpen < 0 ? '' : between(html.slice(scriptOpen), '>', '</script>').trim()
  const logic = script || 'class Component extends DCLogic {}'

  const code = `// 자동 생성: scripts/sync-boards.mjs ← 사전신청/design/project/${file}. 직접 고치지 마세요.
import { DCLogic } from '../runtime/DCLogic'

export const css = ${JSON.stringify(css)}

export const template = ${JSON.stringify(template)}

${logic}

export default Component
`
  fs.writeFileSync(path.join(out, `${slug}.js`), code)
  console.log(`${file} → src/boards/${slug}.js`)
}
