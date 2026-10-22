/**
 * Read-only, fail-closed public staging registration gate.
 * This only controls the display of the sign-up form; the database Auth
 * trigger remains authoritative. Production never calls this helper.
 */
export type StagingRegistrationFlag = { feature_key: string; enabled: boolean }
export function stagingRegistrationIsOpen(flags: StagingRegistrationFlag[] | null | undefined): boolean {
  if (!Array.isArray(flags)) return false
  const enabled = new Set(flags.filter(flag => flag.enabled === true).map(flag => flag.feature_key))
  return enabled.has('platform_live') && enabled.has('registrations')
}
