export const GRID_COLS = ["A", "B", "C", "D", "E"] as const;
export const GRID_ROWS = [1, 2, 3, 4, 5, 6] as const;
// A soft target for how many physical pieces one batch/work-sheet normally covers -- NOT the
// physical plate's real capacity (that's footprint-based bin packing in plateLayout.ts, and
// automatically spans as many physical plates as it takes). This number only sizes the paper
// work-sheet grid and how eagerly batch generation groups pending items together.
export const MAX_CAPACITY = GRID_COLS.length * GRID_ROWS.length; // 30

/**
 * Row-major fill order: A1,B1,C1,D1,E1,A2,B2,... Pass `count` > MAX_CAPACITY to keep generating
 * additional rows past 6 (continuing the same 5-column pattern) -- needed when a single order's
 * own quantity exceeds the normal 30-cell target and still has to fit in one batch (see
 * generate/route.ts: a batch never splits one order across two batches, even an oversized one).
 */
export function buildGridSequence(count: number = MAX_CAPACITY): string[] {
  const rowCount = Math.max(GRID_ROWS.length, Math.ceil(count / GRID_COLS.length));
  const sequence: string[] = [];
  for (let row = 1; row <= rowCount; row++) {
    for (const col of GRID_COLS) {
      sequence.push(`${col}${row}`);
    }
  }
  return sequence.slice(0, count);
}
