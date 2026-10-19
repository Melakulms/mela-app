import { supabase } from './supabase'

export type PaymentOrder = {
  id: string; user_id: string; product_id: string; account_id: string;
  amount_minor: number; currency: 'ETB'; provider: string; recipient: string;
  reference: string | null; status: 'awaiting_payment' | 'pending' | 'approved' | 'rejected';
  reason: string; created_at: string; expires_at: string;
}
export type PaymentDecision = Pick<PaymentOrder, 'status' | 'reason'> & { order_id: string }
async function command<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const { data: result, error } = await supabase.rpc('payment_command_v1', { p_action: action, p_data: data })
  if (error) throw new Error(error.message)
  return result as T
}
export const manualPayments = {
  catalog: () => command<{ enabled: boolean; products: { id: string; title: string; amount_minor: number; currency: string }[]; accounts: { id: string; label: string; provider: string; recipient: string }[] }>('catalog'),
  createOrder: (productId: string, accountId: string) => command<PaymentOrder>('create_order', { product_id: productId, account_id: accountId }),
  submit: (orderId: string, reference: string) => command<PaymentDecision>('submit', { order_id: orderId, reference }),
  myOrders: () => command<PaymentOrder[]>('my_orders'),
  queue: () => command<PaymentOrder[]>('admin_queue'),
  recordReceived: (record: {
    order_id: string; reference: string; recipient: string; amount_minor: number; currency: 'ETB'; paid_at: string;
    confirmed_received: boolean; confirmed_order_owner: boolean; evidence_note: string;
  }) => command<PaymentDecision>('admin_record', record),
  recheck: (orderId: string) => command<PaymentDecision>('admin_recheck', { order_id: orderId }),
  reject: (orderId: string, reason: string) => command<PaymentDecision>('admin_reject', { order_id: orderId, reason }),
}
