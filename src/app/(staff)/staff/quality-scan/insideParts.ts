// Furniture with an inside (cabinets, shelves, drawers) gets extra photos in Upload: the outside views cannot show the
// inside of a cabinet, the shelves or the drawer boxes, where defects hide too.

export const PART_KINDS = ['Interior', 'Shelf', 'Drawer', 'Door back'] as const;

// first match wins; checked against the order's product name and category
const RULES: [RegExp, string[]][] = [
  [/dresser|chest of drawers|drawers?\b|nightstand|bedside/i, ['Drawer 1', 'Drawer 2']],
  [/cabinet|sideboard|wardrobe|cupboard|armoire|buffet|credenza/i, ['Interior', 'Shelf 1', 'Door back']],
  [/bookcase|bookshelf|shelving|shel(f|ves)|storage/i, ['Shelf 1', 'Shelf 2']],
];

/** The inside parts to photograph for this piece; none for tables, chairs, beds and the like. */
export function suggestedParts(...text: (string | null | undefined)[]): string[] {
  const s = text.filter(Boolean).join(' ');
  return RULES.find(([re]) => re.test(s))?.[1] ?? [];
}

/** A new part's name: "Shelf 3" after Shelf 1 and 2; "Interior 2" when there is already an Interior. */
export function nextPartLabel(kind: (typeof PART_KINDS)[number], taken: readonly string[]): string {
  const numbered = kind === 'Shelf' || kind === 'Drawer';
  if (!numbered && !taken.includes(kind)) return kind;
  for (let n = numbered ? 1 : 2; ; n++) if (!taken.includes(`${kind} ${n}`)) return `${kind} ${n}`;
}

// how an inside photo is saved for the order (and shown in the customer's Photo Gallery): "Inside: Drawer 1", and its
// close-up from Detect Defects "Inside: Drawer 1 close-up"
const PREFIX = 'Inside: ';
const CLOSE = ' close-up';
export const insideCaption = (part: string, closeUp = false) => PREFIX + part + (closeUp ? CLOSE : '');
export function partOfCaption(caption: string): { part: string; closeUp: boolean } | null {
  if (!caption.startsWith(PREFIX)) return null;
  const rest = caption.slice(PREFIX.length);
  return rest.endsWith(CLOSE) ? { part: rest.slice(0, -CLOSE.length), closeUp: true } : { part: rest, closeUp: false };
}
