import { useI18n } from '../i18n'
import type { ReactNode } from 'react'
import { BookOpen, ArrowUpRight, GraduationCap, Compass } from 'lucide-react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t, language, setLanguage } = useI18n()
  return <main className="auth-shell auth-layout">
    <section className="auth-story" aria-label={t('authAbout')}>
      <a className="auth-wordmark" href={import.meta.env.BASE_URL}><GraduationCap size={30} /> MELA<span className="brand-caption">{t('authBrand')}</span></a>
      <span className="eyebrow">{t('authNextChapter')}</span>
      <h2>{t('authStoryTitle')}</h2>
      <p>{t('authStoryHelp')}</p>
      <div className="learning-path" aria-hidden="true">
        <div><BookOpen size={22} /><span>01 / {t('authLearn')}<strong>{t('authProgress')}</strong></span></div>
        <div><Compass size={22} /><span>02 / {t('authExplore')}<strong>{t('authDirection')}</strong></span></div>
        <div><ArrowUpRight size={22} /><span>03 / {t('authGrow')}<strong>{t('authPossibility')}</strong></span></div>
      </div>
      <p className="story-footer">{t('authAudience')}</p>
    </section>
    <section className="auth-card"><div className="field"><label htmlFor="auth-language">{t('preferredLanguage')}</label><select id="auth-language" value={language} onChange={event => setLanguage(event.target.value)}><option value="en">English</option><option value="am">አማርኛ</option><option value="om">Afaan Oromoo</option><option value="ti">ትግርኛ</option><option value="so">Soomaali</option></select></div>{children}</section>
  </main>
}
