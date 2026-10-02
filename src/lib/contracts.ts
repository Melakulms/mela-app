import { supabase } from './supabase'
export interface Contract { id: string; status: string; agreed_amount: number; currency: string; funding_status: string }
export async function fetchMyContracts(): Promise<Contract[]> {
  const { data, error } = await supabase.from('freelance_contracts')
    .select('id,status,agreed_amount,currency,funding_status').in('status', ['active','disputed']).order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return data ?? []
}
export async function raiseContractDispute(contractId: string, reason: string) {
  const text = reason.trim()
  if (text.length < 10 || text.length > 2000) throw new Error('Explain the issue in 10–2000 characters.')
  const { error } = await supabase.rpc('raise_contract_dispute', { p_contract_id: contractId, p_reason: text })
  if (error) throw error
}
