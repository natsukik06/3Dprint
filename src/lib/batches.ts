export const GRID_COLS = ["A", "B", "C", "D", "E"] as const;
export const GRID_ROWS = [1, 2, 3, 4, 5, 6] as const;
export const MAX_CAPACITY = GRID_COLS.length * GRID_ROWS.length; // 30

/** Row-major fill order: A1,B1,C1,D1,E1,A2,B2,... */
export function buildGridSequence(): string[] {
  const sequence: string[] = [];
  for (const row of GRID_ROWS) {
    for (const col of GRID_COLS) {
      sequence.push(`${col}${row}`);
    }
  }
  return sequence;
}
