import type { createClient } from '@/lib/supabase/client';

/**
 * The official MFQATS process. These five names are the only process stages; every screen takes them from here.
 * Database values live in orders.extended_status (supabase/migrations/*_five_stage_process.sql).
 */
export const PROCESS_STAGES = [
  { key: 'upload', label: 'Upload', description: 'Inspection images of the furniture are captured and uploaded.' },
  { key: 'reconstruction_3d', label: '3D Reconstruction', description: 'The images are processed into a 3D representation of the furniture.' },
  { key: 'detect_defects', label: 'Detect Defects', description: 'The furniture is scanned for defects such as cracks, holes, scratches and dents.' },
  { key: 'results', label: 'Results', description: 'The inspection findings, annotated images and confidence scores are reviewed.' },
  { key: 'recommendation', label: 'Recommendation', description: 'The recommended action is given: release the item, or correct it and inspect again.' },
] as const;

/** Every value of orders.extended_status, in order. Pending/Confirmed/Delivered/Cancelled are order statuses, not process stages. */
export const ORDER_STATUSES = ['pending', 'confirmed', ...PROCESS_STAGES.map((s) => s.key), 'delivered', 'cancelled'] as const;

const LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  ...Object.fromEntries(PROCESS_STAGES.map((s) => [s.key, s.label])),
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Official display name of an order status / process stage. */
export const statusLabel = (s?: string | null) =>
  !s ? '—' : LABELS[s] ?? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const isProcessStage = (s?: string | null) => PROCESS_STAGES.some((p) => p.key === s);

/** Badge colour for an order status (StatusBadge variants). */
export function statusVariant(s?: string | null): 'ok' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple' {
  if (s === 'delivered') return 'ok';
  if (s === 'cancelled') return 'danger';
  if (s === 'pending') return 'warning';
  if (s === 'results' || s === 'recommendation') return 'info';
  if (isProcessStage(s)) return 'purple';
  return 'neutral';
}

/**
 * Move an order to another status. The database checks the move (enforce_order_fsm), sets completion_pct,
 * timestamps the stage and notifies the customer, so callers only handle the error message.
 */
export async function moveOrderStage(
  supabase: ReturnType<typeof createClient>,
  order: { id: string; extended_status?: string | null; status?: string | null; queue_position?: number | null },
  newStatus: string,
) {
  const { error } = await supabase.from('orders').update({
    extended_status: newStatus,
    // legacy column kept for older rows; screens read extended_status
    status: ['delivered', 'cancelled'].includes(newStatus) ? newStatus : newStatus === 'pending' ? 'pending' : 'in_production',
  }).eq('id', order.id);
  if (error) throw error;

  // customer-facing history feed (non-blocking)
  Promise.resolve(supabase.from('order_history_logs').insert({
    order_id: order.id,
    event_type: 'status_updated',
    title: `Status updated to ${statusLabel(newStatus)}`,
    description: `Order moved to ${statusLabel(newStatus)}`,
    old_status: order.extended_status || order.status || '',
    new_status: newStatus,
    queue_position: order.queue_position || null,
    performed_by: null,
  })).catch(() => {});
}
