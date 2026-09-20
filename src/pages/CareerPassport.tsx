import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchMyAchievements, fetchMyVerifiedSkills, type PassportAchievement, type VerifiedSkill } from '../lib/passport'
import { fetchDashboard } from '../lib/dashboard'

type Profile = {
  full_name: string | null
  bio: string | null
  city: string | null
  region: string | null
  portfolio_url: string | null
  linkedin_url: string | null
  github_url: string | null
}

type Doc = {
  id: string
  title: string
  document_type: string
  file_url: string
  verified: boolean
}

export default function CareerPassport({ onBack }: { onBack: () => void }) {
  const [achievements, setAchievements] = useState<PassportAchievement[] | null>(null)
  const [skills, setSkills] = useState<VerifiedSkill[] | null>(null)
  const [score, setScore] = useState<{ profile_score: number; badge_count: number } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [docs, setDocs] = useState<Doc[]>([])
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Session expired. Please sign in again.')

      const [a, s, d, p] = await Promise.all([
        fetchMyAchievements(),
        fetchMyVerifiedSkills(),
        supabase
          .from('profile_documents')
          .select('id,title,document_type,file_url,verified')
          .eq('user_id', auth.user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('full_name,bio,city,region,portfolio_url,linkedin_url,github_url')
          .eq('id', auth.user.id)
          .single(),
      ])

      if (d.error) throw d.error
      if (p.error) throw p.error

      setAchievements(a)
      setSkills(s)
      setDocs(d.data ?? [])
      setProfile(p.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load your career passport.')
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const dash = await fetchDashboard()
        setScore(dash.passport)
        await load()
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not load your career passport.')
      }
    })()
  }, [])

  const save = async () => {
    if (!profile) return
    setBusy(true)
    setError('')
    try {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Session expired.')

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          bio: profile.bio,
          city: profile.city,
          region: profile.region,
          portfolio_url: profile.portfolio_url,
          linkedin_url: profile.linkedin_url,
          github_url: profile.github_url,
        })
        .eq('id', auth.user.id)

      if (updateError) throw updateError
      setEditing(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save profile.')
    } finally {
      setBusy(false)
    }
  }

  const upload = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Session expired.')
      if (file.size > 15 * 1024 * 1024) throw new Error('Document must be 15 MB or smaller.')

      const allowedTypes = new Set([
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
      ])
      if (!allowedTypes.has(file.type)) throw new Error('Only PDF, DOCX, JPEG, and PNG documents are allowed.')

      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${auth.user.id}/${crypto.randomUUID()}-${safe}`

      const up = await supabase.storage
        .from('career-documents')
        .upload(path, file, { upsert: false, contentType: file.type })

      if (up.error) throw up.error

      const ins = await supabase
        .from('profile_documents')
        .insert({
          user_id: auth.user.id,
          document_type: 'portfolio_document',
          title: file.name,
          file_url: path,
        })
        .select('id,title,document_type,file_url,verified')
        .single()

      if (ins.error) {
        const cleanup = await supabase.storage.from('career-documents').remove([path])
        if (cleanup.error) {
          throw new Error(`${ins.error.message}. Storage cleanup also failed: ${cleanup.error.message}`)
        }
        throw ins.error
      }

      setDocs((current) => [ins.data, ...current])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (doc: Doc) => {
    setBusy(true)
    setError('')
    try {
      if (doc.verified) throw new Error('Verified documents cannot be deleted from the learner app. Request admin review.')

      const del = await supabase.from('profile_documents').delete().eq('id', doc.id)
      if (del.error) throw del.error

      const storageDelete = await supabase.storage.from('career-documents').remove([doc.file_url])
      if (storageDelete.error) {
        setError('Document record deleted, but the stored file could not be removed. Please contact support.')
      }

      setDocs((current) => current.filter((item) => item.id !== doc.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not delete document.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>Career Passport</h1>
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {score && (
        <div className="stat-strip">
          <div>
            <span className="stat-value">{score.profile_score}</span>
            <span className="stat-label">Profile score</span>
          </div>
          <div>
            <span className="stat-value">{score.badge_count}</span>
            <span className="stat-label">Badges</span>
          </div>
        </div>
      )}

      <div className="section-heading">
        <h2>Profile</h2>
        {profile && !editing && (
          <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>
        )}
      </div>

      {profile && editing ? (
        <div className="list-panel">
          {(['full_name', 'bio', 'city', 'region', 'portfolio_url', 'linkedin_url', 'github_url'] as const).map((key) => (
            <div className="field" key={key}>
              <label>{key.replace(/_/g, ' ')}</label>
              {key === 'bio' ? (
                <textarea
                  value={profile[key] ?? ''}
                  onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                />
              ) : (
                <input
                  value={profile[key] ?? ''}
                  onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                />
              )}
            </div>
          ))}
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      ) : profile ? (
        <div className="list-panel">
          <div className="list-row">
            <b>{profile.full_name}</b>
            <span>{profile.city ?? ''} {profile.region ?? ''}</span>
          </div>
          <div className="list-row-meta">
            {profile.bio ?? 'Add a short bio to strengthen your passport.'}
          </div>
        </div>
      ) : null}

      <div className="section-heading">
        <h2>Documents</h2>
        <label className="btn btn-primary">
          Upload
          <input
            hidden
            type="file"
            accept=".pdf,.docx,image/jpeg,image/png"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void upload(file)
              e.currentTarget.value = ''
            }}
          />
        </label>
      </div>

      {docs.length === 0 ? (
        <div className="empty-panel">No documents uploaded yet.</div>
      ) : (
        <div className="list-panel">
          {docs.map((doc) => (
            <div className="list-row" key={doc.id}>
              <div>
                <b>{doc.title}</b>
                <div className="list-row-meta">
                  {doc.document_type} · {doc.verified ? 'Verified' : 'Pending verification'}
                </div>
              </div>
              {!doc.verified && (
                <button className="btn btn-secondary" onClick={() => void remove(doc)} disabled={busy}>
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="section-heading"><h2>Verified skills</h2></div>
      {skills && skills.length === 0 && <div className="empty-panel">No verified skills yet.</div>}
      {skills && skills.length > 0 && (
        <div className="list-panel">
          {skills.map((skill) => (
            <div className="list-row" key={skill.id}>
              <div className="list-row-title">{skill.skill_name}</div>
              <span className="pill">{skill.verified ? (skill.level ?? 'Verified') : 'Pending'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="section-heading"><h2>Achievements</h2></div>
      {achievements && achievements.length === 0 && <div className="empty-panel">No achievements recorded yet.</div>}
      {achievements && achievements.length > 0 && (
        <div className="list-panel">
          {achievements.map((achievement) => (
            <div className="list-row" key={achievement.id}>
              <div>
                <div className="list-row-title">{achievement.title}</div>
                <div className="list-row-meta">{achievement.issuer ?? achievement.achievement_type}</div>
              </div>
              {achievement.verified && <span className="pill">Verified</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
