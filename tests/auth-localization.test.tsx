import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AUTH_MESSAGES, type AuthTranslationKey } from '../src/auth-i18n'
import { I18nProvider, translate } from '../src/i18n'
import Login from '../src/pages/Login'
import Register from '../src/pages/Register'
import ResetPassword from '../src/pages/ResetPassword'
vi.mock('../src/lib/auth',()=>({loginUser:vi.fn(),requestPasswordReset:vi.fn(),resetBetaPassword:vi.fn(),registerBetaUser:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({supabase:{auth:{updateUser:vi.fn()}}}))
beforeEach(()=>localStorage.removeItem('mela_language'))
afterEach(()=>{cleanup();localStorage.removeItem('mela_language')})
it.each(['am','om','ti','so'] as const)('localizes every public authentication message for %s',language=>{
 for(const key of Object.keys(AUTH_MESSAGES) as AuthTranslationKey[]) {
  expect(translate(language,key)).not.toBe(translate('en',key))
  expect(translate(language,key).trim().length).toBeGreaterThan(1)
 }
})
it.each(['am','om','ti','so'] as const)('switches login language without losing the entered identifier for %s',language=>{
 render(<I18nProvider><Login onSwitchToRegister={vi.fn()} /></I18nProvider>)
 fireEvent.change(screen.getByLabelText('Email or beta username'),{target:{value:'learner'}})
 fireEvent.change(screen.getByLabelText('Preferred language'),{target:{value:language}})
 expect(screen.getByRole('heading',{name:translate(language,'authWelcome')})).toBeTruthy()
 expect((screen.getByLabelText(translate(language,'authIdentifier')) as HTMLInputElement).value).toBe('learner')
 expect(document.documentElement.lang).toBe(language)
 expect(localStorage.getItem('mela_language')).toBe(language)
 fireEvent.click(screen.getByRole('button',{name:translate(language,'authForgot')}))
 expect(screen.getByRole('heading',{name:translate(language,'authRecoverBeta')})).toBeTruthy()
 expect(screen.getByLabelText(translate(language,'authRecoveryCode'))).toBeTruthy()
})
it('restores the selected language in beta registration and expired-link recovery',()=>{
 localStorage.setItem('mela_language','am')
 const view=render(<I18nProvider><Register onSwitchToLogin={vi.fn()} /></I18nProvider>)
 expect(screen.getByLabelText(translate('am','authAccessCode'))).toBeTruthy()
 expect(screen.getByRole('heading',{name:translate('am','authJoin')})).toBeTruthy()
 view.unmount()
 render(<I18nProvider><ResetPassword sessionReady={false} onComplete={vi.fn()} /></I18nProvider>)
 expect(screen.getByText(translate('am','authInvalidReset'))).toBeTruthy()
 expect(screen.queryByLabelText(translate('am','authNewPassword'))).toBeNull()
})
