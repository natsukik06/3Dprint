# Photon 3D print prep pipeline

Automates: STL → hollow + drain hole (Blender) → slice with organic/branching
supports (PrusaSlicer) → repair + convert to Anycubic Photon format (UVtools).

## Three ways to use this

**A) A whole batch of shop orders, printed together on one plate (recommended)**
On the shop admin's batch detail page
([admin/batches/[id]](../src/app/admin/batches/%5Bid%5D/page.tsx)):
1. Set each item's drain-hole X/Z position (0-1 fraction of its own
   footprint, same convention as `HOLE_X`/`HOLE_Y` below) in the "中空化・
   穴あけ" list, then click "一括で中空化・穴あけを実行" -- runs the
   hollow+hole step for every item in the batch, one at a time.
2. Click "プレート配置ファイルを生成" -- packs all the now-hollowed items
   onto one or more real 298x164mm plates (`src/lib/plateLayout.ts`).
3. Click "まとめてダウンロード(ZIP)" for a plate, extract the zip.
4. Run `plate.bat "C:\path\to\extracted-folder"` -- slices every STL in
   that folder together as one combined plate and produces one `.pm7m` for
   the whole plate.

**D) A whole batch, hollowed/holed locally instead of via the shop's Cloud
Function** -- for when the built-in "一括で中空化・穴あけを実行" step is too
slow. On the batch detail page:
1. Click "① 元モデルをまとめてダウンロード(ZIP)" -- one plain (pre-hollow)
   STL per design, already scaled to real print size, named `<itemId>.stl`.
2. Extract the zip, then run
   `hollow_batch.bat "C:\path\to\extracted-folder"` -- hollows + holes every
   STL in that folder in one run, writing each result to
   `output\01_hollowed\<itemId>.stl` (same filename, easy to match back up).
3. Back on the batch page, select every file in that output folder in
   "③ 仕上がったSTLをまとめてアップロード" -- matched to items by filename.
4. "プレート配置ファイルを生成" now works exactly like flow A from here.

**B) One model already hollowed by the shop admin** (single order-item page)
The admin order page ([admin/orders/[id]](../src/app/admin/orders/%5Bid%5D/page.tsx))
has the same drain-hole X/Z position controls next to "中空化・穴あけ処理を
実行" for one item at a time -- download the resulting STL, set
`SKIP_HOLLOW=1` in `main.bat`, and pass that STL in. Step 1 is skipped and
it goes straight to PrusaSlicer.

