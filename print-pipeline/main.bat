@echo off
setlocal enabledelayedexpansion

:: ==============================================================
::  main.bat -- Anycubic Photon print-prep pipeline
::
::  1) Blender  (headless)   : hollow the STL + cut a drain hole
::  2) PrusaSlicer (CLI)     : auto-arrange, organic/branching supports, slice
::  3) UVtoolsCmd (CLI)      : repair islands/suction cups, convert to Photon format
::
::  Usage:
::      main.bat "C:\path\to\model.stl"
::
::  If your STL was already hollowed + holed elsewhere (e.g. downloaded from
::  the shop admin's order page, which now has its own hole-position control
::  built in -- no need to redo that here), set SKIP_HOLLOW=1 below to skip
::  step 1 and feed that STL straight into PrusaSlicer.
:: ==============================================================

:: ---- 1. TOOL PATHS -- edit these for your machine --------------
set "BLENDER_EXE=C:\Program Files\Blender Foundation\Blender 5.0\blender.exe"
set "PRUSASLICER_EXE=C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer-console.exe"
:: Self-built from source (UVtools 2.1.0) -- no official Windows release was
:: available/needed; see README.md "UVtools" setup notes for why and how.
set "UVTOOLSCMD_EXE=%~dp0tools\UVtoolsCmd\UVtoolsCmd.exe"

:: ---- 2. PIPELINE SETTINGS ---------------------------------------
:: Set to 1 if the input STL is already hollowed + holed (e.g. downloaded
:: from the admin order page's "中空化・穴あけ処理を実行" -- that now has its
:: own bottom-hole X/Z position controls, so redoing it here would just be
:: duplicate work). When 1, step 1 (Blender) is skipped entirely and the
:: input STL is fed straight into PrusaSlicer; WALL_THICKNESS_MM, HOLE_*,
:: and TARGET_MAX_MM below are ignored.
set "SKIP_HOLLOW=0"
set "WALL_THICKNESS_MM=2.0"
set "HOLE_DIAMETER_MM=3.0"
:: Where the drain hole sits on the model's BOTTOM face (it's always on the
:: bottom -- drain holes need gravity to work). 0.0-1.0 fractions across the
:: model's own footprint: 0.5,0.5 = centered (default). Set these per-model
:: to move the hole away from a spot that would be visible, conflict with
:: supports, etc. -- e.g. 0.2,0.5 puts it near one edge instead of center.
set "HOLE_X=0.5"
set "HOLE_Y=0.5"
:: If your source STLs are NOT already exported in real millimeters at your
:: intended print size, set this to your target size (mm, largest dimension)
:: so the model gets rescaled before hollowing. Leave blank to skip rescaling
:: (use this when your STL is already correctly sized in mm).
:: Verified necessary: a sample STL tested here turned out to be ~1 unit
:: tall, not mm -- hollowing it directly at WALL_THICKNESS_MM=2.0 blew the
:: geometry apart. Rescaling first fixed it. See README.md for details.
set "TARGET_MAX_MM="
:: Support-tree type, resin exposure times, and all other SLA print settings
:: live in config\anycubic_m7_max.ini (loaded via --load below), not here --
:: PrusaSlicer needs a full printer profile (bed size, display resolution)
:: to slice at all, so it wasn't practical to keep just this one setting as
:: a standalone flag. Displayed in the step banner below for visibility only.
set "SUPPORT_TREE_TYPE=branching (see config\anycubic_m7_max.ini)"
:: Bed-center coordinates for --center below, in mm. Set for the Photon Mono
:: M7 Max specifically: build volume is 298 x 164mm (confirmed via Anycubic's
:: own spec page), so center is 149,82. If you're printing on a different
:: Photon model, look up its build plate size and recompute (X/2, Y/2).
set "BED_CENTER=149,82"

:: ---- 3. FOLDERS (relative to this script) -----------------------
set "ROOT=%~dp0"
set "SCRIPTS_DIR=%ROOT%scripts"
set "HOLLOWED_DIR=%ROOT%output\01_hollowed"
set "SLICED_DIR=%ROOT%output\02_sliced"
set "FINAL_DIR=%ROOT%output\03_final"

if "%~1"=="" (
    echo Usage: main.bat "input.stl"
    exit /b 1
)
if not exist "%~1" (
    echo [ERROR] Input file not found: %~1
    exit /b 1
)

set "INPUT_STL=%~1"
for %%F in ("%INPUT_STL%") do set "BASENAME=%%~nF"

if not exist "%HOLLOWED_DIR%" mkdir "%HOLLOWED_DIR%"
if not exist "%SLICED_DIR%" mkdir "%SLICED_DIR%"
if not exist "%FINAL_DIR%" mkdir "%FINAL_DIR%"

set "HOLLOWED_STL=%HOLLOWED_DIR%\%BASENAME%_hollow.stl"
set "SLICED_FILE=%SLICED_DIR%\%BASENAME%.sl1"
set "FINAL_FILE=%FINAL_DIR%\%BASENAME%.pm7m"

set "TARGET_MAX_MM_ARG="
if not "%TARGET_MAX_MM%"=="" set "TARGET_MAX_MM_ARG=--target-max-mm %TARGET_MAX_MM%"

:: Uses goto rather than an if/else block here -- cmd.exe's parenthesized-block
:: parser doesn't play well with a caret-continued multi-line command nested
:: inside it (hit a real "+ was unexpected at this time" parse error testing
:: this); goto avoids that entirely.
if "%SKIP_HOLLOW%"=="1" goto :skip_hollow_step

