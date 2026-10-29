import { useEffect, useState } from 'react'
import { Board, type BoardModule } from './runtime/Board'
import { BOARDS } from './routes.js'
import * as role from './boards/role.js'
import * as userMain from './boards/userMain.js'
import * as userProfile from './boards/userProfile.js'
import * as userQuote from './boards/userQuote.js'
import * as userRequest from './boards/userRequest.js'
import * as userEnd from './boards/userEnd.js'
import * as main from './boards/main.js'
import * as my from './boards/my.js'
import * as leads from './boards/leads.js'
import * as detail from './boards/detail.js'
import * as terms from './boards/terms.js'
import * as matched from './boards/matched.js'
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

const MODULES = { role, userMain, userProfile, userQuote, userRequest, userEnd, main, my, leads, detail, terms, matched, cases, practice, apply: applyMod } as unknown as Record<string, BoardModule>

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

  // 앱 안에서 이동할 때마다 몇 번째 화면인지 기록해, 뒤로 가기가 앱 밖으로 나가지 않게 한다.
  const depth = () => (window.history.state as { depth?: number } | null)?.depth ?? 0
  const go = (file: string) => {
    const next = hrefOf(file)
    if (!next) return
    window.history.pushState({ depth: depth() + 1 }, '', next + window.location.search)
    setPath(next)
  }
  // 이전 화면으로. 주소로 바로 들어와 이전 화면이 없으면 처음 화면으로 간다.
  const back = () => {
    if (depth() > 0) return window.history.back()
    window.history.replaceState({ depth: 0 }, '', '/' + window.location.search)
    setPath('/')
  }

  return (
    <div className="stage">
      <main className={board.path === '/' ? 'phone' : 'phone has-back'}>
        {board.path !== '/' && (
          <button type="button" className="back-btn" aria-label="뒤로 가기" onClick={back}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>
        )}
        <Board key={board.slug} mod={MODULES[board.slug]} go={go} hrefOf={hrefOf} />
      </main>
    </div>
  )
}
