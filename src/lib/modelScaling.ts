import { SIZE_TARGET_MM, type BoundingBoxMm, type SizeOption } from "@/types/order";

const GLB_MAGIC = 0x46546c67;
const CHUNK_TYPE_JSON = 0x4e4f534a;
const CHUNK_TYPE_BIN = 0x004e4942;

// Minimal glTF 2.0 JSON shape covering only the fields this module touches.
type GltfNode = {
  children?: number[];
  mesh?: number;
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
};
type GltfAccessor = {
  bufferView?: number;
  byteOffset?: number;
  componentType?: number;
  type?: string;
  count: number;
  min?: number[];
  max?: number[];
};
type GltfBufferView = {
  byteOffset?: number;
  byteStride?: number;
};
type GltfMeshPrimitive = {
  attributes: Record<string, number>;
  indices?: number;
};
type GltfJson = {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes: GltfNode[];
  meshes?: { primitives: GltfMeshPrimitive[] }[];
  accessors?: GltfAccessor[];
  bufferViews?: GltfBufferView[];
};

type ParsedGlb = { json: GltfJson; bin: Buffer | null };

type Mat4 = number[]; // 16 numbers, column-major

function parseGlb(glb: Buffer): ParsedGlb {
  if (glb.length < 12 || glb.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error("GLBファイルの形式が不正です");
  }
  const totalLength = glb.readUInt32LE(8);

  let offset = 12;
  let json: GltfJson | null = null;
  let bin: Buffer | null = null;

  while (offset + 8 <= Math.min(totalLength, glb.length)) {
    const chunkLength = glb.readUInt32LE(offset);
    const chunkType = glb.readUInt32LE(offset + 4);
    const chunkData = glb.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === CHUNK_TYPE_JSON) {
      json = JSON.parse(chunkData.toString("utf8")) as GltfJson;
    } else if (chunkType === CHUNK_TYPE_BIN) {
      bin = Buffer.from(chunkData);
    }
    offset += 8 + chunkLength;
  }

  if (!json) throw new Error("GLBにJSONチャンクが見つかりません");
  return { json, bin };
}

function buildGlb(json: GltfJson, bin: Buffer | null): Buffer {
  let jsonBuffer = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPad = (4 - (jsonBuffer.length % 4)) % 4;
  if (jsonPad > 0) {
    jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(jsonPad, 0x20)]);
  }

  let binBuffer = bin ?? Buffer.alloc(0);
  const binPad = (4 - (binBuffer.length % 4)) % 4;
  if (binPad > 0) {
    binBuffer = Buffer.concat([binBuffer, Buffer.alloc(binPad, 0x00)]);
  }
  const hasBin = binBuffer.length > 0;

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonBuffer.length, 0);
  jsonChunkHeader.writeUInt32LE(CHUNK_TYPE_JSON, 4);

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binBuffer.length, 0);
  binChunkHeader.writeUInt32LE(CHUNK_TYPE_BIN, 4);

  const totalLength =
    12 +
    jsonChunkHeader.length +
    jsonBuffer.length +
    (hasBin ? binChunkHeader.length + binBuffer.length : 0);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  return Buffer.concat(
    hasBin
      ? [header, jsonChunkHeader, jsonBuffer, binChunkHeader, binBuffer]
      : [header, jsonChunkHeader, jsonBuffer]
  );
}

