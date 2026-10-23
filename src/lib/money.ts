// MVCA prices and order amounts are in Philippine pesos.
export const peso = (n: number | string | null | undefined) =>
  `₱${Number(n ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

/** Short form for summary cards: ₱12.3K, ₱1.2M. */
export function pesoShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `₱${(n / 1_000).toFixed(1)}K`;
  return peso(n);
}
