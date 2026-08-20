/**
 * Builds a column-major 4x4 transform that rotates a shape built along the
 * local +Z axis to align with `direction`, then translates it to `position`.
 * Uses Rodrigues' rotation formula rather than solving for Euler angles,
 * since it handles an arbitrary target axis (including the anti-parallel
 * case) without special-casing. Pure math, safe to use in the browser or in
 * Node (used both for actually drilling holes via manifold-3d and for
 * positioning the client-side hole-marker preview geometry).
 */
export function buildAlignAndTranslate(
  direction: [number, number, number],
  position: [number, number, number]
): number[] {
  let [dx, dy, dz] = direction;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  dx /= len;
  dy /= len;
  dz /= len;

  // cross(z, d) = (-dy, dx, 0); dot(z, d) = dz
  const dot = dz;
  let r00 = 1, r01 = 0, r02 = 0;
  let r10 = 0, r11 = 1, r12 = 0;
  let r20 = 0, r21 = 0, r22 = 1;

  if (dot < -0.999999) {
    // Anti-parallel to +Z: 180° about the X axis (any perpendicular axis works).
    r11 = -1;
    r22 = -1;
  } else if (dot < 0.999999) {
    const ax = -dy;
    const ay = dx;
    const axisLen = Math.sqrt(ax * ax + ay * ay) || 1;
    const ux = ax / axisLen;
    const uy = ay / axisLen;
    const sinT = axisLen;
    const cosT = dot;
    const t = 1 - cosT;

    r00 = cosT + ux * ux * t;
    r01 = ux * uy * t;
    r02 = uy * sinT;

    r10 = uy * ux * t;
    r11 = cosT + uy * uy * t;
    r12 = -ux * sinT;

    r20 = -uy * sinT;
    r21 = ux * sinT;
    r22 = cosT;
  }
  // else dot >= 0.999999: already aligned with +Z, identity rotation.

  const [px, py, pz] = position;
  // Column-major 4x4.
  return [
    r00, r10, r20, 0,
    r01, r11, r21, 0,
    r02, r12, r22, 0,
    px, py, pz, 1,
  ];
}
