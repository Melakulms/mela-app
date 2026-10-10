export type ChatTurn = { role:'user'|'coach'; text:string }
const PREFIX='mela_coach_v1:'
export function readCoachHistory(userId?:string):{turns:ChatTurn[];input:string} {
  if(!userId)return {turns:[],input:''}
  try {
    const value=JSON.parse(sessionStorage.getItem(PREFIX+userId)??'null')
    if(!value||!Number.isFinite(value.savedAt)||Date.now()-value.savedAt>30*60*1000||value.savedAt>Date.now()||!Array.isArray(value.turns))return {turns:[],input:''}
    const turns=value.turns.filter((t:unknown):t is ChatTurn=>!!t&&typeof t==='object'&&'role' in t&&['user','coach'].includes(String(t.role))&&'text' in t&&typeof t.text==='string'&&t.text.length<=20000).slice(-40)
    return {turns,input:typeof value.input==='string'?value.input.slice(0,6000):''}
  } catch { return {turns:[],input:''} }
}
export function saveCoachHistory(userId:string|undefined,turns:ChatTurn[],input:string) {
  if(!userId)return
  try { sessionStorage.setItem(PREFIX+userId,JSON.stringify({savedAt:Date.now(),turns:turns.slice(-40),input:input.slice(0,6000)})) } catch { /* Conversation stays usable if browser storage is blocked. */ }
}
export function clearCoachHistories() {
  try { for(const key of Object.keys(sessionStorage))if(key.startsWith(PREFIX))sessionStorage.removeItem(key) } catch { /* Cleanup must not block sign-out. */ }
}
