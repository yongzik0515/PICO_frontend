import { useEffect, useState } from 'react'
import { Board, type BoardModule } from './runtime/Board'
import { BOARDS } from './routes.js'
import * as main from './boards/main.js'
import * as my from './boards/my.js'
import * as leads from './boards/leads.js'
import * as detail from './boards/detail.js'
import * as terms from './boards/terms.js'
import * as start from './boards/start.js'
import * as result from './boards/result.js'
import * as cases from './boards/cases.js'
import * as practice from './boards/practice.js'
import * as apply from './boards/apply.js'

// '사전 신청하고 회원가입하기'를 누르면 갈 곳
const SIGNUP_URL = 'https://pico-kr.app/login'

// 시안에서는 안내 문구만 띄우던 사전 신청 버튼을 실제 회원가입으로 잇는다.
const applyMod: BoardModule = {
  ...(apply as unknown as BoardModule),
  default: class extends (apply as unknown as BoardModule).default {
    renderVals() {
      return { ...super.renderVals(), apply: () => window.location.assign(SIGNUP_URL) }
    }
  },
}

const MODULES = { main, my, leads, detail, terms, start, result, cases, practice, apply: applyMod } as unknown as Record<string, BoardModule>

const byPath = (p: string) => BOARDS.find((b) => b.path === p) ?? BOARDS[0]
const hrefOf = (file: string) => BOARDS.find((b) => b.file === file)?.path

export default function App() {
  const [path, setPath] = useState(() => byPath(window.location.pathname).path)
  const board = byPath(path)

  useEffect(() => {
    const onPop = () => setPath(byPath(window.location.pathname).path)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    document.title = `${board.title} · PICO 체험해보기`
  }, [board])

  const go = (file: string) => {
    const next = hrefOf(file)
    if (!next) return
    window.history.pushState(null, '', next + window.location.search)
    setPath(next)
  }

  return (
    <div className="stage">
      <main className="phone">
        <Board key={board.slug} mod={MODULES[board.slug]} go={go} hrefOf={hrefOf} />
      </main>
    </div>
  )
}
