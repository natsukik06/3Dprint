@echo off
setlocal

:: ==============================================================
::  print_time_labels.bat -- print a whole batch of elapsed-time
::  labels at once (e.g. for a resin/glitter timing experiment),
::  one per minute value given.
::
::  Usage:
::      print_time_labels.bat <minutes1> [<minutes2> ...]
::
::  Example (0/30/60/90/120-minute marks):
::      print_time_labels.bat 0 30 60 90 120
:: ==============================================================

if "%~1"=="" (
    echo Usage: print_time_labels.bat ^<minutes1^> [minutes2 ...]
    echo Example: print_time_labels.bat 0 30 60 90 120
    exit /b 1
)

set "WSL_DISTRO=Ubuntu"
set "WIN_DIR=%~dp0"
set "WSL_DIR=/mnt/c%WIN_DIR:~2%"
set "WSL_DIR=%WSL_DIR:\=/%"

:loop
if "%~1"=="" goto :done
set "M=%~1"

echo === Generating %M% label ===
wsl -d %WSL_DISTRO% -- bash -lc "cd '%WSL_DIR%' && python3 make_time_label.py %M% ラメ投入"
if errorlevel 1 (
    echo [ERROR] Failed to generate the %M% label image.
    exit /b 1
)

wsl -d %WSL_DISTRO% -- bash -lc "cd '%WSL_DIR%../output' && brother_ql -b pyusb --model QL-800 -p usb://0x04f9:0x209b print -l 62 time_label_%M%.png"
if errorlevel 1 (
    echo [ERROR] Printing the %M% label failed -- check the printer is attached to WSL (usbipd attach --wsl --busid BUSID) and has tape loaded.
    exit /b 1
)

shift
goto :loop

:done
echo.
echo === DONE: time labels printed ===
endlocal
exit /b 0
