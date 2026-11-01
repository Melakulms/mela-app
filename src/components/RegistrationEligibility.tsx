import type { RegistrationAgeBand, PublicRegistrationRole } from '../lib/registration-requirements'
import { isAdultOnlyRole, REGISTRATION_POLICY_VERSION } from '../lib/registration-requirements'

type Props = {
  role: PublicRegistrationRole
  ageBand: RegistrationAgeBand
  onAgeBandChange: (value: RegistrationAgeBand) => void
  terms: boolean
  onTermsChange: (value: boolean) => void
  privacy: boolean
  onPrivacyChange: (value: boolean) => void
  marketing: boolean
  onMarketingChange: (value: boolean) => void
  disabled?: boolean
}

export default function RegistrationEligibility({
  role, ageBand, onAgeBandChange, terms, onTermsChange, privacy, onPrivacyChange,
  marketing, onMarketingChange, disabled = false,
}: Props) {
  return <section aria-label="Registration safety and privacy">
    <div className="field">
      <label htmlFor="registration-age-band">Age group (required)</label>
      <select id="registration-age-band" value={ageBand} onChange={event => onAgeBandChange(event.target.value as RegistrationAgeBand)} disabled={disabled} required>
        <option value="">Choose age group</option>
        <option value="under_13">Under 13</option>
        <option value="13_17">13–17</option>
        <option value="18_plus">18 or older</option>
      </select>
      <p className="field-hint">{isAdultOnlyRole(role)
        ? 'Guardian, teacher and employer representatives must be adults. Professional privileges require separate verification.'
        : 'You do not need to disclose your birth date here. Minors may need guardian consent before protected MELA features open.'}</p>
    </div>
    <div className="field">
      <details>
        <summary>Registration terms and privacy summary</summary>
        <p>A MELA account may store your name, selected role, contact details, education preferences, and learning progress. Sensitive student, guardian, payment and professional verification records must not be displayed publicly.</p>
        <p>Keep your password private. Do not impersonate others, share unsafe content or misuse learner data. Professional roles and payments need additional approval. You can request assistance with account information and privacy through MELA's safety and support tools.</p>
        <p>This is an onboarding summary, not the complete legal text. MELA must make the actual Terms of Service and Privacy Notice available before declaring this registration legally launch-ready.</p>
      </details>
      <p className="field-hint">Policy record version: {REGISTRATION_POLICY_VERSION}. Separate confirmations are required.</p>
    </div>
    <div className="field">
      <label htmlFor="registration-terms">
        <input id="registration-terms" type="checkbox" checked={terms} onChange={e => onTermsChange(e.target.checked)} disabled={disabled} />
        {' '}I acknowledge MELA's Terms of Service (required)
      </label>
      <label htmlFor="registration-privacy">
        <input id="registration-privacy" type="checkbox" checked={privacy} onChange={e => onPrivacyChange(e.target.checked)} disabled={disabled} />
        {' '}I acknowledge MELA's Privacy Notice (required)
      </label>
      <label htmlFor="registration-marketing">
        <input id="registration-marketing" type="checkbox" checked={marketing} onChange={e => onMarketingChange(e.target.checked)} disabled={disabled} />
        {' '}Send me optional product news and marketing (optional)
      </label>
    </div>
  </section>
}
