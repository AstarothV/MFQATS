import type { createClient } from '@/lib/supabase/client';

// extended_status (FSM stage) -> legacy current_stage column still read by older pages
const DB_STAGE: Record<string, string> = {
  cutting: 'cutting', assembly: 'assembly', sanding: 'sanding',
  finishing: 'finishing', quality_inspection: 'quality_check',
  ready_for_delivery: 'shipping', delivered: 'shipping',
};

export const statusLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Move an order to another FSM stage. The database checks the move (enforce_order_fsm), sets completion_pct,
 * timestamps the stage and notifies the customer, so callers only handle the error message.
 */
export async function moveOrderStage(
  supabase: ReturnType<typeof createClient>,
  order: { id: string; extended_status?: string | null; status?: string | null; queue_position?: number | null },
  newStatus: string,
) {
  const { error } = await supabase.from('orders').update({
    extended_status: newStatus,
    status: ['delivered', 'cancelled'].includes(newStatus) ? newStatus : 'in_production',
    current_stage: DB_STAGE[newStatus] || 'cutting',
  }).eq('id', order.id);
  if (error) throw error;

  // customer-facing history feed (non-blocking)
  Promise.resolve(supabase.from('order_history_logs').insert({
    order_id: order.id,
    event_type: 'status_updated',
    title: `Status updated to ${statusLabel(newStatus)}`,
    description: `Order moved to ${statusLabel(newStatus)} stage`,
    old_status: order.extended_status || order.status || '',
    new_status: newStatus,
    queue_position: order.queue_position || null,
    performed_by: null,
  })).catch(() => {});
}
