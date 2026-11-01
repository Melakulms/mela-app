import { parseRegistration } from './registration.ts';
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// MELA production Telegram supports registration and (only when explicitly enabled)
// order-linked, manually reviewed payment references. Bank claims never auto-approve.
const PROJECT_URL = "https://duizgtmbptmlbyipreqg.supabase.co";
const FUNCTION_NAME = "mela-telegram-bot";
const BOT_USERNAME = "mela_edu_bot";
const enc = new TextEncoder();

function sendJson(payload: unknown, status=200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {"content-type":"application/json; charset=utf-8","cache-control":"no-store"},
  });
}

function config() {
  const token = Deno.env.get("MELA_TELEGRAM_BOT_TOKEN") || "";
  const secret = Deno.env.get("MELA_TELEGRAM_WEBHOOK_SECRET") || "";
  const project = Deno.env.get("SUPABASE_URL") || "";
  const ready = project === PROJECT_URL &&
    /^[0-9]{5,}:[A-Za-z0-9_-]{20,}$/.test(token) &&
    /^[A-Za-z0-9_-]{32,256}$/.test(secret);
  return {token, secret, ready, projectMatches:project===PROJECT_URL};
}

function safeEqual(a:string, b:string):boolean {
  const x=enc.encode(a), y=enc.encode(b);
  if (x.length!==y.length) return false;
  let diff=0;
  for(let i=0;i<x.length;i++) diff|=x[i]^y[i];
  return diff===0;
}

async function telegram(token:string,method:string,payload:Record<string,unknown>) {
  const r=await fetch("https://api.telegram.org/bot"+token+"/"+method,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(10000),
  });
  if(!r.ok) throw new Error("telegram_transport_error");
  const response=await r.json();
  if(response?.ok!==true) throw new Error("telegram_api_error");
  return response.result;
}

async function paymentRpc(action:string,data:Record<string,unknown>={}){
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(!key) throw new Error('Payment service unavailable. Please try again later.');
 const response=await fetch(PROJECT_URL+'/rest/v1/rpc/mela_telegram_payment_bot_v1',{
 method:'POST',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},
 body:JSON.stringify({p_action:action,p_data:data}),signal:AbortSignal.timeout(10000)});
 const result=await response.json();
 if(!response.ok){
   if(result.code==='P0001')throw new Error(String(result.message).slice(0,250));
   if(result.code==='23505')throw new Error('That reference has already been submitted. Check /status.');
   throw new Error('Payment service unavailable. No approval was made. Please try again later.');
 }
 return result;
}

async function orderRpc(action:string,data:Record<string,unknown>={}) {
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  if (!key) throw new Error('MELA payment-order service unavailable.');
  const response=await fetch(PROJECT_URL+'/rest/v1/rpc/mela_telegram_order_bot_v1',{
    method:'POST',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},
    body:JSON.stringify({p_action:action,p_data:data}),signal:AbortSignal.timeout(10000)
  });
  const body=await response.json();
  if (!response.ok) {
    if (body.code==='P0001') throw new Error(String(body.message).slice(0,250));
    throw new Error('MELA order service unavailable. No payment has been approved.');
  }
  return body;
}

