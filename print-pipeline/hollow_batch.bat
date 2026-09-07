@echo off
setlocal enabledelayedexpansion

:: ==============================================================
::  hollow_batch.bat -- hollow + drain-hole a WHOLE FOLDER of STLs at once
::
::  Pairs with the shop admin batch page's "raw model zip download" button
::  (/admin/batches/[id]): extract that zip, point this script at the
::  extracted folder, and every "<itemId>.stl" in it gets hollowed + holed
::  by Blender in one run. Each output keeps the EXACT SAME filename (no
::  "_hollow" suffix, unlike main.bat) -- so the whole output folder can be
::  selected directly in the batch page's "upload finished STLs" file
::  picker without renaming anything.
::
::  Usage:
::      hollow_batch.bat "C:\path\to\extracted-raw-zip-folder"
::
::  Output:
::      output\01_hollowed\<itemId>.stl  (one per input file)
::
::  Per-item hole position: if the input folder also has a
::  "<itemId>.hole.txt" next to a given "<itemId>.stl" (one line, "X Y
::  DIAMETER_MM" -- exactly what the batch page's zip download includes,
::  sourced from its own per-item hole-position list), that file's position
::  is used for that item instead of the HOLE_X/HOLE_Y/HOLE_DIAMETER_MM
::  defaults below. A single fixed position for every item in the folder
::  would land in a bad spot (a leg, an ear, too thin a wall) on anything
::  but a symmetric shape -- set each item's position on the batch page
::  BEFORE downloading if your items aren't all roughly the same shape.
:: ==============================================================

:: ---- 1. TOOL PATHS -- edit these for your machine --------------
set "BLENDER_EXE=C:\Program Files\Blender Foundation\Blender 5.0\blender.exe"

:: ---- 2. PIPELINE SETTINGS (fallback defaults) --------------------
:: Used only for an item that has no matching "<itemId>.hole.txt" next to
:: it -- see the per-item hole position note above.
set "WALL_THICKNESS_MM=2.0"
set "HOLE_DIAMETER_MM=3.0"
set "HOLE_X=0.5"
set "HOLE_Y=0.5"
:: Leave blank -- items downloaded via the batch page's raw-model zip are
:: already scaled to their real print size in mm (see the raw-stl API
:: route), so no rescaling is needed here.
set "TARGET_MAX_MM="

:: ---- 3. FOLDERS (relative to this script) -----------------------
set "ROOT=%~dp0"
set "SCRIPTS_DIR=%ROOT%scripts"
set "HOLLOWED_DIR=%ROOT%output\01_hollowed"

if "%~1"=="" (
    echo Usage: hollow_batch.bat "C:\path\to\extracted-raw-zip-folder"
    exit /b 1
)
if not exist "%~1" (
    echo [ERROR] Folder not found: %~1
    exit /b 1
)

set "INPUT_DIR=%~1"
if not exist "%HOLLOWED_DIR%" mkdir "%HOLLOWED_DIR%"

set "TARGET_MAX_MM_ARG="
if not "%TARGET_MAX_MM%"=="" set "TARGET_MAX_MM_ARG=--target-max-mm %TARGET_MAX_MM%"

set "TOTAL=0"
set "FAILED=0"
for %%F in ("%INPUT_DIR%\*.stl") do set /a TOTAL+=1

if "%TOTAL%"=="0" (
    echo [ERROR] No .stl files found in: %INPUT_DIR%
    exit /b 1
)

echo.
echo === Hollowing %TOTAL% item(s) ===

set "DONE=0"
for %%F in ("%INPUT_DIR%\*.stl") do (
    set /a DONE+=1
    call :resolve_hole "%%~nF"
    echo.
    echo --- [!DONE!/%TOTAL%] %%~nxF -- hole X=!ITEM_HOLE_X! Y=!ITEM_HOLE_Y! diameter=!ITEM_HOLE_D!mm ---
    "%BLENDER_EXE%" --background --python "%SCRIPTS_DIR%\hollow_and_hole.py" -- ^
        --input "%%F" ^
        --output "%HOLLOWED_DIR%\%%~nF.stl" ^
        --wall-thickness %WALL_THICKNESS_MM% ^
        --hole-diameter !ITEM_HOLE_D! ^
        --hole-x !ITEM_HOLE_X! ^
        --hole-y !ITEM_HOLE_Y! ^
        !TARGET_MAX_MM_ARG!
    if errorlevel 1 (
        echo [ERROR] Blender step failed for %%~nxF - see output above.
        set /a FAILED+=1
    )
)

echo.
echo === DONE: %DONE% processed, %FAILED% failed ===
echo Output folder: %HOLLOWED_DIR%
echo Select every .stl in that folder in the batch page's
echo "upload finished STLs" picker to upload them all at once.

if not "%FAILED%"=="0" exit /b 1
endlocal
exit /b 0

:: Sets ITEM_HOLE_X / ITEM_HOLE_Y / ITEM_HOLE_D from "%INPUT_DIR%\%~1.hole.txt"
:: if it exists, otherwise from the global HOLE_X/HOLE_Y/HOLE_DIAMETER_MM
:: defaults. Kept as its own subroutine (called, not inlined) so the for-loop
:: body above never mixes a parenthesized if-block with a caret-continued
:: multi-line command -- that combination is what broke main.bat's own
:: SKIP_HOLLOW branch earlier in this project (see its comment for details).
:resolve_hole
set "ITEM_HOLE_X=%HOLE_X%"
set "ITEM_HOLE_Y=%HOLE_Y%"
set "ITEM_HOLE_D=%HOLE_DIAMETER_MM%"
set "HOLE_FILE=%INPUT_DIR%\%~1.hole.txt"
if not exist "%HOLE_FILE%" exit /b 0
for /f "tokens=1,2,3" %%a in (%HOLE_FILE%) do (
    set "ITEM_HOLE_X=%%a"
    set "ITEM_HOLE_Y=%%b"
    set "ITEM_HOLE_D=%%c"
)
exit /b 0
