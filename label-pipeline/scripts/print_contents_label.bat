@echo off
setlocal

:: ==============================================================
::  print_contents_label.bat -- print ONE order's "what's inside"
::  label. Run this once per shipment, alongside
::  print_recipient_label.bat, right before you pack it.
::
::  Usage:
::      print_contents_label.bat "<注文番号>" "<内容1>" ["<内容2>" ...]
::
::  Example:
::      print_contents_label.bat "A00000012" "うさぎ（小サイズ）星空ブルー×1" "うさぎ（中サイズ）ネビュラピンク×1／金具:シルバー"
:: ==============================================================

if "%~2"=="" (
    echo Usage: print_contents_label.bat "注文番号" "内容1" ["内容2" ...]
    exit /b 1
)

set "WSL_DISTRO=Ubuntu"
set "WIN_DIR=%~dp0"
set "WSL_DIR=/mnt/c%WIN_DIR:~2%"
set "WSL_DIR=%WSL_DIR:\=/%"

set "ARGS="
:collect
if "%~1"=="" goto :run
set "ARGS=%ARGS% '%~1'"
shift
goto :collect

:run
wsl -d %WSL_DISTRO% -- bash -lc "cd '%WSL_DIR%' && python3 make_contents_label.py%ARGS%"
if errorlevel 1 (
    echo [ERROR] Failed to generate the contents label image.
    exit /b 1
)

wsl -d %WSL_DISTRO% -- bash -lc "cd '%WSL_DIR%../output' && brother_ql -b pyusb --model QL-800 -p usb://0x04f9:0x209b print -l 62 contents_label.png"
if errorlevel 1 (
    echo [ERROR] Printing failed -- check the printer is attached to WSL (usbipd attach --wsl --busid ^<BUSID^>) and has tape loaded.
    exit /b 1
)

echo.
echo === DONE: contents label printed ===
endlocal
exit /b 0
