function formatSeconds(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}分` : `${m}分${rem}秒`;
}

/**
 * Extrapolates from elapsed time + current progress (0-100) to a rough total/remaining estimate.
 * Deliberately naive (linear extrapolation) -- good enough to answer "how much longer roughly",
 * not a scheduling guarantee. Returns null before there's enough signal to extrapolate from.
 */
export function estimateRemaining(
  startedAtMs: number,
  progress: number,
  now: number = Date.now()
): { elapsedLabel: string; remainingLabel: string | null } {
  const elapsedMs = Math.max(0, now - startedAtMs);
  const elapsedLabel = formatSeconds(elapsedMs / 1000);
  if (progress <= 2 || progress >= 100) {
    return { elapsedLabel, remainingLabel: null };
  }
  const totalEstimateMs = (elapsedMs / progress) * 100;
  const remainingMs = Math.max(0, totalEstimateMs - elapsedMs);
  return { elapsedLabel, remainingLabel: formatSeconds(remainingMs / 1000) };
}
