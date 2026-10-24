/** Read-only staging invite switch. Absent or errored configuration closes enrollment. */
export type StagingRegistrationFlag = { feature_key: string; enabled: boolean }
export function stagingRegistrationIsOpen(flags: StagingRegistrationFlag[] | null | undefined): boolean {
  return Array.isArray(flags) && flags.some(flag => flag.feature_key === 'staging_beta_invites' && flag.enabled === true)
}