function identity4(): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiply4(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

function composeTRS(t?: number[], r?: number[], s?: number[]): Mat4 {
  const [tx, ty, tz] = t ?? [0, 0, 0];
  const [qx, qy, qz, qw] = r ?? [0, 0, 0, 1];
  const [sx, sy, sz] = s ?? [1, 1, 1];

  const x2 = qx + qx,
    y2 = qy + qy,
    z2 = qz + qz;
  const xx = qx * x2,
    xy = qx * y2,
    xz = qx * z2;
  const yy = qy * y2,
    yz = qy * z2,
    zz = qz * z2;
  const wx = qw * x2,
    wy = qw * y2,
    wz = qw * z2;

  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

function localMatrixOf(node: GltfNode): Mat4 {
  if (node.matrix) return node.matrix;
  return composeTRS(node.translation, node.rotation, node.scale);
}

function transformPoint(m: Mat4, p: [number, number, number]): [number, number, number] {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function readAccessorMinMax(
  json: GltfJson,
  bin: Buffer | null,
  accessorIndex: number
): { min: number[]; max: number[] } {
  const accessor = json.accessors?.[accessorIndex];
  if (!accessor) throw new Error("POSITIONアクセサが見つかりません");
  if (accessor.min && accessor.max) {
    return { min: accessor.min, max: accessor.max };
  }
  if (accessor.bufferView === undefined || !bin) {
    throw new Error("POSITIONアクセサの座標データを取得できません");
  }
  const bufferView = json.bufferViews?.[accessor.bufferView];
  if (!bufferView) throw new Error("bufferViewが見つかりません");

  const byteStride = bufferView.byteStride ?? 12;
  const baseOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < accessor.count; i++) {
    const offset = baseOffset + i * byteStride;
    const x = bin.readFloatLE(offset);
    const y = bin.readFloatLE(offset + 4);
    const z = bin.readFloatLE(offset + 8);
    min[0] = Math.min(min[0], x);
    min[1] = Math.min(min[1], y);
    min[2] = Math.min(min[2], z);
    max[0] = Math.max(max[0], x);
    max[1] = Math.max(max[1], y);
    max[2] = Math.max(max[2], z);
  }

  return { min, max };
}

const COMPONENT_BYTE_SIZES: Record<number, number> = {
  5120: 1, // BYTE
  5121: 1, // UNSIGNED_BYTE
  5122: 2, // SHORT
  5123: 2, // UNSIGNED_SHORT
  5125: 4, // UNSIGNED_INT
  5126: 4, // FLOAT
};
const TYPE_COMPONENT_COUNTS: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
};

function readComponent(bin: Buffer, offset: number, componentType: number): number {
  switch (componentType) {
    case 5120:
      return bin.readInt8(offset);
    case 5121:
      return bin.readUInt8(offset);
    case 5122:
      return bin.readInt16LE(offset);
    case 5123:
      return bin.readUInt16LE(offset);
    case 5125:
      return bin.readUInt32LE(offset);
    case 5126:
      return bin.readFloatLE(offset);
    default:
      throw new Error(`未対応のcomponentTypeです: ${componentType}`);
  }
}

/** Reads every element of an accessor as an array of component tuples. */
function readAccessorData(json: GltfJson, bin: Buffer | null, accessorIndex: number): number[][] {
  const accessor = json.accessors?.[accessorIndex];
  if (!accessor) throw new Error("アクセサが見つかりません");
  const numComponents = TYPE_COMPONENT_COUNTS[accessor.type ?? "VEC3"] ?? 3;

  if (accessor.bufferView === undefined || !bin) {
    return Array.from({ length: accessor.count }, () => new Array(numComponents).fill(0));
  }
  const bufferView = json.bufferViews?.[accessor.bufferView];
  if (!bufferView) throw new Error("bufferViewが見つかりません");

  const componentType = accessor.componentType ?? 5126;
  const componentSize = COMPONENT_BYTE_SIZES[componentType] ?? 4;
  const byteStride = bufferView.byteStride ?? numComponents * componentSize;
  const baseOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

  const result: number[][] = [];
  for (let i = 0; i < accessor.count; i++) {
    const elementOffset = baseOffset + i * byteStride;
    const values: number[] = [];
    for (let c = 0; c < numComponents; c++) {
      values.push(readComponent(bin, elementOffset + c * componentSize, componentType));
    }
    result.push(values);
  }
  return result;
}

function forEachMeshNode(
  json: GltfJson,
  visit: (node: GltfNode, worldMatrix: Mat4) => void
): void {
  const sceneIndex = json.scene ?? 0;
  const scene = json.scenes?.[sceneIndex];
  if (!scene?.nodes) return;

  function traverse(nodeIndex: number, parentMatrix: Mat4) {
    const node = json.nodes[nodeIndex];
    if (!node) return;
    const world = multiply4(parentMatrix, localMatrixOf(node));
    visit(node, world);
    for (const childIndex of node.children ?? []) {
      traverse(childIndex, world);
    }
  }

  for (const rootIndex of scene.nodes) {
    traverse(rootIndex, identity4());
  }
}

/**
 * Computes the world-space axis-aligned bounding box of a GLB's default scene,
 * in the model's native units (treated as millimeters by convention in this app).
 */
export function computeBoundingBoxMm(glb: Buffer): BoundingBoxMm {
  const { json, bin } = parseGlb(glb);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  forEachMeshNode(json, (node, world) => {
    if (node.mesh === undefined) return;
    const mesh = json.meshes?.[node.mesh];
    if (!mesh) return;

    for (const primitive of mesh.primitives) {
      const accessorIndex = primitive.attributes?.POSITION;
      if (accessorIndex === undefined) continue;
      const { min: aMin, max: aMax } = readAccessorMinMax(json, bin, accessorIndex);

      for (let cx = 0; cx < 2; cx++) {
        for (let cy = 0; cy < 2; cy++) {
          for (let cz = 0; cz < 2; cz++) {
            const corner: [number, number, number] = [
              cx ? aMax[0] : aMin[0],
              cy ? aMax[1] : aMin[1],
              cz ? aMax[2] : aMin[2],
            ];
            const [wx, wy, wz] = transformPoint(world, corner);
            min[0] = Math.min(min[0], wx);
            min[1] = Math.min(min[1], wy);
            min[2] = Math.min(min[2], wz);
            max[0] = Math.max(max[0], wx);
            max[1] = Math.max(max[1], wy);
            max[2] = Math.max(max[2], wz);
          }
        }
      }
    }
  });

  if (!isFinite(min[0])) {
    throw new Error("GLBにメッシュのPOSITIONデータが見つかりませんでした");
  }

  return { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] };
}