**C) A raw, unhollowed STL** (your own model, not from the shop's pipeline)
Leave `SKIP_HOLLOW=0` (default) in `main.bat` and this tool's own Blender
step handles hollowing + hole placement, using `HOLE_X`/`HOLE_Y`.

B and C use `main.bat` (one STL in, one `.pm7m` out). A uses `plate.bat`
(one folder of STLs in, one combined `.pm7m` out) -- both produce the same
kind of Photon-format output, just single-item vs. whole-plate. D uses
`hollow_batch.bat` for its local hollowing step, then rejoins flow A.

## Folder structure

```
print-pipeline/
  main.bat                  <- single-item pipeline: run this for B/C, one STL
  plate.bat                 <- whole-plate pipeline: run this for a batch zip
  hollow_batch.bat           <- whole-folder hollow+hole only, for flow D
  scripts/
    hollow_and_hole.py      <- Blender headless script (main.bat/hollow_batch.bat)
  input/                    <- put source STLs here (optional convenience folder)
  output/
    01_hollowed/             <- Blender's hollowed + drilled STL (main.bat only)
    02_sliced/                <- PrusaSlicer's .sl1 slice
    03_final/                  <- final Photon-format file ready to print
```

## One-time setup

1. **Blender** — install normally, then edit `BLENDER_EXE` at the top of
   `main.bat` to point at your `blender.exe`.
2. **PrusaSlicer** — install normally, then edit `PRUSASLICER_EXE` to point
   at `prusa-slicer-console.exe` (the console-mode executable, not the GUI
   one — it's in the same install folder and prints output to the terminal
   instead of opening a window).
3. **UVtools** — no official Windows release build was available/used here;
   `main.bat` already points at a working, pre-built `UVtoolsCmd.exe` at
   `print-pipeline\tools\UVtoolsCmd\` (built from source on this machine —
   see "How UVtoolsCmd got built" below for why and how, in case you ever
   need to rebuild it, e.g. for a newer UVtools version).

All three paths are plain `set "VAR=..."` lines near the top of `main.bat`.

## Running it

```bat
print-pipeline\main.bat "C:\path\to\your\model.stl"
```

Each step's output lands in the matching `output\0N_...` folder, named after
your input file. The pipeline stops immediately (non-zero exit code) if any
step fails or its expected output file doesn't appear.

## Verified end-to-end on this machine

All three steps have now actually been run, back to back, via `main.bat`
itself, against a real downloaded STL — not just syntax-checked. The run
completed with exit code 0 and produced a real `.pm7m` file. Each tool's own
behavior was also independently confirmed:

**1. Blender (`hollow_and_hole.py`)** — imported, hollowed, cut the drain
hole, exported. **Caught a real bug, now fixed:** the test STL's own
geometry was ~1 unit tall, not millimeters. Hollowing it directly at
`--wall-thickness 2.0` blew the mesh apart (the shell was larger than the
model itself). This is why the script has a `--target-max-mm` flag
(`TARGET_MAX_MM` in `main.bat`) that rescales the model to your intended
print size *before* hollowing — set it whenever your source STLs aren't
already sized in real-world mm. Verified fixed: with it set to 40mm, the
result came out correctly proportioned (40 x 40 x 27.6mm) with roughly
double the polygon count, as expected from adding an inner shell.

**2. PrusaSlicer 2.9.6** — confirmed installed and runnable
(`prusa-slicer-console.exe --help-sla` matches the flags used: `--center`,
`--supports-enable`, `--support-tree-type` accepting `default`/`branching`
lowercase — my first draft had `Branching` capitalized, now fixed). **Caught
two real problems:**
- A fresh install has **zero printer profiles** configured
  (`--query-printer-models` returns empty) — running with just
  `--supports-enable --support-tree-type=...` and no printer profile fails
  with *"Nothing to print ... no object fully inside the print volume"*,
  because there's no build-volume/display info for it to place the object
  into.
- **The Photon Mono M7 Max isn't in PrusaSlicer's own bundled Anycubic
  profile set at all** — checked this install's own
  `resources/profiles/AnycubicSLA.ini` directly; it only goes up to
  "Photon Mono X 6K". Anycubic's own recommended slicer for the M7 Max is
  their Photon Workshop app, not PrusaSlicer.

  Fixed by hand-building `config/anycubic_m7_max.ini` from Anycubic's
  published specs (13.6" mono 7K screen, 6480 x 3600px, 46 micron pixel
  pitch, 298 x 164 x 300mm build volume) and loading it via `--load` in
  `main.bat`. Verified working: sliced a real hollowed STL through to a
  10MB `.sl1` with branching tree supports and a pad, successfully.
  **Not verified against a real printer:** `display_mirror_x/y` in that
  ini were copied from the bundled Photon Mono X 6K profile as a guess —
  if a test print comes out mirrored, flip those in the ini (comment
  inside explains which).

**3. UVtoolsCmd 2.1.0** — see "How UVtoolsCmd got built" below for why this
is a self-built binary. Its CLI shape was completely different from my
first-draft guess (there's no `run-operation` command) — fixed by reading
`UVtools.Cmd`'s own source (`RunCommand.cs`, `ConvertCommand.cs`) rather
than guessing further:
- Repair is `run <file> RepairLayers -p Property=value...`, not a dedicated
  `--repair-*` flag set. The critical property most examples online miss:
  `DetectIssues=true` — without it, `RepairLayers` only fixes issues
  *already flagged* on the loaded file (none, for a file opened fresh from
  the CLI), and silently repairs nothing.
- `convert`'s output path is a plain positional argument, not `-o`.
- **Found and worked around a real bug:** this build's `run`/`convert`
  (and even a bare `--version`) always exit with code 1, success or not —
  confirmed by checking `$LASTEXITCODE` directly after each, including
  cases with zero errors in the output. Blender and PrusaSlicer don't have
  this problem (both correctly exit 0 on success). So `main.bat` no longer
  trusts UVtoolsCmd's exit code for these two steps — it logs each call's
  output and checks for UVtools' own `Error:`-prefixed lines instead
  (confirmed exact format in `Program.cs`'s `WriteLineError`).
  Verified working end-to-end with this fix in place.

**4. `plate.bat` (whole-plate mode)** — built to slice multiple
pre-positioned STLs (a batch zip's contents) together as one plate. Tested
with a real 3-item folder positioned like `plateLayout.ts` would place them,
and **found a critical bug before it could ship**: PrusaSlicer's CLI does
**not** combine multiple trailing STL arguments into one job by default —
without `--merge`, it silently re-runs the whole slice once per input file,
each time overwriting `--output`, so the final `.sl1` only ever contained
the *last* file. This was easy to miss (exit code 0, no error text) --
caught only by extracting and actually looking at a mid-print layer image
from the output, which showed 1 turtle instead of 3. Added `--merge`
(alongside `--dont-arrange`, still needed so it doesn't re-scramble
`plateLayout.ts`'s positions) and re-verified the same way: the layer image
now shows all 3 objects, each with its own individual supports, at their
correct positions. `plate.bat` also went through the same full
Blender/UVtools pipeline (repair → convert to `.pm7m`) successfully.

One thing to be aware of, not a bug: a 3-item test plate used noticeably
more resin than 3x a single item's usage (29ml vs. an expected ~11ml). This
is PrusaSlicer's own pad-merging behavior when objects are within
`PadMaxMergeDistance` (50mm, set in `config/anycubic_m7_max.ini`) of each
other -- their support pads/rafts join into one larger connected base
instead of 3 separate small ones. Confirmed this isn't dropped/duplicated
geometry (the layer image shows exactly 3 distinct objects with individual
supports); it's a real material-cost tradeoff of packing items close
together. Space items further apart on the plate if this matters, or lower
`PadMaxMergeDistance` in the ini.

## How UVtoolsCmd got built

No official prebuilt Windows binary was fetched or run — the folder you
extracted at the repo root, `UVtools-master/`, turned out to be the **full
GitHub source snapshot** (a "master" branch zip), not a compiled release.
Rather than have you go re-download a different zip, it was built from
source instead: `.NET SDK` was already on this machine, so
`dotnet build UVtools.Cmd\UVtools.Cmd.csproj -c Release` (from inside the
extracted `UVtools-master\UVtools-master` folder) compiled it in about 30
seconds with 0 errors. The resulting `UVtoolsCmd.exe` and its dependency
DLLs were then copied to `print-pipeline\tools\UVtoolsCmd\` — a stable
location `main.bat` points at — and confirmed to still run correctly from
there.

You can now safely delete the `UVtools-master\` folder at the repo root
(it's just source code and build artifacts, ~1000s of files, not something
that belongs in this git repo long-term) — nothing in `print-pipeline\`
depends on it anymore. If UVtools ever releases a new version and you want
to rebuild, re-download the source zip and repeat the `dotnet build` command
above, or check https://github.com/sn4k3/UVtools/releases first in case an
official Windows build becomes available by then.

## Leftover test files

The verification run above left real output files in `output\01_hollowed\`,
`output\02_sliced\`, and `output\03_final\` (from a public domain turtle
keychain STL, not your own model) — safe to delete any time, they're just
evidence the pipeline works, not something the pipeline depends on.

## Sources

- [UVtools #995 — Anycubic Photon Mono M7 Max File Format Incorrect](https://github.com/sn4k3/UVtools/issues/995)
- [UVtools #1018 — Anycubic Photon M7 MAX, .pm7m file problem](https://github.com/sn4k3/UVtools/discussions/1018)
- [Anycubic — Photon Mono M7 Max product page](https://store.anycubic.com/products/photon-mono-m7-max) (build volume spec)
