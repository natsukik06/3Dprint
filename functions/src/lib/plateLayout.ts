// Mirrored from src/lib/plateLayout.ts -- keep in sync if that file changes.
import { trianglesToStl } from "./stl.js";

export const PLATE_WIDTH_MM = 298;
export const PLATE_DEPTH_MM = 164;
export const PLATE_MARGIN_MM = 5;

export type PackItem = { id: string; footprintX: number; footprintZ: number };
export type PlacedItem = { id: string; x: number; z: number };

/**
 * Greedy shelf packing: places items left-to-right, wrapping to a new row when a row runs out of
 * width, and starting a new plate when a row runs out of depth.
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
  triangles: Float32Array;
  worldMin: [number, number, number];
  targetX: number;
  targetZ: number;
};

/** Translates one pre-placed model to its packed plate position and writes it as its own STL. */
export function buildPlacedItemStl(placement: StlPlacement): Buffer {
  const { triangles, worldMin, targetX, targetZ } = placement;
  const dx = targetX - worldMin[0];
  const dy = -worldMin[1];
  const dz = targetZ - worldMin[2];

  const vertices: number[] = [];
  for (let i = 0; i + 8 < triangles.length; i += 9) {
    for (let v = 0; v < 3; v++) {
      vertices.push(
        triangles[i + v * 3] + dx,
        triangles[i + v * 3 + 1] + dy,
        triangles[i + v * 3 + 2] + dz
      );
    }
  }

  return trianglesToStl(vertices);
}
