import Module, { type Manifold as ManifoldInstance, type ManifoldToplevel } from "manifold-3d";
import { buildAlignAndTranslate } from "@/lib/rotation";

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

/**
 * Builds a Manifold solid from a flat triangle-soup array (as returned by
 * modelScaling.extractWorldTriangles). Triangles don't share vertex indices,
 * so we weld coincident positions via Mesh.merge() before constructing the
 * Manifold. Throws if the welded mesh isn't a valid oriented 2-manifold
 * (e.g. the source model has gaps/non-manifold geometry, which can happen
 * with AI-generated meshes) — callers should surface this as a clear error
 * rather than silently producing broken geometry.
 */
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

/**
 * Hollows a solid triangle-soup mesh by a uniform wall thickness using
 * morphological erosion (Manifold.minkowskiDifference against a sphere of
 * radius = wallThicknessMm), then subtracting the eroded cavity from the
 * original solid. This is robust for concave/organic shapes (unlike naive
 * vertex-normal offsetting): regions thinner than 2x wallThicknessMm simply
 * stay solid rather than self-intersecting, which is the physically correct
 * outcome.
 *
 * NOTE: the returned shell has a fully sealed interior cavity. For resin
 * printing this traps uncured resin — callers should also cut a drain/vent
 * hole (see cutHoles) before this is print-ready.
 */
export async function hollowMesh(
  triangles: Float32Array,
  wallThicknessMm: number,
  sphereSegments = 32
): Promise<Float32Array> {
  const wasm = await initManifold();
  const outer = await trianglesToManifold(triangles);

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
  /**
   * World-space direction the hole is drilled along (need not be normalized).
   * Since the cylinder is centered on `position` and drilled through in both
   * directions, the sign doesn't matter — only the axis it defines. Defaults
   * to straight up ([0, 1, 0]) when omitted (e.g. legacy hole records saved
   * before surface-normal capture was added).
   */
  direction?: [number, number, number];
};

/**
 * Cuts one or more cylindrical holes through a triangle-soup mesh via a real
 * boolean difference (manifold-3d), returning the resulting triangle soup.
 * `throughLengthMm` should comfortably exceed the model's own extent along
 * the drill axis so every hole cuts all the way through regardless of local
 * wall thickness — callers should pass ~2x the model's bounding box diagonal.
 */
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
