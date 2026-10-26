import type { StudentView } from '../hooks/useStudentNavigation'
import type { MelaDashboard } from './dashboard'
import type { CourseCertificate, VerifiedSkill } from './passport'

export type PassportStepStatus = 'recorded' | 'next' | 'unavailable' | 'suggested'
export type PassportDestination = StudentView | '#passport-records'
export type PassportStep = {
  id: string
  title: string
  detail: string
  status: PassportStepStatus
  destination: PassportDestination
  action: string
}

export interface PassportPathwayInput {
  passport: MelaDashboard['passport'] | null
  skills: VerifiedSkill[] | null
  certificates: CourseCertificate[] | null
  stageKey?: string | null
  gradeLevel?: number | null
}

function safeCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function statusForCount(count: number | null): PassportStepStatus {
  return count === null ? 'unavailable' : count > 0 ? 'recorded' : 'next'
}

/**
 * Learning guidance, never an employment eligibility or qualification score.
 * Unknown backend data must not be interpreted as zero achievements.
 */
export function buildPassportPathway(input: PassportPathwayInput): { schoolPath: boolean; steps: PassportStep[] } {
  // Unknown and school stages take the safe route. A grade alone cannot establish legal adulthood.
  const schoolPath = input.stageKey !== 'university' && input.stageKey !== 'college_tvet'
  const projectStatus = statusForCount(safeCount(input.passport?.project_count))
  const skillsCount = input.skills === null
    ? safeCount(input.passport?.verified_skill_count)
    : input.skills.filter((item) => item.verified === true).length
  const skillStatus = statusForCount(skillsCount)
  const credentialStatus = input.certificates === null ? 'unavailable'
    : input.certificates.some((item) => !item.revoked_at) ? 'recorded' : 'next'

  const project: PassportStep = {
    id: 'project', title: schoolPath ? 'Show what you have learned' : 'Build an evidence-based portfolio',
    detail: 'Add a project and explain what you personally contributed. Projects are self-reported and private by default.',
    status: projectStatus, destination: '#passport-records', action: 'View projects',
  }
  const verifiedSkill: PassportStep = {
    id: 'verified-skills', title: 'Develop verified skills',
    detail: 'Complete learning activities and approved assessments. Self-reported skills are not automatically verified.',
    status: skillStatus, destination: 'academy', action: 'Explore Skill Academy',
  }
  const privacy: PassportStep = {
    id: 'privacy', title: 'Review your privacy',
    detail: 'Check any project you mark visible. Never publish an address, phone number, identity document or private information about others.',
    status: 'suggested', destination: 'safety', action: 'Open Safety & Privacy',
  }
  if (schoolPath) {
    return {
      schoolPath: true,
      steps: [
        project,
        { id: 'practice', title: 'Strengthen your foundations', detail: 'Practice grade-appropriate subjects. Practice activity is not proof of a verified qualification.', status: 'suggested', destination: 'practice', action: 'Open Practice' },
        verifiedSkill,
        privacy,
      ],
    }
  }
  return {
    schoolPath: false,
    steps: [
      project,
      verifiedSkill,
      {
        id: 'credentials', title: 'Earn a verifiable course credential',
        detail: 'Only issued, non-revoked course credentials count here. A course certificate does not guarantee employment.',
        status: credentialStatus, destination: 'academy', action: 'Browse courses',
      },
      { id: 'opportunities', title: 'Explore suitable opportunities', detail: 'Review each opportunity\'s requirements and eligibility before applying. MELA does not guarantee selection.', status: 'suggested', destination: 'opportunities', action: 'View opportunities' },
      privacy,
    ],
  }
}
