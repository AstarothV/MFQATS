// Orders with more than one piece (a set of 4 or 6 chairs, several items): every piece is inspected on its own.
// The database works out an order's pieces when it is placed (orders.pieces, migration 026): "Chair 1 of 4"...
// An order without pieces is one piece, as before.

export const piecesOf = (order: { pieces?: string[] | null } | null | undefined): string[] => order?.pieces ?? [];

// A piece's photos are saved with its name in front: "Chair 2 of 4 · Front photo". One-piece orders keep plain captions.
const SEP = ' · ';
export const pieceCaption = (piece: string, caption: string) => (piece ? piece + SEP + caption : caption);

/** The caption without its piece, when it belongs to this piece; null when it is another piece's photo. */
export function captionFor(piece: string, caption: string): string | null {
  if (!piece) return caption.includes(SEP) ? null : caption;
  return caption.startsWith(piece + SEP) ? caption.slice(piece.length + SEP.length) : null;
}

/** The caption without any piece in front (for counting photos across all pieces). */
export const plainCaption = (caption: string) => (caption.includes(SEP) ? caption.slice(caption.indexOf(SEP) + SEP.length) : caption);

/** What an order is, with its count: "Ash Dining Chair × 4" for a set (or several of one item); else the product name. */
export function furnitureLabel(o: { product_name?: string | null; pieces?: string[] | null } | null | undefined): string {
  const name = o?.product_name ?? '';
  const n = o?.pieces?.length ?? 0;
  return n > 1 && !/ more$/.test(name) ? `${name} × ${n}` : name;
}

/** Chairs come in dining sets of 4 or 6, or in any number (Custom quantity). */
export const CHAIR_SETS = [4, 6] as const;

/** The most of one product a customer can order at once: a handmade workshop's realistic batch. Two dining sets of
 *  six chairs, ten office pieces, five of anything else. Larger orders go through an inquiry. */
export const maxQty = (category: string) => (category === 'Chairs' ? 12 : category === 'Office Furniture' ? 10 : 5);
