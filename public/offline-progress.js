// Public handbook bookmark only: never record users, answers, credentials or private routes.
(() => {
  'use strict'
  const KEY = 'mela-public-ai-last-unit-v1'
  const valid = value => Number.isInteger(value) && value >= 1 && value <= 52
  const read = () => {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw || !/^\d{1,2}$/.test(raw)) return null
      const unit = Number(raw)
      return valid(unit) ? unit : null
    } catch { return null }
  }
  const write = unit => {
    if (!valid(unit)) return
    try { localStorage.setItem(KEY, String(unit)) } catch { /* browser storage disabled */ }
    show()
  }
  let resume, status
  const show = () => {
    if (!resume || !status) return
    const unit = read()
    resume.hidden = !unit
    if (unit) resume.href = '#week-' + unit
    resume.textContent = unit ? 'Continue from Unit ' + unit : ''
    status.textContent = unit
      ? 'Only Unit ' + unit + ' is remembered on this device. No account or assessment data is saved.'
      : 'No reading place saved on this device.'
  }
  const hashUnit = () => {
    const match = /^#week-(\d{1,2})$/.exec(location.hash)
    if (match) write(Number(match[1]))
  }
  const init = () => {
    const nav = document.querySelector('nav')
    if (!nav) return
    const box = document.createElement('section')
    box.setAttribute('aria-label', 'Public reading bookmark')
    box.style.cssText = 'padding:16px;border:1px solid #b5d3c5;border-radius:12px;background:#eef6f0;margin:20px 0'
    const title = document.createElement('h2')
    title.textContent = 'Your reading place (public lessons)'
    title.style.marginTop = '0'
    const note = document.createElement('p')
    note.textContent = 'You can resume this handbook online or offline after signing out and back in. This phone remembers only a public unit number, visible to anyone using the device. Private pages, answers and accounts do not resume after logout.'
    resume = document.createElement('a')
    resume.hidden = true
    resume.style.marginRight = '16px'
    const clear = document.createElement('button')
    clear.type = 'button'
    clear.textContent = 'Clear bookmark on this device'
    clear.style.cssText = 'border:1px solid #176649;border-radius:8px;background:#fff;color:#174c36;font:inherit;padding:7px;margin:8px 0;cursor:pointer'
    clear.addEventListener('click', () => {
      try { localStorage.removeItem(KEY) } catch {}
      show()
    })
    status = document.createElement('p')
    status.setAttribute('role', 'status')
    const library = document.createElement('a')
    library.href = './offline.html'
    library.textContent = 'Offline library'
    library.style.marginRight = '16px'
    box.append(title, note, library, resume, clear, status)
    nav.parentNode.insertBefore(box, nav)
    show()
    hashUnit()
    window.addEventListener('hashchange', hashUnit)
    nav.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#week-"]')
      if (!link) return
      const match = /^#week-(\d{1,2})$/.exec(link.getAttribute('href'))
      if (match) write(Number(match[1]))
    })
    // Also remember the section being read when users scroll instead of using links.
    let scheduled = false
    window.addEventListener('scroll', () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        let visible = null
        document.querySelectorAll('article[id^="week-"]').forEach(article => {
          if (article.getBoundingClientRect().top <= 180) visible = article
        })
        if (visible) {
          const match = /^week-(\d{1,2})$/.exec(visible.id)
          if (match && read() !== Number(match[1])) write(Number(match[1]))
        }
      })
    }, { passive: true })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true })
  else init()
})()
