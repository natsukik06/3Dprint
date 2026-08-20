import { buildAlignAndTranslate } from "@/lib/rotation";

// Browser-safe (ArrayBuffer/DataView, no Node Buffer) GLB reader/writer that
// injects small marker cylinders into a model so hole position + direction
// can be previewed as real, correctly-occluded 3D geometry instead of a flat
// camera-facing dot. Mirrors the server-side GLB chunk format handling in
// modelScaling.ts, just using browser-native binary APIs.

const GLB_MAGIC = 0x46546c67;
const CHUNK_TYPE_JSON = 0x4e4f534a;
const CHUNK_TYPE_BIN = 0x004e4942;

export type MarkerSpec = {
  position: [number, number, number];
  direction: [number, number, number];
  diameterMm: number;
  heightMm: number;
  colorRgb: [number, number, number]; // 0..1
};

function buildCylinderGeometry(radius: number, height: number, segments = 16) {
  const positions: number[] = [];
  const indices: number[] = [];
  const halfH = height / 2;

  positions.push(0, 0, halfH); // 0: top center
  positions.push(0, 0, -halfH); // 1: bottom center
  const topRingStart = 2;
  const bottomRingStart = 2 + segments;

  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    positions.push(radius * Math.cos(theta), radius * Math.sin(theta), halfH);
  }
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    positions.push(radius * Math.cos(theta), radius * Math.sin(theta), -halfH);
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const t0 = topRingStart + i, t1 = topRingStart + next;
    const b0 = bottomRingStart + i, b1 = bottomRingStart + next;
    indices.push(b0, b1, t1, b0, t1, t0);
  }
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(0, topRingStart + i, topRingStart + next);
  }
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(1, bottomRingStart + next, bottomRingStart + i);
  }

  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
}

type GltfJsonLoose = {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes: { mesh?: number; matrix?: number[] }[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number; material?: number }[] }[];
  accessors: Record<string, unknown>[];
  bufferViews: Record<string, unknown>[];
  materials: Record<string, unknown>[];
  buffers?: Record<string, unknown>[];
};

function parseGlb(buffer: ArrayBuffer): { json: GltfJsonLoose; bin: Uint8Array | null } {
  const view = new DataView(buffer);
  if (buffer.byteLength < 12 || view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error("GLBファイルの形式が不正です");
  }
  const totalLength = view.getUint32(8, true);

  let offset = 12;
  let json: GltfJsonLoose | null = null;
  let bin: Uint8Array | null = null;
  const decoder = new TextDecoder("utf-8");

  while (offset + 8 <= Math.min(totalLength, buffer.byteLength)) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkData = new Uint8Array(buffer, offset + 8, chunkLength);
    if (chunkType === CHUNK_TYPE_JSON) {
      json = JSON.parse(decoder.decode(chunkData)) as GltfJsonLoose;
    } else if (chunkType === CHUNK_TYPE_BIN) {
      bin = chunkData.slice();
    }
    offset += 8 + chunkLength;
  }

  if (!json) throw new Error("GLBにJSONチャンクが見つかりません");
  return { json, bin };
}

function buildGlb(json: GltfJsonLoose, bin: Uint8Array): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const paddedJsonLength = jsonBytes.length + jsonPad;

  const binPad = (4 - (bin.length % 4)) % 4;
  const paddedBinLength = bin.length + binPad;

  const totalLength = 12 + 8 + paddedJsonLength + 8 + paddedBinLength;
  const out = new ArrayBuffer(totalLength);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);

  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);

  let offset = 12;
  view.setUint32(offset, paddedJsonLength, true);
  view.setUint32(offset + 4, CHUNK_TYPE_JSON, true);
  offset += 8;
  bytes.set(jsonBytes, offset);
  bytes.fill(0x20, offset + jsonBytes.length, offset + paddedJsonLength);
  offset += paddedJsonLength;

  view.setUint32(offset, paddedBinLength, true);
  view.setUint32(offset + 4, CHUNK_TYPE_BIN, true);
  offset += 8;
  bytes.set(bin, offset);
  offset += paddedBinLength;

  return out;
}

