export const launchCategories = ['Business & Finance','Technology','Health & Sciences','Agriculture & Environment','Education & Social Sciences','Skilled Trades','Creative & Media','Manufacturing & Logistics'] as const
export type OpportunityInput = {title:string;opportunityType:string;location:string;deadline:string;summary:string;description:string;sectorCategory:string;employmentType:string;reward:string}
export function opportunityFields(input:OpportunityInput, today = new Date().toISOString().slice(0,10)) {
  for(const value of [input.title,input.location,input.description,input.employmentType,input.reward]) {
    if(!value.trim())throw new Error('Complete all required opportunity fields.')
  }
  if(!launchCategories.includes(input.sectorCategory as typeof launchCategories[number]))throw new Error('Choose a valid sector.')
  if(!['jobs','internships','scholarships','challenges','freelance'].includes(input.opportunityType))throw new Error('Choose a valid opportunity type.')
  const parsed = new Date(input.deadline + 'T00:00:00Z')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.deadline) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10)!==input.deadline || input.deadline<today)throw new Error('Choose a current or future deadline.')
  return {title:input.title.trim(),opportunity_type:input.opportunityType,location:input.location.trim(),deadline:input.deadline,summary:input.summary.trim()||null,description:input.description.trim(),sector_category:input.sectorCategory,employment_type_label:input.employmentType.trim(),stipend_or_reward:input.reward.trim(),status:'pending_review',moderation_status:'pending_review'}
}
