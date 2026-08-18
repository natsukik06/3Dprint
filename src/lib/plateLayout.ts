// ANYCUBIC Photon Mono M7 Max build volume: 298 x 164 x 300mm (X x depth x height).
export const PLATE_WIDTH_MM = 298;
export const PLATE_DEPTH_MM = 164;
export const PLATE_MARGIN_MM = 5;

export type PackItem = { id: string; footprintX: number; footprintZ: number };
export type PlacedItem = { id: string; x: number; z: number };

/**
 * Greedy shelf packing: places items left-to-right, wrapping to a new row when a
 * row runs out of width, and starting a new plate when a row runs out of depth.
 * Item order is preserved (matches the batch's grid-ID order) so the physical
 * layout stays legible against the printed work sheet. Throws if a single item
 * cannot physically fit on an empty plate.
 */
export function packPlates(items: PackItem[]): PlacedItem[][] {
  const usableWidth = PLATE_WIDTH_MM - 2 * PLATE_MARGIN_MM;
  const usableDepth = PLATE_DEPTH_MM - 2 * PLATE_MARGIN_MM;

  const plates: PlacedItem[][] = [];
  let currentPlate: PlacedItem[] = [];
  let cursorX = 0;
  let cursorZ = 0;
  let rowDepth = 0;

  function startNewPlate() {
    if (currentPlate.length > 0) plates.push(currentPlate);
    currentPlate = [];
    cursorX = 0;
    cursorZ = 0;
    rowDepth = 0;
  }

  for (const item of items) {
    if (item.footprintX > usableWidth || item.footprintZ > usableDepth) {
      throw new Error(`アイテム${item.id}がプレートサイズを超えています`);
    }

    if (cursorX + item.footprintX > usableWidth) {
      cursorX = 0;
      cursorZ += rowDepth + PLATE_MARGIN_MM;
      rowDepth = 0;
    }
    if (cursorZ + item.footprintZ > usableDepth) {
      startNewPlate();
    }

    currentPlate.push({
      id: item.id,
      x: PLATE_MARGIN_MM + cursorX,
      z: PLATE_MARGIN_MM + cursorZ,
    });

    cursorX += item.footprintX + PLATE_MARGIN_MM;
    rowDepth = Math.max(rowDepth, item.footprintZ);
  }

  if (currentPlate.length > 0) plates.push(currentPlate);
  return plates;
}

export type StlPlacement = {
  /** World-space triangles for one model, from modelScaling.extractWorldTriangles. */
  triangles: Float32Array;
  /** World-space bounding box min corner for the same triangles. */
  worldMin: [number, number, number];
  /** Target plate position (mm) for the item's X/Z min corner. */
  targetX: number;
  targetZ: number;
};

/** Merges pre-placed models into a single binary STL, sitting flat on Y=0. */
export function buildPlateStl(placements: StlPlacement[]): Buffer {
  const vertices: number[] = [];

  for (const { triangles, worldMin, targetX, targetZ } of placements) {
    const dx = targetX - worldMin[0];
    const dy = -worldMin[1];
    const dz = targetZ - worldMin[2];
    for (let i = 0; i + 8 < triangles.length; i += 9) {
      for (let v = 0; v < 3; v++) {
        vertices.push(
          triangles[i + v * 3] + dx,
          triangles[i + v * 3 + 1] + dy,
          triangles[i + v * 3 + 2] + dz
        );
      }
    }
  }

  const triangleCount = vertices.length / 9;
  const header = Buffer.alloc(80);
  const countBuffer = Buffer.alloc(4);
  countBuffer.writeUInt32LE(triangleCount, 0);

  const body = Buffer.alloc(triangleCount * 50);
  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9;
    const ax = vertices[base],
      ay = vertices[base + 1],
      az = vertices[base + 2];
    const bx = vertices[base + 3],
      by = vertices[base + 4],
      bz = vertices[base + 5];
    const cx = vertices[base + 6],
      cy = vertices[base + 7],
      cz = vertices[base + 8];

    const ux = bx - ax,
      uy = by - ay,
      uz = bz - az;
    const vx = cx - ax,
      vy = cy - ay,
      vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    const offset = t * 50;
    body.writeFloatLE(nx, offset);
    body.writeFloatLE(ny, offset + 4);
    body.writeFloatLE(nz, offset + 8);
    body.writeFloatLE(ax, offset + 12);
    body.writeFloatLE(ay, offset + 16);
    body.writeFloatLE(az, offset + 20);
    body.writeFloatLE(bx, offset + 24);
    body.writeFloatLE(by, offset + 28);
    body.writeFloatLE(bz, offset + 32);
    body.writeFloatLE(cx, offset + 36);
    body.writeFloatLE(cy, offset + 40);
    body.writeFloatLE(cz, offset + 44);
    body.writeUInt16LE(0, offset + 48);
  }

  return Buffer.concat([header, countBuffer, body]);
}
