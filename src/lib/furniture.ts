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

type OrderLike = { product_name?: string | null; product_category?: string | null } | null | undefined;
const isCategory = (c: string | null | undefined): c is string => (CATEGORIES as readonly string[]).includes(c ?? '');

// for orders without a shop category (older ones say "furniture"): the kind of piece from its name; first match wins
const BY_NAME: [RegExp, string][] = [
  [/desk/i, 'Office Furniture'],
  [/cabinet|sideboard|wardrobe|cupboard|dresser|armoire/i, 'Cabinets'],
  [/shel(f|v)|bookcase|storage/i, 'Storage'],
  [/\bbed\b/i, 'Beds'],
  [/chair|stool|bench/i, 'Chairs'],
  [/table/i, 'Tables'],
];

/** The kind of furniture an order is: its shop category, else what its product name says, else Other. */
export function furnitureOf(o: OrderLike): string {
  if (isCategory(o?.product_category)) return o!.product_category!;
  const name = o?.product_name ?? '';
  return BY_NAME.find(([re]) => re.test(name))?.[1] ?? 'Other';
}

/** The furniture kinds in a list, in catalog order, with how many of each. */
export function furnitureCounts(list: OrderLike[]): [string, number][] {
  const n = new Map<string, number>();
  for (const o of list) n.set(furnitureOf(o), (n.get(furnitureOf(o)) ?? 0) + 1);
  return [...CATEGORIES, 'Other'].filter((c) => n.has(c)).map((c) => [c, n.get(c)!]);
}

/** A list split by kind of furniture (catalog order), keeping each group's own order. */
export function byFurniture<T extends OrderLike>(list: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const o of list) groups.set(furnitureOf(o), [...(groups.get(furnitureOf(o)) ?? []), o]);
  return [...CATEGORIES, 'Other'].filter((c) => groups.has(c)).map((c) => [c, groups.get(c)!]);
}

/**
 * Category of an order: its own product_category when it is one of the shop's categories, else the catalog's
 * category for its product name, else what the name says (older orders were saved as plain "furniture").
 */
export async function categoryOf(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.from('products').select('name, category');
  const byName = new Map((data ?? []).map((p: { name: string; category: string }) => [p.name.toLowerCase(), p.category]));
  return (o: OrderLike): string => {
    if (isCategory(o?.product_category)) return o!.product_category!;
    const fromCatalog = byName.get((o?.product_name ?? '').toLowerCase());
    return isCategory(fromCatalog) ? fromCatalog : furnitureOf(o);
  };
}
