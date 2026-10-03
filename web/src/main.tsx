import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 프로토타입(dist/) 스타일을 수정 없이 같은 순서로 불러온다. 디자인 변경은 이 파일들에서 한다.
import './styles/styles.css'
import './styles/account.css'
import './styles/transactions.css'
import './styles/desktop.css'
import './styles/pc-refinements.css'
import './styles/react.css'
import App from './App.tsx'
import { installDemoMode } from './demo/demoMode'

// 데모 모드(개발 전용): ?demo=1 또는 localStorage pico_demo=1 일 때만 거래 흐름 API를 목업으로 가로챈다.
installDemoMode()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
