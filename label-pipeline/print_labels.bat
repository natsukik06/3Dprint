@echo off
setlocal enabledelayedexpansion

:: ==============================================================
::  print_labels.bat -- one-button print of the labels that stay
::  THE SAME on every shipment (brand-seal logo / condensed
::  thank-you insert), on the Brother QL-800 via the brother_ql
::  install inside WSL. Print a batch of these ahead of time and
::  keep them on hand.
::
::  No return-address / recipient-address labels here on purpose --
::  the carrier's own official shipping label (クリックポストのPDF)
::  or waybill (宅急便コンパクト) already shows both the sender info
::  (tied to the paid label on Japan Post's system) and the
::  destination address, so separate stickers for either would just
::  be redundant -- and skipping the sender one avoids printing a
::  home address on every parcel. (make_address_label.py /
::  print_recipient_label.bat are still there if a future shipping
::  method ever needs either one.)
::
::  One more label is NOT here on purpose -- it's different for every
::  order, so print it per-shipment instead, right before packing
::  (either type the args yourself, using what's on the admin
::  order/spec-list page, or copy the ready-made command from that
::  order's own admin page):
::      scripts\print_contents_label.bat "<注文番号>" "<内容1>" ["<内容2>" ...]
::
::  Usage:
::      print_labels.bat
::
::  First-time / per-machine setup:
::      1. Physically plug in the QL-800 and load 62mm continuous
::         tape (DK-2205 or equivalent).
::      2. Share + attach it to WSL (run in an elevated PowerShell,
::         only needed again after a reboot or unplug/replug):
::             usbipd list                     (find the QL-800's BUSID)
::             usbipd bind --busid <BUSID>      (one-time)
::             usbipd attach --wsl --busid <BUSID>
:: ==============================================================

:: ---- 1. WSL distro name (matches `wsl -l -v`) --------------------
set "WSL_DISTRO=Ubuntu"

:: ---- 2. This repo's path, as seen from inside WSL -----------------
:: %~dp0 is this .bat's own folder (…\diy-figure-app\label-pipeline\);
:: WSL mounts the C: drive at /mnt/c, so swap backslashes for slashes
:: and lowercase the drive letter the same way WSL does.
set "WIN_DIR=%~dp0"
set "WSL_DIR=/mnt/c%WIN_DIR:~2%"
set "WSL_DIR=%WSL_DIR:\=/%"

echo.
echo === Generating label images ===
wsl -d %WSL_DISTRO% -- bash -lc "cd '%WSL_DIR%scripts' && python3 make_logo_label.py && python3 make_insert_label.py"
if errorlevel 1 (
    echo [ERROR] Failed to generate one or more label images.
    exit /b 1
)

echo.
echo === Printing (logo -^> insert) ===
wsl -d %WSL_DISTRO% -- bash -lc "cd '%WSL_DIR%output' && for f in logo_label.png insert_label.png; do echo \"--- $f ---\"; brother_ql -b pyusb --model QL-800 -p usb://0x04f9:0x209b print -l 62 \"$f\" || exit 1; done"
if errorlevel 1 (
    echo [ERROR] Printing failed -- check the printer is attached to WSL (usbipd attach --wsl --busid ^<BUSID^>) and has tape loaded.
    exit /b 1
)

echo.
echo === DONE: labels sent to the printer ===
endlocal
exit /b 0
