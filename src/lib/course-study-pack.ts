export interface StudyPackLesson {
 lesson_key:string; title:string; position:number; content_text:string;
 duration_minutes:number; review_status:string
}
export function buildCourseStudyPack(title:string, lessons:StudyPackLesson[]):string {
 const minutes=lessons.reduce((sum,l)=>sum+l.duration_minutes,0)
 return [
  '# '+title+' — MELA study pack',
  'English teaching drafts. Introductory practice, not a professional qualification or certificate.',
  'Estimated active study time: '+minutes+' minutes including exercises and the project. Optional videos, setup and waiting for teacher feedback are additional.',
  'The project workbook is in Lesson 6. This download does not submit work or record completion.',
  ...[...lessons].sort((a,b)=>a.position-b.position).map(l=>
   '\n---\nLesson '+l.position+': '+l.title+'\nEstimated minutes: '+l.duration_minutes+' | Review status: '+l.review_status+'\n\n'+l.content_text)
 ].join('\n\n')
}