/**
 * Extracts every triangle of every mesh primitive in a GLB's default scene, resolved
 * to world space (indexed and non-indexed primitives both supported). Returned as a
 * flat Float32Array of 9 numbers per triangle (3 vertices x xyz).
 */
export function extractWorldTriangles(glb: Buffer): Float32Array {
  const { json, bin } = parseGlb(glb);
  const triangles: number[] = [];

  forEachMeshNode(json, (node, world) => {
    if (node.mesh === undefined) return;
    const mesh = json.meshes?.[node.mesh];
    if (!mesh) return;

    for (const primitive of mesh.primitives) {
      const posIndex = primitive.attributes?.POSITION;
      if (posIndex === undefined) continue;
      const positions = readAccessorData(json, bin, posIndex).map(([x, y, z]) =>
        transformPoint(world, [x, y, z])
      );

      const indices =
        primitive.indices !== undefined
          ? readAccessorData(json, bin, primitive.indices).map(([i]) => i)
          : positions.map((_, i) => i);

      for (let i = 0; i + 2 < indices.length; i += 3) {
        const a = positions[indices[i]];
        const b = positions[indices[i + 1]];
        const c = positions[indices[i + 2]];
        if (!a || !b || !c) continue;
        triangles.push(...a, ...b, ...c);
      }
    }
  });

  return Float32Array.from(triangles);
}

/** World-space AABB of a flat triangle array (as returned by extractWorldTriangles). */
export function boundsOfTriangles(triangles: Float32Array): {
  min: [number, number, number];
  max: [number, number, number];
} {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i + 2 < triangles.length; i += 3) {
    min[0] = Math.min(min[0], triangles[i]);
    min[1] = Math.min(min[1], triangles[i + 1]);
    min[2] = Math.min(min[2], triangles[i + 2]);
    max[0] = Math.max(max[0], triangles[i]);
    max[1] = Math.max(max[1], triangles[i + 1]);
    max[2] = Math.max(max[2], triangles[i + 2]);
  }

  if (!isFinite(min[0])) {
    throw new Error("GLBにメッシュのPOSITIONデータが見つかりませんでした");
  }
  return { min, max };
}

/** World-space AABB derived from the actual triangle data (not accessor min/max). */
export function computeWorldBoundsMm(glb: Buffer): {
  min: [number, number, number];
  max: [number, number, number];
} {
  return boundsOfTriangles(extractWorldTriangles(glb));
}

/**
 * Returns a new GLB buffer with every root node of the default scene uniformly
 * scaled by `factor` (about the world origin). Mesh vertex data is left untouched;
 * only node transforms are rewritten, so the file stays valid and lightweight.
 */
export function scaleGlb(glb: Buffer, factor: number): Buffer {
  const { json, bin } = parseGlb(glb);
  const sceneIndex = json.scene ?? 0;
  const scene = json.scenes?.[sceneIndex];
  if (!scene?.nodes?.length) {
    throw new Error("GLBにシーンのルートノードが見つかりません");
  }

  for (const rootIndex of scene.nodes) {
    const node = json.nodes[rootIndex];
    if (!node) continue;
    if (node.matrix) {
      const m = [...node.matrix];
      for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]) {
        m[i] *= factor;
      }
      node.matrix = m;
    } else {
      const t = node.translation ?? [0, 0, 0];
      const s = node.scale ?? [1, 1, 1];
      node.translation = [t[0] * factor, t[1] * factor, t[2] * factor];
      node.scale = [s[0] * factor, s[1] * factor, s[2] * factor];
    }
  }

  return buildGlb(json, bin);
}

export function determineTargetMaxMm(sizeOption: SizeOption): number {
  return SIZE_TARGET_MM[sizeOption];
}

/**
 * Ratio between a scaled model's bounding box and the original it was scaled
 * from (uniform scale, so any axis would do — picks the largest original
 * extent to avoid dividing by a near-zero axis).
 */
export function computeScaleFactor(original: BoundingBoxMm, scaled: BoundingBoxMm): number {
  const axis: (keyof BoundingBoxMm)[] = ["x", "y", "z"];
  const largest = axis.reduce((best, a) => (original[a] > original[best] ? a : best), "x");
  return original[largest] > 0 ? scaled[largest] / original[largest] : 1;
}
