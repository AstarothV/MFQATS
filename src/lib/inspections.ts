import type { createClient } from '@/lib/supabase/client';

// Defect rate = share of inspected pieces that failed. Quality Scan saves one detection_logs row per inspection with
// overall_result pass / fail / pending; pending ones have no verdict yet and are left out. (Dividing defects by orders
// instead can pass 100%: one piece can have several defects.)

export interface InspectionCounts {
  failed: number;
  total: number; // inspections with a pass or fail verdict
}

export async function fetchInspectionCounts(supabase: ReturnType<typeof createClient>): Promise<InspectionCounts> {
  const [failed, judged] = await Promise.all([
    supabase.from('detection_logs').select('id', { count: 'exact', head: true }).eq('overall_result', 'fail'),
    supabase.from('detection_logs').select('id', { count: 'exact', head: true }).in('overall_result', ['pass', 'fail']),
  ]);
  return { failed: failed.count ?? 0, total: judged.count ?? 0 };
}

/** Percent of inspections that failed, 0–100 (0 when nothing has been inspected yet). */
export const defectRate = ({ failed, total }: InspectionCounts) => (total > 0 ? (failed / total) * 100 : 0);
