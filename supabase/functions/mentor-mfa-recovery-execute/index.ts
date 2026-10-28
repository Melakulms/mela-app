// STAGING REVIEW DRAFT — NOT DEPLOYED.
// The only factor-deletion entry point. Never expose the service key to clients.
// Requires a signed AAL2 admin JWT, two independently approved reviews, and
// the database's 24-hour hold. Identity proof is reviewed out of band.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

const url = Deno.env.get('SUPABASE_URL')
const publishable = Deno.env.get('SUPABASE_ANON_KEY')
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const reply = (status: number, message: string) => new Response(
  JSON.stringify({ message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  }
)

serve(async req => {
  if (req.method !== 'POST') return reply(405, 'Method not allowed.')
  if (!url || !publishable || !secret) return reply(503, 'Recovery service is not configured.')
  const authorization = req.headers.get('authorization') ?? ''
  if (!/^Bearer\s+\S+$/i.test(authorization)) return reply(401, 'Sign in with staff MFA to continue.')

  let requestId: string
  try {
    const input = await req.json() as { request_id?: unknown }
    if (typeof input.request_id !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.request_id)) {
      return reply(400, 'Invalid recovery request.')
    }
    requestId = input.request_id
  } catch { return reply(400, 'Invalid JSON body.') }

  // Never let client arguments select a target user or factor. The locked,
  // reviewed record gives us the target exclusively.
  const staff = createClient(url, publishable, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const bearer = authorization.replace(/^Bearer\s+/i, '')
  const { data: identity, error: identityError } = await staff.auth.getUser(bearer)
  if (identityError || !identity.user) return reply(401, 'Staff session could not be verified.')
  const { data: claim, error: claimError } = await staff.rpc('claim_mentor_mfa_recovery', {
    p_request_id: requestId,
  })
  if (claimError || typeof claim?.mentor_id !== 'string' || claim.request_id !== requestId) {
    return reply(403, 'Recovery was not approved or is not yet eligible.')
  }

  const service = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const targetUserId = claim.mentor_id as string
  try {
    // Server-only Auth administration. Deleting a verified factor invalidates
    // the user's sessions; all subsequent sensitive actions still require AAL2.
    const { data: listed, error: listError } = await service.auth.admin.mfa.listFactors({
      userId: targetUserId,
    })
    if (listError || !listed?.factors) throw new Error('Auth factor inventory unavailable')
    for (const factor of listed.factors) {
      if (factor.factor_type !== 'totp') throw new Error('Unrecognized MFA factor type; manual security review required')
      const { error } = await service.auth.admin.mfa.deleteFactor({
        userId: targetUserId,
        id: factor.id,
      })
      if (error) throw new Error('Could not complete Auth factor reset')
    }
    const { error: finalError } = await service.rpc('finalize_mentor_mfa_recovery', {
      p_request_id: requestId, p_success: true,
    })
    if (finalError) throw new Error('Recovery finalization failed')
    return reply(200, 'Recovery completed. The account must sign in again and enroll fresh MFA.')
  } catch {
    // Do not report success or automatically release the processing lock after
    // partial Auth changes. Manual incident reconciliation is required.
    return reply(503, 'Recovery is pending staff security reconciliation. Contact MELA support.')
  }
})
