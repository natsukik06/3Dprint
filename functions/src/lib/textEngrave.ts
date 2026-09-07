// Cloud-Functions-only -- deliberately NOT mirrored to src/lib/ like this package's other lib
// files (rotation.ts, meshBoolean.ts, stl.ts). Pulls in opentype.js + a bundled font file, which
// is fine for this Node-only package but would add real, unused weight to the Next.js app bundle
// (nothing there calls it -- finish-mesh runs exclusively as a Cloud Function). See the comment
// on engraveText in meshBoolean.ts for the same note at the call site.
//
// Builds a small 3D letter shape (from a bundled font's glyph outline) and boolean-subtracts it
// into a mesh as a shallow engraving. Used to mark each physical piece with the customer's chosen
// initial (see INITIAL_OPTIONS in src/types/order.ts) so it can never be mixed up with another
// order's piece once it's off the shared print plate and still colorless.
import opentype from "opentype.js";
import type { Manifold as ManifoldInstance, ManifoldToplevel } from "manifold-3d";
import { buildAlignAndTranslate } from "./rotation.js";

let fontPromise: Promise<opentype.Font> | null = null;

function loadFont(): Promise<opentype.Font> {
  if (!fontPromise) {
    fontPromise = (async () => {
      // Bundled at build time -- see functions/src/assets/roboto-bold.woff (Roboto Bold, Latin
      // subset, OFL-licensed via @fontsource/roboto). Only capital A-Z are ever requested
      // (INITIAL_OPTIONS), so a Latin-only subset is enough.
      const { readFile } = await import("node:fs/promises");
      const { fileURLToPath } = await import("node:url");
      const path = fileURLToPath(new URL("../assets/roboto-bold.woff", import.meta.url));
      const buffer = await readFile(path);
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );
      return opentype.parse(arrayBuffer);
    })();
  }
  return fontPromise;
}

/** One flattened, closed 2D contour (font units, Y already flipped to font-up-is-positive). */
type Contour = [number, number][];

// How many line segments to approximate one quadratic/cubic bezier curve with. Plenty for a
// single-character engraving viewed at keychain scale; the font's curves are gentle enough that
// this doesn't read as faceted.
const CURVE_STEPS = 8;

function flattenGlyphToContours(glyph: opentype.Glyph, unitsPerEm: number): Contour[] {
  // opentype.js's getPath(x, y, fontSize) scales output coordinates to `fontSize` as if it were
  // unitsPerEm -- passing the font's REAL unitsPerEm here keeps the returned path in that font's
  // own raw unit space, matching sCapHeight and other font-table metrics used below. (Verified
  // by testing: passing a literal 1000 here against a font with unitsPerEm=2048 silently scaled
  // every glyph to half the intended size.)
  const path = glyph.getPath(0, 0, unitsPerEm);
  const contours: Contour[] = [];
  let current: Contour = [];
  let cx = 0;
  let cy = 0;

  function quadTo(x1: number, y1: number, x2: number, y2: number) {
    for (let i = 1; i <= CURVE_STEPS; i++) {
      const t = i / CURVE_STEPS;
      const mt = 1 - t;
      const x = mt * mt * cx + 2 * mt * t * x1 + t * t * x2;
      const y = mt * mt * cy + 2 * mt * t * y1 + t * t * y2;
      current.push([x, -y]);
    }
  }

  function cubicTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    for (let i = 1; i <= CURVE_STEPS; i++) {
      const t = i / CURVE_STEPS;
      const mt = 1 - t;
      const x =
        mt * mt * mt * cx + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
      const y =
        mt * mt * mt * cy + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
      current.push([x, -y]);
    }
  }

  for (const cmd of path.commands) {
    switch (cmd.type) {
      case "M":
        if (current.length > 0) contours.push(current);
        current = [[cmd.x, -cmd.y]];
        cx = cmd.x;
        cy = cmd.y;
        break;
      case "L":
        current.push([cmd.x, -cmd.y]);
        cx = cmd.x;
        cy = cmd.y;
        break;
      case "Q":
        quadTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
        cx = cmd.x;
        cy = cmd.y;
        break;
      case "C":
        cubicTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
        cx = cmd.x;
        cy = cmd.y;
        break;
      case "Z":
        // Contour closes implicitly (pushed when the next M or the loop ends); nothing to add.
        break;
    }
  }
  if (current.length > 0) contours.push(current);
  return contours;
}

