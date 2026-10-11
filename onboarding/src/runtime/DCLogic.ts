type Vals = Record<string, unknown>

// 캔버스 보드 스크립트의 부모 클래스. 보드는 state를 바꾸고 renderVals()로 템플릿 값을 돌려준다.
export class DCLogic {
  props: Vals
  state: Vals = {}
  update?: () => void

  constructor(props: Vals = {}) {
    this.props = props
  }

  // 캔버스처럼 즉시 반영한다(보드 스크립트가 setState 직후 this.state를 다시 읽는다).
  setState(patch: Vals | ((state: Vals, props: Vals) => Vals)) {
    const next = typeof patch === 'function' ? patch(this.state, this.props) : patch
    this.state = { ...this.state, ...next }
    this.update?.()
  }

  renderVals(): Vals {
    return {}
  }
}
