import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const messages = {
  en: ['Install MELA', 'Add MELA to your phone', 'In Chrome, open the ⋮ menu and choose Install app or Add to Home screen. On iPhone, use Safari → Share → Add to Home Screen. Learning and account features need internet.'],
  am: ['MELAን ጫን', 'MELAን ወደ ስልክዎ ያክሉ', 'በChrome ውስጥ የ⋮ ምናሌን ከፍተው Install app ወይም Add to Home screen ይምረጡ። በiPhone ላይ Safari → Share → Add to Home Screen ይጠቀሙ። የትምህርትና የመለያ አገልግሎቶች በይነመረብ ይፈልጋሉ።'],
  om: ['MELA fe’i', 'MELA bilbila keessanitti dabalaa', 'Chrome keessatti menu ⋮ banuun Install app yookaan Add to Home screen filadhaa. iPhone irratti Safari → Share → Add to Home Screen fayyadamaa. Barnoonni fi tajaajilli herregaa interneetii barbaadu.'],
  ti: ['MELA ጽዓን', 'MELA ናብ ስልክኹም ወስኹ', 'ኣብ Chrome ዝርዝር ⋮ ከፊትኩም Install app ወይ Add to Home screen ምረጹ። ኣብ iPhone፣ Safari → Share → Add to Home Screen ተጠቐሙ። ትምህርትን ኣገልግሎት ሕሳብን ኢንተርነት የድልዮም።'],
  so: ['Rakib MELA', 'MELA ku dar taleefankaaga', 'Chrome gudaheeda fur liiska ⋮ oo dooro Install app ama Add to Home screen. iPhone isticmaal Safari → Share → Add to Home Screen. Waxbarashada iyo adeegyada akoonku waxay u baahan yihiin internet.'],
} as const

export default function InstallApp() {
  const { language } = useI18n()
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [installed, setInstalled] = useState(() =>
    window.matchMedia?.('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  const help = useRef<HTMLDetailsElement>(null)
  const installLock = useRef(false)
  const [manualHelp, setManualHelp] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const ready = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt) }
    const done = () => { setInstalled(true); setPrompt(null) }
    window.addEventListener('beforeinstallprompt', ready)
    window.addEventListener('appinstalled', done)
    return () => {
      window.removeEventListener('beforeinstallprompt', ready)
      window.removeEventListener('appinstalled', done)
    }
  }, [])
  if (installed) return null
  const copy = messages[language]
  async function install() {
    if (installLock.current) return
    if (!prompt) { setManualHelp(true); if (help.current) { help.current.open = true; help.current.focus() } return }
    installLock.current = true
    setBusy(true)
    try {
      await prompt.prompt()
      // Acceptance is not installation confirmation; appinstalled hides the UI.
      await prompt.userChoice
    } catch {
      // Keep the manual installation instructions available if the browser fails.
    } finally { installLock.current = false; setPrompt(null); setBusy(false); setManualHelp(true); if (help.current) help.current.open = true }
  }
  return <aside className="install-app" aria-label={copy[1]}>
    {<button type="button" disabled={busy} onClick={() => void install()}>{copy[0]}</button>}
    <details ref={help} tabIndex={-1}><summary>{copy[1]}</summary><p>{copy[2]}</p>
      {manualHelp && <p role="status">Your browser controls installation. If no install window appeared, open MELA in Chrome on Android or Safari on iPhone and use the menu steps above. If MELA is already installed, open its home-screen icon. This button does not download an APK file.</p>}
    </details>
  </aside>
}
