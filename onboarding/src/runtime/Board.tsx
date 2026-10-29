import { createElement, Fragment, useEffect, useMemo, useReducer, useState, type CSSProperties, type ReactNode } from 'react'
import type { DCLogic } from './DCLogic'

type Vals = Record<string, unknown>
export type BoardModule = { css: string; template: string; default: new (props?: Vals) => DCLogic }

const EXPR = /\{\{\s*([^}]*?)\s*\}\}/g

// {{이름}} 또는 {{ true }} 같은 값만 쓴다(보드에 다른 식은 없다).
function evaluate(expr: string, vals: Vals): unknown {
  if (/^[A-Za-z_$][\w$]*$/.test(expr) && !['true', 'false', 'null'].includes(expr)) return vals[expr]
  return JSON.parse(expr)
}

function interpolate(text: string, vals: Vals): unknown {
  const whole = text.match(/^\{\{\s*([^}]*?)\s*\}\}$/)
  if (whole) return evaluate(whole[1], vals)
  return text.replace(EXPR, (_, e: string) => String(evaluate(e, vals) ?? ''))
}

function parseStyle(text: string): CSSProperties {
  const style: Record<string, string> = {}
  for (const decl of text.split(/;(?![^(]*\))/)) {
    const i = decl.indexOf(':')
    if (i < 0) continue
    const prop = decl.slice(0, i).trim()
    const key = prop.startsWith('--') ? prop : prop.replace(/^-ms-/, 'ms-').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    style[key] = decl.slice(i + 1).trim()
  }
  return style
}

// HTML 파서가 소문자로 바꾼 속성 이름을 React 이름으로.
const ATTR: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  inputmode: 'inputMode',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  autocomplete: 'autoComplete',
  onclick: 'onClick',
  oninput: 'onInput',
  onchange: 'onChange',
  onscroll: 'onScroll',
  onkeydown: 'onKeyDown',
}
const BOOL = new Set(['checked', 'disabled', 'hidden', 'readOnly', 'required', 'multiple', 'open'])

const reactName = (name: string) =>
  ATTR[name] ?? (name.includes('-') && !/^(aria|data)-/.test(name) ? name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()) : name)

type Ctx = { vals: Vals; go: (file: string) => void; hrefOf: (file: string) => string | undefined }

function toReact(node: Node, ctx: Ctx, key: number, root = false): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    const v = interpolate(node.textContent ?? '', ctx.vals)
    return v === false || v == null ? null : (v as ReactNode)
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null
  const el = node as Element
  const children = () => Array.from(el.childNodes, (c, i) => toReact(c, ctx, i))

  if (el.localName === 'sc-if') {
    return interpolate(el.getAttribute('value') ?? '', ctx.vals) ? createElement(Fragment, { key }, children()) : null
  }

  const props: Record<string, unknown> = { key }
  for (const { name, value } of Array.from(el.attributes)) {
    const prop = reactName(name)
    let v = interpolate(value, ctx.vals)
    if (v == null) continue
    if (prop === 'style') v = parseStyle(String(v))
    else if (BOOL.has(prop) && v === '') v = true
    props[prop] = v
  }

  // 휴대폰 화면을 꽉 채우도록 보드 바깥 틀(390×844)만 늘린다.
  if (root) props.style = { ...(props.style as CSSProperties), width: '100%', height: '100%' }

  // 보드끼리 잇는 링크는 앱 안 주소로 바꾼다.
  const target = el.localName === 'a' ? ctx.hrefOf(String(props.href ?? '')) : undefined
  if (target) {
    const file = String(props.href)
    props.href = target
    props.onClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      ctx.go(file)
    }
  }

  // 템플릿의 체크 상태는 매번 정해지므로, onChange 없는 체크 칸은 읽기 전용으로 둔다.
  if ('checked' in props && !props.onChange) props.readOnly = true

  if (el.localName === 'textarea') return createElement('textarea', { ...props, defaultValue: el.textContent ?? '' })
  return createElement(el.localName, props, ...children())
}

export function Board({ mod, go, hrefOf }: { mod: BoardModule; go: (file: string) => void; hrefOf: (file: string) => string | undefined }) {
  const tree = useMemo(() => {
    const doc = new DOMParser().parseFromString(`<body>${mod.template}</body>`, 'text/html')
    return doc.body.firstElementChild!
  }, [mod])
  const [logic] = useState(() => new mod.default({}))
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    logic.update = rerender
    // 내용이 짧아 스크롤할 일이 없는 화면에서도 '끝까지 읽음'을 한 번 확인한다.
    ;(logic as unknown as { onScroll?: () => void }).onScroll?.()
    return () => {
      logic.update = undefined
    }
  }, [logic])

  return (
    <>
      <style>{mod.css}</style>
      {toReact(tree, { vals: logic.renderVals(), go, hrefOf }, 0, true)}
    </>
  )
}
