import { supabase } from './supabase'

export async function fetchStudentServices() {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not authenticated')
  const uid = auth.user.id
  const [notifications, earnings, applications, documents, progress, challenges, tasks] = await Promise.all([
    supabase.from('notifications').select('id,title,body,is_read,created_at').eq('user_id', uid).order('created_at',{ascending:false}).limit(20),
    supabase.from('earnings_ledger').select('id,source_type,gross_amount,platform_fee,net_amount,currency,status,occurred_at').eq('user_id', uid).order('occurred_at',{ascending:false}).limit(20),
    supabase.from('applications').select('id,opportunity_id,status,submitted_at,updated_at').eq('user_id', uid).order('submitted_at',{ascending:false}).limit(20),
    supabase.from('profile_documents').select('id,document_type,title,file_url,issuer,issued_on,expires_on,verified,is_public,created_at').eq('user_id', uid).order('created_at',{ascending:false}),
    supabase.from('student_module_progress').select('id,module_id,completed,quiz_score,proctored_passed,proctored_at').eq('user_id', uid),
    supabase.from('challenge_participants').select('challenge_id,joined_at,status,team_id,withdrawn_at').eq('user_id', uid).order('joined_at',{ascending:false}).limit(20),
    supabase.from('marketplace_tasks').select('id,title,description,task_type,reward_coins,budget_amount,currency,deadline,status,assigned_to,created_at').limit(30)
  ])
  for (const r of [notifications, earnings, applications, documents, progress, challenges, tasks]) if (r.error) throw r.error
  return { notifications: notifications.data ?? [], earnings: earnings.data ?? [], applications: applications.data ?? [], documents: documents.data ?? [], progress: progress.data ?? [], challenges: challenges.data ?? [], tasks: tasks.data ?? [] }
}
export async function markNotificationRead(id: string) {
  const { error } = await supabase.from('notifications').update({is_read:true}).eq('id',id)
  if (error) throw error
}
