#!/bin/bash
set -e
cd "$(dirname "$0")/../output"
for f in logo_label.png insert_label.png; do
  echo "--- $f ---"
  brother_ql -b pyusb --model QL-800 -p usb://0x04f9:0x209b print -l 62 "$f"
done
