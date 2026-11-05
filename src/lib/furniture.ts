import type { createClient } from '@/lib/supabase/client';

/** The shop's furniture categories, in the order the catalog shows them. */
export const CATEGORIES = ['Tables', 'Chairs', 'Beds', 'Storage', 'Office Furniture', 'Cabinets'] as const;

/** One violet family plus neutral tones for the categories (status colours stay for status only). */
export const CATEGORY_COLOR: Record<string, string> = {
  Tables: '#7C3AED',
  Chairs: '#A78BFA',
  Beds: '#5B21B6',
  Storage: '#C4B5FD',
  'Office Furniture': '#6366F1',
  Cabinets: '#94A3B8',
  Other: '#64748B',
};

/**
 * Category of an order: its own product_category when it is one of the shop's categories, else the catalog's
 * category for its product name (older orders were saved as plain "furniture").
 */
export async function categoryOf(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.from('products').select('name, category');
  const byName = new Map((data ?? []).map((p: { name: string; category: string }) => [p.name.toLowerCase(), p.category]));
  return (o: { product_name?: string | null; product_category?: string | null } | null | undefined): string => {
    const own = o?.product_category ?? '';
    if ((CATEGORIES as readonly string[]).includes(own)) return own;
    const fromCatalog = byName.get((o?.product_name ?? '').toLowerCase());
    return fromCatalog && (CATEGORIES as readonly string[]).includes(fromCatalog) ? fromCatalog : 'Other';
  };
}
