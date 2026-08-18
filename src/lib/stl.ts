/** Writes a flat triangle array (9 floats per triangle: 3 vertices x xyz) as a binary STL. */
export function trianglesToStl(vertices: Float32Array | number[]): Buffer {
  const triangleCount = Math.floor(vertices.length / 9);
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