/** Appends `chunk` (padded to a 4-byte boundary) to `parts`, returning the new running length. */
function appendPadded(parts: Uint8Array[], chunk: Uint8Array, runningLength: number): number {
  parts.push(chunk);
  let next = runningLength + chunk.length;
  const pad = (4 - (chunk.length % 4)) % 4;
  if (pad > 0) {
    parts.push(new Uint8Array(pad));
    next += pad;
  }
  return next;
}

/**
 * Returns a new GLB (as an ArrayBuffer) with one small cylinder mesh added
 * per marker, positioned and oriented via `buildAlignAndTranslate` — the
 * same rotation math used server-side to actually drill the hole, so the
 * preview matches what will really be cut. Original mesh data is untouched;
 * markers are appended as new nodes/meshes/materials.
 */
export function injectHoleMarkers(originalGlb: ArrayBuffer, markers: MarkerSpec[]): ArrayBuffer {
  const { json, bin } = parseGlb(originalGlb);
  const originalBin = bin ?? new Uint8Array(0);

  json.accessors = json.accessors ?? [];
  json.bufferViews = json.bufferViews ?? [];
  json.meshes = json.meshes ?? [];
  json.materials = json.materials ?? [];
  json.nodes = json.nodes ?? [];
  const sceneIndex = json.scene ?? 0;
  json.scenes = json.scenes ?? [{ nodes: [] }];
  if (!json.scenes[sceneIndex]) json.scenes[sceneIndex] = { nodes: [] };
  json.scenes[sceneIndex].nodes = json.scenes[sceneIndex].nodes ?? [];

  const extraParts: Uint8Array[] = [];
  let extraOffset = originalBin.length;

  for (const marker of markers) {
    const { positions, indices } = buildCylinderGeometry(marker.diameterMm / 2, marker.heightMm);

    const posBytes = new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength);
    const posBufferViewIndex = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset: extraOffset, byteLength: posBytes.length });
    extraOffset = appendPadded(extraParts, posBytes, extraOffset);

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]);
      maxX = Math.max(maxX, positions[i]);
      minY = Math.min(minY, positions[i + 1]);
      maxY = Math.max(maxY, positions[i + 1]);
      minZ = Math.min(minZ, positions[i + 2]);
      maxZ = Math.max(maxZ, positions[i + 2]);
    }
    const posAccessorIndex = json.accessors.length;
    json.accessors.push({
      bufferView: posBufferViewIndex,
      componentType: 5126,
      count: positions.length / 3,
      type: "VEC3",
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    });

    const idxBytes = new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength);
    const idxBufferViewIndex = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset: extraOffset, byteLength: idxBytes.length });
    extraOffset = appendPadded(extraParts, idxBytes, extraOffset);

    const idxAccessorIndex = json.accessors.length;
    json.accessors.push({
      bufferView: idxBufferViewIndex,
      componentType: 5125,
      count: indices.length,
      type: "SCALAR",
    });

    const materialIndex = json.materials.length;
    json.materials.push({
      pbrMetallicRoughness: {
        baseColorFactor: [marker.colorRgb[0], marker.colorRgb[1], marker.colorRgb[2], 1],
        metallicFactor: 0,
        roughnessFactor: 0.6,
      },
    });

    const meshIndex = json.meshes.length;
    json.meshes.push({
      primitives: [
        {
          attributes: { POSITION: posAccessorIndex },
          indices: idxAccessorIndex,
          material: materialIndex,
        },
      ],
    });

    const matrix = buildAlignAndTranslate(marker.direction, marker.position);
    const nodeIndex = json.nodes.length;
    json.nodes.push({ mesh: meshIndex, matrix });
    json.scenes[sceneIndex].nodes!.push(nodeIndex);
  }

  const totalExtraLength = extraParts.reduce((sum, c) => sum + c.length, 0);
  const combinedBin = new Uint8Array(originalBin.length + totalExtraLength);
  combinedBin.set(originalBin, 0);
  let writeOffset = originalBin.length;
  for (const chunk of extraParts) {
    combinedBin.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  json.buffers = json.buffers?.length ? json.buffers : [{}];
  json.buffers[0] = { ...json.buffers[0], byteLength: combinedBin.length };

  return buildGlb(json, combinedBin);
}