function parseSubmission(text:string){
 const p=text.trim().split(/\s+/);const provider=p[1]?.toLowerCase();
 if(!['dashen','telebirr'].includes(provider)||!/^\d+(?:\.\d{1,2})?$/.test(p[2]||''))return null;
 const parts=p[2].split('.');const amount=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));
 const reference=(p[3]||'').toUpperCase();const details=p.slice(4).join(' ');
 if(!Number.isSafeInteger(amount)||amount<100||amount>100000000||!/^[A-Z0-9][A-Z0-9-]{5,63}$/.test(reference)||details.length<5||details.length>200)return null;
 return {provider,amount_minor:amount,reference,details};
}
async function livePaymentReply(text:string,message:any,updateId:number):Promise<string|null>{
 const parts=text.trim().split(/\s+/);
 const cmd=(parts[0]||'').toLowerCase().split('@')[0];
 const chatId=String(message.chat.id);
 if(cmd==='/start' && /^pay_[a-f0-9]{48}$/i.test(parts[1]||'')){
   const linked=await orderRpc('link',{token:parts[1].slice(4),chat_id:chatId,update_id:updateId});
   return 'Your MELA subscription order is linked to this private Telegram chat.\nOrder: '+linked.order_id+
     '\nAmount: '+(linked.amount_minor/100)+' ETB\nMethod: '+linked.provider+
     '\n\nPay only the recipient and amount shown in your MELA in-app order. Then send /verify REFERENCE using your actual transfer reference. Linking is not payment approval.';
 }
 if(cmd==='/plans'){
   const state=await orderRpc('health');
   return state.enabled
     ? 'MELA subscriptions\nFree Core: free\nPro: 50 ETB / 30 days\nPremium: 100 ETB / 30 days\n\nReferral commission after the FIRST independently verified qualifying purchase: 20 ETB for Pro, 40 ETB for Premium.\n\nSelect a plan and create an order inside MELA. Do not transfer until you have a verified order with exact receiving account.'
     : null;
 }
 if(cmd==='/pay'){
   const state=await orderRpc('health');
   return state.enabled
     ? 'Open MELA > My subscription and invitations. Select Pro (50 ETB) or Premium (100 ETB), create a verified order and tap its Telegram payment link. Check the exact recipient shown in that order before transferring. The bot never supplies unlinked payment instructions.'
     : 'Payment collection is paused. Do not transfer money based on Telegram messages. Free Core stays available.';
 }
 if(cmd==='/verify'){
   const state=await orderRpc('health');
   if(!state.enabled) return 'New payment verification is paused. Do not send a transfer. Use /status to check any previous case.';
   const reference=(parts[1]||'').toUpperCase();
   if(parts.length!==2||!/^[A-Z0-9][A-Z0-9-]{5,63}$/.test(reference))
     return 'First create a subscription order inside MELA and open its private Telegram payment link. After transferring to the exact account shown in the order, send /verify YOURBANKREFERENCE. Never send PINs, passwords, or OTPs.';
   const result=await orderRpc('submit',{chat_id:chatId,reference,update_id:updateId});
   return (result.duplicate?'Reference already recorded.':'Reference submitted for independent review.')+
     '\nOrder: '+result.order_id+'\nStatus: '+result.status+
     '\n\nAn administrator must confirm the actual incoming transfer. No plan or referral commission has been activated by this message. Use /status to follow up.';
 }
 if(cmd==='/status'){
   const orders=await orderRpc('status',{chat_id:chatId});
   const existing=await paymentRpc('status',{chat_id:chatId}).catch(()=>[]);
   if(!orders.length&&!existing.length) return 'No payment orders are linked to this chat. Create a plan order inside MELA before using Telegram to submit a reference.';
   const orderLines=orders.map((o:any)=>'Order: '+o.order_id+'\n'+(o.amount_minor/100)+' ETB · '+o.provider+
     '\nStatus: '+o.status+(o.reason?'\nNote: '+o.reason:'')).join('\n\n');
   const oldLines=existing.map((r:any)=>'Earlier receipt case: '+r.id+'\nStatus: '+r.status).join('\n\n');
   return 'MELA payment status\n\n'+[orderLines,oldLines].filter(Boolean).join('\n\n')+
     '\n\nOnly independently checked bank receipts can activate paid plans.';
 }
 return null;
}

async function registrationReply(text:string, chatId:number):Promise<string|null> {
  const registration=parseRegistration(text);
  if(!registration) {
    if (/^\/(?:register|start\s+reg_)/i.test(text)) return 'Open MELA and choose your username and account type. Then send /register USERNAME ROLE, where ROLE is student, parent, teacher or company. Never send your password.';
    return null;
  }
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  if(!key) throw new Error('Registration verification is unavailable. Please try later.');
  const digest=await crypto.subtle.digest('SHA-256',enc.encode('mela-registration-chat-v1:'+chatId));
  const chatHash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const response=await fetch(PROJECT_URL+'/rest/v1/rpc/issue_telegram_registration_code', {
    method:'POST',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},
    body:JSON.stringify({p_chat_hash:chatHash,p_username:registration.username,p_role:registration.role}),
    signal:AbortSignal.timeout(10000),
  });
  const result=await response.json();
  if(!response.ok) {
    if(result.code==='P0001') throw new Error(String(result.message).slice(0,250));
    throw new Error('Registration verification is unavailable. Please try later.');
  }
  return 'MELA registration verification\n\nUsername: '+registration.username+'\nAccount type: '+registration.role+
    '\n\nYour private one-time code:\n'+result.code+
    '\n\nCopy this code into the MELA registration form. It expires in 10 minutes. It verifies control of this Telegram account only. Do not share it with anyone. Never send your MELA password here.\n\nGuardian consent and teacher/employer approval are separate. Save the recovery code shown by MELA after registration.';
}

function reply(input:string):string {
 const cmd=input.trim().split(/\s+/)[0].toLowerCase().split("@")[0];
 if(cmd==="/plans") return "MELA upcoming subscriptions (not yet available for purchase)\n\nFree Core: free\nPro: 50 ETB / 30 days\nPremium: 100 ETB / 30 days\n\nPlanned referral reward after a new member's FIRST independently verified paid subscription: Pro 20 ETB; Premium 40 ETB. No reward for sign-up alone.\n\nThese plans are not active in production checkout yet. Do NOT transfer money based on this message. Only follow a verified in-app payment order once MELA enables the new checkout.";
 if(cmd==="/start") return "Welcome to MELA Education! 🇪🇹\n\nFor email-free registration, open https://melakulms.github.io/mela-app/ and choose Get Telegram verification code, or send /register USERNAME ROLE in this chat (ROLE: student, parent, teacher, company). Use /plans for upcoming subscriptions. For payment, create a verified order in MELA and use its Telegram link when checkout is enabled. /status still checks existing payment cases. Free Core remains free.";
 if(cmd==="/privacy") return "For registration MELA stores a hash of your Telegram account ID, chosen username, verification time and code hash to prevent duplicate registration. For payments MELA stores your Telegram chat ID, claimed name, payment references, amount, service description and review result to verify payments and resolve disputes. Only your chat can request its status; the authorized reviewer uses MFA. Never send PINs, passwords, OTPs, identity documents or screenshots.";
 if(cmd==="/review") return "Authorized finance reviewers: open the official MELA Central Admin Payments screen, sign in and complete MFA. Never follow third-party payment-review links from Telegram.";
 return "MELA Education Bot\n/start — Welcome\n/register USERNAME ROLE — Private one-time registration code\n/plans — Upcoming Pro and Premium prices (not yet purchasable)\n/pay — Linked-order payment instructions\n/verify REFERENCE — Claim a transfer for your linked order (when enabled)\n/status — Your payment review status\n/privacy — Data notice\n/review — Administrator review screen\n\nApproval follows manual confirmation in the receiving account. References alone do not approve payments.";
}

