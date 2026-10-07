import { useRef, useState } from 'react'
import { askCareerCoach } from '../lib/coach'
import { useI18n } from '../i18n'

interface ChatTurn {
  role: 'user' | 'coach'
  text: string
}

export default function AiCareerCoach({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const sending = useRef(false)
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const message = input.trim()
    if (!message || sending.current) return
    sending.current = true
    setBusy(true)
    setError('')
    try {
      const result = await askCareerCoach(message)
      if (result.kind === 'error') {
        setError(result.message)
        return
      }
      const response = result.kind === 'reply' ? result.reply.response
        : "That needs an administrator's approval before I can act on it. Try asking a more general question in the meantime."
      setTurns(t => [...t, { role: 'user', text: message }, { role: 'coach', text: response }])
      setInput('')
    } catch {
      setError('Could not reach the career coach. Your question is saved below; you can send it again.')
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>{t('aiCareerCoach')}</h1>
        <button className="btn btn-secondary" onClick={onBack}>{t('back')}</button>
      </div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}

      <div className="list-panel" style={{ minHeight: 240, padding: '1rem' }}>
        {turns.length === 0 && <p className="muted">Ask about your next step — a skill to focus on, how to prepare for an opportunity, anything career-related.</p>}
        {turns.map((t, i) => (
          <div key={i} style={{ marginBottom: '0.9rem', textAlign: t.role === 'user' ? 'right' : 'left' }}>
            <div style={{
              display: 'inline-block', maxWidth: '80%', padding: '0.6rem 0.9rem', borderRadius: 'var(--radius)',
              background: t.role === 'user' ? 'var(--gold-soft)' : '#f4f2ec',
            }}>
              {t.text}
            </div>
          </div>
        ))}
        {busy && <p className="muted">Thinking…</p>}
      </div>

      <form onSubmit={send} style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
        <input
          style={{ flex: 1, padding: '0.65rem 0.8rem', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}
          aria-label="Question for your career coach"
          disabled={busy}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your career coach…"
        />
        <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>Send</button>
      </form>
    </div>
  )
}
