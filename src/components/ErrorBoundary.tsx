import { Component, type ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <div className="auth-shell"><div className="auth-card" role="alert">
      <h1>MELA could not load this screen</h1><p>Please reload to try again.</p>
      <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload MELA</button>
    </div></div>
    return this.props.children
  }
}
