import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

describe('shared-origin admin credential cleanup', () => {
  it('removes the legacy central-admin storage key before rendering the learner app', () => {
    expect(source).toContain("window.localStorage.removeItem('mela-central-admin-auth')")
    const cleanup = source.indexOf("window.localStorage.removeItem('mela-central-admin-auth')")
    const render = source.indexOf("createRoot(document.getElementById('root')!)")
    expect(cleanup).toBeGreaterThan(-1)
    expect(render).toBeGreaterThan(cleanup)
  })
})
