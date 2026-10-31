// Fixed formatting (no Intl), so the web and the mobile app can show exactly the same text.

/** 4.6 → "4,6"; 4 → "4,0". */
export function formatRating(rating: number): string {
  return rating.toFixed(1).replace(".", ",")
}

/** 625 → "625"; 1.5 → "1,5"; 0.3333 → "0,3". */
export function formatAmount(amount: number): string {
  const rounded = Math.round(amount * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",")
}

/** Ingredient amount for `servings` portions when the recipe is written for `baseServings`. */
export function scaleAmount(amount: number, servings: number, baseServings: number): number {
  return (amount * servings) / baseServings
}