Deno.serve(async (req:Request):Promise<Response>=>{
  const cfg=config();
  const rawPath=new URL(req.url).pathname;
  const path=rawPath.startsWith("/functions/v1/") ? rawPath : "/functions/v1"+rawPath;
  const base="/functions/v1/"+FUNCTION_NAME;
  if(!cfg.projectMatches) return sendJson({ok:false,error:"project_mismatch"},503);

  if(req.method==="GET" && (path===base || path===base+"/health")){
    let webhookStatus="not_configured";
    let pendingUpdates:number|null=null;
    if(cfg.ready){
      try{
        const me=await telegram(cfg.token,"getMe",{});
        if(String(me?.username||"").toLowerCase()!==BOT_USERNAME) webhookStatus="bot_mismatch";
        else {
          const info=await telegram(cfg.token,"getWebhookInfo",{});
          webhookStatus=info?.url===PROJECT_URL+base ? "registered_here" : "registered_elsewhere";
          pendingUpdates=info?.pending_update_count ?? null;
        }
      }catch{webhookStatus="telegram_api_error";}
    }
    let paymentState=false;
    try { paymentState=(await orderRpc("health")).enabled===true; } catch {}
    return sendJson({
      ok:true,service:"MELA Telegram production",
      configured:cfg.ready, bot:"@"+BOT_USERNAME,
      payments_enabled:paymentState,payment_mode:"manual_receipt_verification",account_linking_enabled:paymentState,registration_verification:"telegram_one_time_code",
      webhook_status:webhookStatus,pending_updates:pendingUpdates,
      supported_commands:["/start","/help","/plans","/pay","/verify","/status","/privacy"],
    });
  }
  // Deployment is complete. Setup never reclaims or moves the webhook.
  if(req.method==="POST" && (path===base+"/setup" || path===base+"/release-cutover" || req.headers.has("x-mela-telegram-setup-secret")))
    return sendJson({ok:false,error:"setup_disabled"},403);

  if(req.method==="POST" && path===base){
    if(!cfg.ready) return sendJson({ok:false,error:"not_configured"},503);
    if(!safeEqual(req.headers.get("x-telegram-bot-api-secret-token")||"",cfg.secret))
      return sendJson({ok:false,error:"unauthorized"},401);
    const length=Number(req.headers.get("content-length")||0);
    if(length>16384) return sendJson({ok:false,error:"payload_too_large"},413);
    let update:any;
    try{
      const body=await req.text();
      if(body.length>16384) return sendJson({ok:false,error:"payload_too_large"},413);
      update=JSON.parse(body);
    }catch{return sendJson({ok:false,error:"invalid_json"},400);}
    const message=update?.message, chat=message?.chat;
    if(!Number.isSafeInteger(update?.update_id)
      || chat?.type!=="private"
      || !Number.isSafeInteger(chat?.id)
      || message?.from?.id!==chat.id
      || message?.from?.is_bot){
      return sendJson({ok:true,ignored:true});
    }
    let answer:string;
    try {
      answer=typeof message.text==="string" && message.text.length<=4096
        ? (await livePaymentReply(message.text,message,update.update_id)) ?? (await registrationReply(message.text,chat.id)) ?? reply(message.text)
        : "Attachments are not accepted. Send /verify to submit a transaction reference. Never send credentials or identity documents.";
    } catch(e) {
      answer=e instanceof Error ? e.message : "Payment service unavailable. Please try again later.";
    }
    try {
      const registrationCode = typeof message.text === 'string' && parseRegistration(message.text)
        ? /\n([a-f0-9]{64})\n/.exec(answer)?.[1] : undefined;
      await telegram(cfg.token,"sendMessage",{
        chat_id:chat.id,text:answer,protect_content:true,
        ...(registrationCode ? {reply_markup:{inline_keyboard:[[{text:'Copy verification code',copy_text:{text:registrationCode}}]]}} : {}),
      });
      return sendJson({ok:true});
    } catch {
      return sendJson({ok:false,error:"reply_failed"},502);
    }
  }
  return sendJson({ok:false,error:"not_found"},404);
});

