import { ORDER_STATUSES } from '@/lib/orders';

// Order lists grouped by stage, in the order an order goes through them; Delivered (done) and Cancelled come last.
// Used by the staff order menu, and the customer's Overview and OrderView.

export const stageRank = (s: string) => { const i = (ORDER_STATUSES as readonly string[]).indexOf(s); return i < 0 ? 99 : i; };

/** Dot colour of a stage group; the process stages are purple. */
export const STAGE_DOT: Record<string, string> = { pending: 'bg-warning', confirmed: 'bg-info', delivered: 'bg-success', cancelled: 'bg-danger' };
export const stageDot = (s: string) => STAGE_DOT[s] ?? 'bg-primary';

/** A few words after the stage name, for customers. */
export const STAGE_HINT: Record<string, string> = {
  pending: 'waiting for approval', confirmed: 'approved, starting soon', delivered: 'done', cancelled: 'not going ahead',
};

/** Sorted by stage (newest first within a stage, as the list came), with a heading wherever the stage changes. */
export function byStage<T>(list: T[], stageOf: (o: T) => string): { order: T; heading: boolean }[] {
  const sorted = [...list].sort((a, b) => stageRank(stageOf(a)) - stageRank(stageOf(b)));
  return sorted.map((order, i) => ({ order, heading: i === 0 || stageOf(sorted[i - 1]) !== stageOf(order) }));
}
