@echo off
setlocal enabledelayedexpansion

:: ==============================================================
::  plate.bat -- slice a whole plate at once
::
::  Takes a folder of pre-hollowed, pre-positioned STLs (downloaded via the
::  "batch zip download" button on the shop admin's batch detail page,
::  /admin/batches/[id], then extracted) and slices ALL of them together as
::  one combined plate -- preserving the exact packed layout plateLayout.ts
::  already computed (src/lib/plateLayout.ts), not re-arranging them.
::
::  Usage:
::      plate.bat "C:\path\to\extracted-zip-folder"
:: ==============================================================

:: ---- 1. TOOL PATHS -- edit these for your machine --------------
set "PRUSASLICER_EXE=C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer-console.exe"
:: Self-built from source (UVtools 2.1.0) -- see README.md UVtools setup notes.
set "UVTOOLSCMD_EXE=%~dp0tools\UVtoolsCmd\UVtoolsCmd.exe"

:: ---- 2. SETTINGS -------------------------------------------------
:: Bed-center for the Anycubic Photon Mono M7 Max (298 x 164mm build
:: volume). Only used as a fallback reference by PrusaSlicer; --dont-arrange
:: below means it won't actually move anything off plateLayout's positions.
set "BED_CENTER=149,82"

:: ---- 3. FOLDERS (relative to this script) -----------------------
set "ROOT=%~dp0"
set "SLICED_DIR=%ROOT%output\02_sliced"
set "FINAL_DIR=%ROOT%output\03_final"

if "%~1"=="" (
    echo Usage: plate.bat "C:\path\to\extracted-zip-folder"
    exit /b 1
)
if not exist "%~1" (
    echo [ERROR] Folder not found: %~1
    exit /b 1
)

set "INPUT_DIR=%~1"
for %%F in ("%INPUT_DIR%") do set "BASENAME=%%~nF"
if "%BASENAME%"=="" set "BASENAME=plate"

if not exist "%SLICED_DIR%" mkdir "%SLICED_DIR%"
if not exist "%FINAL_DIR%" mkdir "%FINAL_DIR%"

set "SLICED_FILE=%SLICED_DIR%\%BASENAME%.sl1"
set "FINAL_FILE=%FINAL_DIR%\%BASENAME%.pm7m"

:: Collect every .stl in the folder into one argument list, each individually
:: quoted (so filenames with spaces still work when substituted unquoted
:: into the PrusaSlicer command line below).
set "STL_ARGS="
set "STL_COUNT=0"
for %%F in ("%INPUT_DIR%\*.stl") do (
    set "STL_ARGS=!STL_ARGS! "%%F""
    set /a STL_COUNT+=1
)

if "%STL_COUNT%"=="0" (
    echo [ERROR] No .stl files found in: %INPUT_DIR%
    exit /b 1
)

echo.
echo === Slicing whole plate: %STL_COUNT% item(s), positions preserved ===
:: --merge is REQUIRED here. Verified by testing: without it, PrusaSlicer
:: does NOT combine multiple trailing STL args into one job -- it silently
:: re-runs the whole slice once per file, each time overwriting --output, so
:: the final .sl1 only ever contains the LAST file. Confirmed by extracting
:: and viewing a mid-print layer image both ways: without --merge, a 3-item
:: test plate produced a layer with only 1 turtle on it; with --merge, all 3
:: appeared side by side at their correct positions. --dont-arrange is also
:: required -- without it PrusaSlicer re-auto-arranges every object on load,
:: discarding the exact packed positions plateLayout.ts already computed and
:: baked into each STL's own coordinates.
"%PRUSASLICER_EXE%" ^
    --load "%ROOT%config\anycubic_m7_max.ini" ^
    --export-sla ^
    --merge ^
    --dont-arrange ^
    --center %BED_CENTER% ^
    --output "%SLICED_FILE%" ^
    !STL_ARGS!
if errorlevel 1 (
    echo [ERROR] PrusaSlicer step failed - see output above.
    exit /b 1
)
if not exist "%SLICED_FILE%" (
    echo [ERROR] Expected PrusaSlicer output not found: %SLICED_FILE%
    exit /b 1
)

echo.
echo === UVtoolsCmd: repair islands/suction cups/resin traps, convert to Photon format ===
:: See main.bat for why exit codes aren't trusted here and Error:-grepping is
:: used instead (this build of UVtoolsCmd exits 1 on every run, even success).
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
echo Items on plate : %STL_COUNT%
echo Sliced (SL1)   : %SLICED_FILE%
echo Photon file    : %FINAL_FILE%

endlocal
