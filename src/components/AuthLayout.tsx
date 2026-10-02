import type { ReactNode } from 'react'
import { BookOpen, ArrowUpRight, GraduationCap, Compass } from 'lucide-react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-shell auth-layout">
    <section className="auth-story" aria-label="About MELA">
      <a className="auth-wordmark" href={import.meta.env.BASE_URL}><GraduationCap size={30} /> MELA<span className="brand-caption">LEARN. GROW. GO FURTHER.</span></a>
      <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
      <h2>Small steps.<br />{' '}Brighter <em>futures.</em></h2>
      <p>Build your knowledge, discover your strengths, and find where they can take you.</p>
      <div className="learning-path" aria-hidden="true">
        <div><BookOpen size={22} /><span>01 / LEARN<strong>Make progress, every day</strong></span></div>
        <div><Compass size={22} /><span>02 / EXPLORE<strong>Find your own direction</strong></span></div>
        <div><ArrowUpRight size={22} /><span>03 / GROW<strong>Turn learning into possibility</strong></span></div>
      </div>
      <p className="story-footer">A place for students, families, educators and employers.</p>
    </section>
    <section className="auth-card">{children}</section>
  </main>
}
