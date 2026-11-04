// Worker-wallet bot commands. This is deliberately read-only:
 // it must never send money, approve a payout, or accept bank credentials.
type WorkerStatus = {
 linked?: boolean;
 unlinked?: boolean;
 currency?: string;
 available?: number;
 pending?: number;
 paid?: number;
 payouts_enabled?: boolean;
 recent_payouts?: Array<{status: string; amount_etb: number; date: string}>;
};
export type WorkerRpc = (action: string, data: Record<string, unknown>) => Promise<WorkerStatus>;
const TOKEN = /^work_([a-f0-9]{48})$/i;

function amount(value: unknown): string {
 const number = Number(value);
 if (!Number.isFinite(number) || number < 0) return 'unavailable';
 return number.toFixed(2) + ' ETB';
}

export async function workerReply(
 text: string, chatId: string, updateId: number, rpc: WorkerRpc,
): Promise<string | null> {
 const words = text.trim().split(/\s+/);
 const cmd = (words[0] || '').toLowerCase().split('@')[0];

 if (cmd === '/start' && TOKEN.test(words[1] || '') && words.length === 2) {
   const token = TOKEN.exec(words[1])?.[1] ?? '';
   const result = await rpc('link', {chat_id: chatId, token, update_id: updateId});
   return result.linked === true
     ? 'Your MELA account is securely linked to this Telegram chat. Use /earnings to check recorded earnings and /payouts to review payout request status. Never share PINs, OTPs or passwords. No money has moved.'
     : 'The MELA link could not be confirmed. Create a new link inside MELA Wallet.';
 }
 if (cmd === '/unlink') {
   await rpc('unlink', {chat_id: chatId});
   return 'This Telegram chat is disconnected from your MELA wallet. Your MELA account and financial records are unchanged.';
 }
 if (!['/work','/earnings','/payouts','/withdraw'].includes(cmd)) return null;
 const status = await rpc('status', {chat_id: chatId});
 if (status.linked !== true) {
   return 'Connect your Telegram chat securely inside MELA Wallet first. Open MELA, sign in, choose Wallet and tap Connect Telegram. Do not send account numbers here.';
 }
 if (cmd === '/withdraw') {
   return status.payouts_enabled === true
     ? 'Payout requests must be submitted inside MELA after identity, destination and work checks. Telegram cannot authorize or send a withdrawal. Check /payouts for recorded status.'
     : 'MELA worker payouts are currently disabled. No money can be sent through this bot. Use /payouts to review any existing requests.';
 }
 if (cmd === '/payouts') {
   const rows = Array.isArray(status.recent_payouts) ? status.recent_payouts.slice(0,5) : [];
   const list = rows.length
     ? rows.map((p,index)=> (index+1)+'. '+amount(p.amount_etb)+' · '+String(p.status||'unknown').slice(0,24)+' · '+String(p.date||'').slice(0,10)).join('\n')
     : 'No worker payout requests recorded.';
   return 'MELA worker payout requests\n'+list+'\n\nThese are MELA records, not independent bank transfer confirmation. New payouts '+(status.payouts_enabled===true?'may require an authorized in-app request.':'are disabled.')+' Never send credentials to Telegram.';
 }
 return 'MELA worker wallet (recorded balances, not bank funds)\n'+
   'Available: '+amount(status.available)+'\nPending: '+amount(status.pending)+
   '\nRecorded paid: '+amount(status.paid)+
   '\nPayouts: '+(status.payouts_enabled===true?'enabled, subject to authorization':'disabled')+
   '\n\nUse /payouts for payout status or /unlink to disconnect. No payment is made by this bot.';
}
