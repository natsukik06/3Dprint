@echo off
setlocal

:: ==============================================================
::  print_recipient_label.bat -- print ONE order's shipping-to
::  (お届け先) label. Run this once per shipment, right before you
::  pack it, with that order's real address.
::
::  Usage:
::      print_recipient_label.bat "<郵便番号>" "<住所>" "<お名前>"
::
::  Example:
::      print_recipient_label.bat "123-4567" "東京都渋谷区1-2-3" "山田太郎"
::
::  Multi-line address (building name on its own line): separate
::  with \n, e.g. "東京都渋谷区1-2-3\nさくらマンション101"
:: ==============================================================

if "%~3"=="" (
    echo Usage: print_recipient_label.bat "郵便番号" "住所" "お名前"
    exit /b 1
)

set "WSL_DISTRO=Ubuntu"
set "WIN_DIR=%~dp0"
set "WSL_DIR=/mnt/c%WIN_DIR:~2%"
set "WSL_DIR=%WSL_DIR:\=/%"

wsl -d %WSL_DISTRO% -- bash -lc "cd '%WSL_DIR%' && python3 make_recipient_label.py '%~1' '%~2' '%~3'"
if errorlevel 1 (
    echo [ERROR] Failed to generate the recipient label image.
    exit /b 1
)

wsl -d %WSL_DISTRO% -- bash -lc "cd '%WSL_DIR%../output' && brother_ql -b pyusb --model QL-800 -p usb://0x04f9:0x209b print -l 62 recipient_label.png"
if errorlevel 1 (
    echo [ERROR] Printing failed -- check the printer is attached to WSL (usbipd attach --wsl --busid ^<BUSID^>) and has tape loaded.
    exit /b 1
)

echo.
echo === DONE: recipient label printed ===
endlocal
exit /b 0
