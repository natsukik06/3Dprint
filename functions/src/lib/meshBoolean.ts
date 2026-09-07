// Mirrored from src/lib/meshBoolean.ts -- keep in sync if that file changes.
//
// manifold-3d is ESM-only (package.json has "type": "module", no "require" export condition),
// which is why this whole Functions package is also built as ESM (see tsconfig.json's
// module/moduleResolution: NodeNext + package.json's "type": "module") -- a CommonJS build's
// `require("manifold-3d")` fails with ERR_PACKAGE_PATH_NOT_EXPORTED at Cloud Functions deploy-time
// analysis. As real ESM, this static import resolves normally.
import Module, { type Manifold as ManifoldInstance, type ManifoldToplevel } from "manifold-3d";
import { buildAlignAndTranslate } from "./rotation.js";
import { engraveLetter } from "./textEngrave.js";

let wasmPromise: Promise<ManifoldToplevel> | null = null;

function initManifold(): Promise<ManifoldToplevel> {
  if (!wasmPromise) {
    wasmPromise = Module().then((wasm) => {
      wasm.setup();
      return wasm;
    });
  }
  return wasmPromise;
}

async function trianglesToManifold(triangles: Float32Array): Promise<ManifoldInstance> {
  const wasm = await initManifold();
  const vertCount = triangles.length / 3;
  const triVerts = new Uint32Array(vertCount);
  for (let i = 0; i < vertCount; i++) triVerts[i] = i;

  const mesh = new wasm.Mesh({
    numProp: 3,
    vertProperties: triangles,
    triVerts,
  });
  mesh.merge();

  const manifold = new wasm.Manifold(mesh);
  const status = manifold.status();
  if (status !== "NoError") {
    throw new Error(
      `モデルの形状が不正なため処理できません（status: ${status}）。元の3Dモデルに穴や非多様体な形状がある可能性があります。`
    );
  }
  return manifold;
}

function manifoldToTriangles(manifold: ManifoldInstance): Float32Array {
  const mesh = manifold.getMesh();
  const out = new Float32Array(mesh.numTri * 9);
  for (let t = 0; t < mesh.numTri; t++) {
    const [a, b, c] = mesh.verts(t);
    for (let k = 0; k < 3; k++) {
      const vertIndex = [a, b, c][k];
      const pos = mesh.position(vertIndex);
      out[t * 9 + k * 3] = pos[0];
      out[t * 9 + k * 3 + 1] = pos[1];
      out[t * 9 + k * 3 + 2] = pos[2];
    }
  }
  return out;
}

// AI-generated meshes routinely arrive wildly oversampled for a keychain-sized print (measured
// ~960k triangles for one real 28mm order -- see the timing investigation this was added
// alongside) -- every triangle in the ORIGINAL mesh pays its cost again in every downstream
// boolean op (minkowskiDifference erosion, then subtract, then the hole/engrave subtracts on
// top). 0.02mm is well under the printer's own 46-micron pixel pitch (see
// config/anycubic_m7_max.ini in print-pipeline/), so simplifying to that tolerance cannot change
// what actually comes out of the printer -- it only removes geometry the print process was
// already discarding. Pass 0 to disable (kept overridable, not hardcoded, in case a future
// subject type needs finer surface detail than a resin pet/object keychain does).
const DEFAULT_SIMPLIFY_TOLERANCE_MM = 0.02;

/**
 * Hollows a solid triangle-soup mesh by a uniform wall thickness using morphological erosion
 * (Manifold.minkowskiDifference against a sphere of radius = wallThicknessMm), then subtracting
 * the eroded cavity from the original solid.
 */
export async function hollowMesh(
  triangles: Float32Array,
  wallThicknessMm: number,
  sphereSegments = 32,
  simplifyToleranceMm = DEFAULT_SIMPLIFY_TOLERANCE_MM
): Promise<Float32Array> {
  const wasm = await initManifold();
  let outer = await trianglesToManifold(triangles);
  if (simplifyToleranceMm > 0) {
    outer = outer.simplify(simplifyToleranceMm);
  }

  const cavity = outer.minkowskiDifference(wasm.Manifold.sphere(wallThicknessMm, sphereSegments));
  if (cavity.status() !== "NoError") {
    throw new Error(`中空化に失敗しました（status: ${cavity.status()}）`);
  }
  if (cavity.isEmpty()) {
    throw new Error(
      "壁厚がモデルに対して厚すぎるため、内部が完全に埋まってしまいました（中空化できません）"
    );
  }

  const shell = outer.subtract(cavity);
  if (shell.status() !== "NoError") {
    throw new Error(`中空化に失敗しました（status: ${shell.status()}）`);
  }

  return manifoldToTriangles(shell);
}

export type HoleSpec = {
  position: [number, number, number];
  diameterMm: number;
  direction?: [number, number, number];
};

/** Cuts one or more cylindrical holes through a triangle-soup mesh via a real boolean difference. */
export async function cutHoles(
  triangles: Float32Array,
  holes: HoleSpec[],
  throughLengthMm: number
): Promise<Float32Array> {
  const wasm = await initManifold();
  let solid = await trianglesToManifold(triangles);

  for (const hole of holes) {
    const radius = hole.diameterMm / 2;
    const direction = hole.direction ?? [0, 1, 0];
    const transform = buildAlignAndTranslate(direction, hole.position);
    const cylinder = wasm.Manifold.cylinder(throughLengthMm, radius, radius, 32, true).transform(
      transform as unknown as [
        number, number, number, number,
        number, number, number, number,
        number, number, number, number,
        number, number, number, number,
      ]
    );
    solid = solid.subtract(cylinder);
    if (solid.status() !== "NoError") {
      throw new Error(`穴あけ処理の結果が不正な形状になりました（status: ${solid.status()}）`);
    }
  }

  return manifoldToTriangles(solid);
}

// NOT mirrored to src/lib/meshBoolean.ts on purpose (unlike the rest of this file) -- it depends
// on ./textEngrave.js, which pulls in opentype.js + a bundled font file. That's fine for this
// Cloud Functions package (already a Node-only, non-bundled-for-browser context) but would add
// real weight to the Next.js app for a function nothing there calls (finish-mesh runs exclusively
// as a Cloud Function -- see the comment on the API route). If this ever needs to run client-side
// too, port textEngrave.ts over at that point rather than pre-emptively.
export async function engraveText(
  triangles: Float32Array,
  letter: string,
  position: [number, number, number],
  normal: [number, number, number],
  heightMm: number,
  depthMm: number
): Promise<Float32Array> {
  const wasm = await initManifold();
  const solid = await trianglesToManifold(triangles);
  const engraved = await engraveLetter(wasm, solid, letter, position, normal, heightMm, depthMm);
  if (engraved.status() !== "NoError") {
    throw new Error(`刻印処理の結果が不正な形状になりました（status: ${engraved.status()}）`);
  }
  return manifoldToTriangles(engraved);
}
