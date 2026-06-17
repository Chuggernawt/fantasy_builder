/** Sigmoid duel — ratingDiff in ~0–100 scale; k tunes upset frequency. */
export function winProbability(ratingA: number, ratingB: number, k = 0.055): number {
  const diff = ratingA - ratingB;
  return 1 / (1 + Math.exp(-k * diff));
}

export function rollDuel(ratingA: number, ratingB: number, k = 0.055): boolean {
  return Math.random() < winProbability(ratingA, ratingB, k);
}

export function rollChance(probability: number): boolean {
  return Math.random() < Math.max(0, Math.min(1, probability));
}

export function avgRating(values: number[]): number {
  if (!values.length) return 50;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