echo.
echo === [1/3] Blender: hollowing (%WALL_THICKNESS_MM%mm wall) + drain hole (%HOLE_DIAMETER_MM%mm) ===
"%BLENDER_EXE%" --background --python "%SCRIPTS_DIR%\hollow_and_hole.py" -- ^
    --input "%INPUT_STL%" ^
    --output "%HOLLOWED_STL%" ^
    --wall-thickness %WALL_THICKNESS_MM% ^
    --hole-diameter %HOLE_DIAMETER_MM% ^
    --hole-x %HOLE_X% ^
    --hole-y %HOLE_Y% ^
    %TARGET_MAX_MM_ARG%
if errorlevel 1 (
    echo [ERROR] Blender step failed - see output above.
    exit /b 1
)
goto :after_hollow_step

:skip_hollow_step
echo.
echo === [1/3] Blender: SKIPPED - SKIP_HOLLOW=1, input STL is already hollowed+holed ===
copy /y "%INPUT_STL%" "%HOLLOWED_STL%" >nul

:after_hollow_step
if not exist "%HOLLOWED_STL%" (
    echo [ERROR] Expected Blender output not found: %HOLLOWED_STL%
    exit /b 1
)

echo.
echo === [2/3] PrusaSlicer: arrange + %SUPPORT_TREE_TYPE% supports + slice to SL1 ===
:: Tested and confirmed working on this machine (PrusaSlicer 2.9.6): using a
:: bare --supports-enable / --support-tree-type without a printer profile
:: fails with "Nothing to print ... no object fully inside the print
:: volume", because a fresh PrusaSlicer install has NO printer profiles
:: configured (--query-printer-models returns empty) -- there's no build
:: volume for it to place the object into. The M7 Max also isn't in
:: PrusaSlicer's own bundled Anycubic profile set at all (checked: only up
:: to Photon Mono X 6K). --load with the hand-built profile below (bed
:: size, display resolution, supports) fixes this -- ran it end-to-end
:: against a real hollowed STL and it sliced + supported + rasterized
:: successfully. See config\anycubic_m7_max.ini and README.md for details
:: and what still needs verifying against a real print.
"%PRUSASLICER_EXE%" ^
    --load "%ROOT%config\anycubic_m7_max.ini" ^
    --export-sla ^
    --center %BED_CENTER% ^
    --output "%SLICED_FILE%" ^
    "%HOLLOWED_STL%"
if errorlevel 1 (
    echo [ERROR] PrusaSlicer step failed - see output above.
    exit /b 1
)
if not exist "%SLICED_FILE%" (
    echo [ERROR] Expected PrusaSlicer output not found: %SLICED_FILE%
    exit /b 1
)

echo.
echo === [3/3] UVtoolsCmd: auto-repair islands/suction cups/resin traps + convert to Photon format ===
:: Tested and confirmed working end-to-end on this machine (self-built
:: UVtoolsCmd 2.1.0 -- see README.md). Corrections from my first draft,
:: found by reading UVtools' own source and actually running it:
::   1. There's no "run-operation" command. It's `run <file> <OperationClass>
::      -p Property=value...`. The repair operation class is RepairLayers,
::      with properties RepairIslands/RepairResinTraps/RepairSuctionCups
::      (booleans) -- and critically DetectIssues=true, which most CLI
::      examples omit. Without it, RepairLayers only fixes issues already
::      flagged on the loaded file (none, for a file that's never been
::      opened in the GUI) and silently does nothing.
::   2. `convert`'s output path is a plain positional argument, not -o.
::   3. IMPORTANT: this build of UVtoolsCmd exits with code 1 on EVERY run,
::      including a bare `--version` with nothing to fail -- confirmed by
::      direct testing, not an assumption. So `if errorlevel 1` can't be
::      used to detect real failures here (unlike the Blender/PrusaSlicer
::      steps above, which do exit 0 on success -- also confirmed). Instead,
::      each call's output is logged and grepped for UVtools' own
::      "Error:"-prefixed lines, which is how it actually reports failures.
"%UVTOOLSCMD_EXE%" run "%SLICED_FILE%" RepairLayers -p DetectIssues=true -p RepairIslands=true -p RepairResinTraps=true -p RepairSuctionCups=true -o "%SLICED_FILE%" > "%SLICED_DIR%\repair.log" 2>&1
type "%SLICED_DIR%\repair.log"
findstr /C:"Error:" "%SLICED_DIR%\repair.log" >nul
if not errorlevel 1 (
    echo [ERROR] UVtoolsCmd repair step reported an error - see log above.
    exit /b 1
)

"%UVTOOLSCMD_EXE%" convert "%SLICED_FILE%" pm7m "%FINAL_FILE%" > "%FINAL_DIR%\convert.log" 2>&1
type "%FINAL_DIR%\convert.log"
findstr /C:"Error:" "%FINAL_DIR%\convert.log" >nul
if not errorlevel 1 (
    echo [ERROR] UVtoolsCmd convert step reported an error - see log above.
    exit /b 1
)
if not exist "%FINAL_FILE%" (
    echo [ERROR] Expected final Photon file not found: %FINAL_FILE%
    exit /b 1
)

echo.
echo === DONE ===
echo Hollowed STL : %HOLLOWED_STL%
echo Sliced (SL1) : %SLICED_FILE%
echo Photon file  : %FINAL_FILE%

endlocal
