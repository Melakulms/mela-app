import { useEffect, useRef, useState } from 'react'
import { askCareerCoach } from '../lib/coach'
import { useI18n } from '../i18n'

import { readCoachHistory, saveCoachHistory, type ChatTurn } from '../lib/coach-history'

export default function AiCareerCoach({ onBack, userId }: { onBack: () => void; userId?:string }) {
  const { t, language } = useI18n()
  const sending = useRef(false)
  const [saved] = useState(()=>readCoachHistory(userId))
  const [turns, setTurns] = useState<ChatTurn[]>(saved.turns)
  const [input, setInput] = useState(saved.input)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(()=>{saveCoachHistory(userId,turns,input)},[userId,turns,input])
  const mounted=useRef(true)
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false}},[])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const message = input.trim()
    if (!message || message.length>6000 || sending.current) return
    sending.current = true
    setBusy(true)
    setError('')
    try {
      const result = await askCareerCoach(message,turns.slice(-10),language)
      if(!mounted.current)return
      if (result.kind === 'error') {
        setError(result.message)
        return
      }
      const response = result.kind === 'reply' ? result.reply.response
        : t('coachApproval')
      setTurns(t => [...t, { role: 'user' as const, text: message }, { role: 'coach' as const, text: response }].slice(-40))
      setInput('')
    } catch {
      if(mounted.current)setError(t('coachError'))
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>{t('aiCareerCoach')}</h1>
        <button className="btn btn-secondary" onClick={onBack} disabled={busy}>{t('back')}</button>
      </div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}

      <p className="muted">{t('coachHistoryHelp')}</p>
      <button className="btn btn-secondary" disabled={busy||(!turns.length&&!input)} onClick={()=>{setTurns([]);setInput('');setError('')}}>{t('coachClear')}</button>
      <div className="list-panel" role="log" aria-live="polite" style={{ minHeight: 240, padding: '1rem' }}>
        {turns.length === 0 && <p className="muted">{t('coachIntro')}</p>}
        {turns.map((t, i) => (
          <div key={i} style={{ marginBottom: '0.9rem', textAlign: t.role === 'user' ? 'right' : 'left' }}>
            <div style={{
              display: 'inline-block', maxWidth: '80%', padding: '0.6rem 0.9rem', borderRadius: 'var(--radius)',
              background: t.role === 'user' ? 'var(--gold-soft)' : '#f4f2ec',
            }}>
              <span style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{t.text}</span>
            </div>
          </div>
        ))}
        {busy && <p className="muted">{t('coachThinking')}</p>}
      </div>

      <form onSubmit={send} style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
        <input
          style={{ flex: 1, padding: '0.65rem 0.8rem', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}
          aria-label={t('coachQuestion')}
          maxLength={6000}
          disabled={busy}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('coachPlaceholder')}
        />
        <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>{t('coachSend')}</button>
      </form>
    </div>
  )
}