/**
 * Builds a Manifold solid for one capital letter, `heightMm` tall (cap-height, not including any
 * descender -- irrelevant here since only A-Z are supported), extruded `depthMm` along +Z in its
 * own local space (local X = letter width, local Y = letter height, local Z = engraving depth).
 * Centered on its own bounding box at the origin, so placing it is just align-and-translate.
 */
export async function buildLetterManifold(
  wasm: ManifoldToplevel,
  letter: string,
  heightMm: number,
  depthMm: number
): Promise<ManifoldInstance> {
  const font = await loadFont();
  const glyph = font.charToGlyph(letter.toUpperCase());
  const contours = flattenGlyphToContours(glyph, font.unitsPerEm);
  if (contours.length === 0) {
    throw new Error(`フォントに文字「${letter}」の字形が見つかりません`);
  }

  // Scale from font units (unitsPerEm, e.g. 2048) to heightMm using the font's own cap-height
  // metric so the glyph is proportioned the same regardless of which letter is picked.
  const capHeightUnits = font.tables.os2?.sCapHeight || font.unitsPerEm * 0.7;
  const scale = heightMm / capHeightUnits;

  const polygons = contours.map((contour) =>
    contour.map(([x, y]) => [x * scale, y * scale] as [number, number])
  );

  const crossSection = new wasm.CrossSection(polygons, "EvenOdd");
  const solid = wasm.Manifold.extrude(crossSection, depthMm);
  if (solid.status() !== "NoError") {
    throw new Error(`文字「${letter}」の3D化に失敗しました（status: ${solid.status()}）`);
  }

  // Center on X/Y (extrude's Z start is 0, already what we want -- local +Z is engraving depth).
  const box = solid.boundingBox();
  const centerX = (box.min[0] + box.max[0]) / 2;
  const centerY = (box.min[1] + box.max[1]) / 2;
  return solid.translate([-centerX, -centerY, 0]);
}

/**
 * Boolean-subtracts one engraved letter into `solid`, at `position` on its surface, recessed
 * along `normal` (pointing OUT of the surface -- the letter prism is built pointing the opposite
 * way so it cuts inward). `depthMm` should be a fraction of the wall thickness (shallow engraving,
 * not a through-hole) -- e.g. half the wall thickness, so the mark is visible but the shell stays
 * structurally sound.
 */
export async function engraveLetter(
  wasm: ManifoldToplevel,
  solid: ManifoldInstance,
  letter: string,
  position: [number, number, number],
  normal: [number, number, number],
  heightMm: number,
  depthMm: number
): Promise<ManifoldInstance> {
  const letterSolid = await buildLetterManifold(wasm, letter, heightMm, depthMm);

  // The letter was built flat in its own XY plane, extruded along +Z. Align that +Z with the
  // OUTWARD surface normal, then nudge it back along the normal by a hair so the cut starts
  // slightly outside the surface (guarantees a clean boolean subtraction through the surface,
  // same reasoning as the drain-hole cylinder's own overshoot).
  const nudgeMm = 0.2;
  const nudged: [number, number, number] = [
    position[0] + normal[0] * nudgeMm,
    position[1] + normal[1] * nudgeMm,
    position[2] + normal[2] * nudgeMm,
  ];
  // engrave cuts INTO the surface, so the extrusion direction (local +Z) must point along
  // -normal (into the solid), not along normal (which would point the cut out into open air).
  const into: [number, number, number] = [-normal[0], -normal[1], -normal[2]];
  const transform = buildAlignAndTranslate(into, nudged);
  const placed = letterSolid.transform(
    transform as unknown as [
      number, number, number, number,
      number, number, number, number,
      number, number, number, number,
      number, number, number, number,
    ]
  );

  const result = solid.subtract(placed);
  if (result.status() !== "NoError") {
    throw new Error(`刻印処理の結果が不正な形状になりました（status: ${result.status()}）`);
  }
  return result;
}
