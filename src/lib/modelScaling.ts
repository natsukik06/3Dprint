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
  count: number;
  min?: number[];
  max?: number[];
};
type GltfBufferView = {
  byteOffset?: number;
  byteStride?: number;
};
type GltfJson = {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes: GltfNode[];
  meshes?: { primitives: { attributes: Record<string, number> }[] }[];
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
