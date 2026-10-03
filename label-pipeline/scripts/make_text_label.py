# -*- coding: utf-8 -*-
"""Generates a 62mm-wide label with arbitrary large centered text (plus an optional smaller
subtitle line) -- for one-off labels (folder tabs, box labels, etc.) that don't fit any of the
other more specific make_*_label.py scripts.

Usage:
    make_text_label.py "<text>" ["<subtitle>"]

Writes to output/text_label.png (shared filename, like make_contents_label.py -- meant to be
printed right after generating, not kept as a named batch).
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "output")
os.makedirs(OUT_DIR, exist_ok=True)

FONT_DIR = "/usr/share/fonts/opentype/noto/"


def font(size, bold=False):
    path = FONT_DIR + ("NotoSansCJK-Bold.ttc" if bold else "NotoSansCJK-Regular.ttc")
    return ImageFont.truetype(path, size, index=0)


if len(sys.argv) < 2:
    print('Usage: make_text_label.py "<text>" ["<subtitle>"]')
    sys.exit(1)

text = sys.argv[1]
subtitle = sys.argv[2] if len(sys.argv) > 2 else ""

WIDTH = 696
BORDER_MARGIN = 18
INNER_PAD = 26
content_w = WIDTH - (BORDER_MARGIN + INNER_PAD) * 2

# Shrink the main text until it fits on one line within the tape width, rather than wrapping --
# a label is meant to be read at a glance, and PIL has no built-in "auto-shrink to fit".
size = 90
f_text = font(size, bold=True)
tmp = Image.new("RGB", (1, 1))
tmp_draw = ImageDraw.Draw(tmp)
while size > 24 and tmp_draw.textlength(text, font=f_text) > content_w:
    size -= 4
    f_text = font(size, bold=True)

f_subtitle = font(28)

top = BORDER_MARGIN + INNER_PAD
y = top
text_h = size + 10
y += text_h
if subtitle:
    y += 10
    subtitle_h = 36
    y += subtitle_h
height = y + INNER_PAD + BORDER_MARGIN

canvas = Image.new("RGB", (WIDTH, height), (255, 255, 255))
draw = ImageDraw.Draw(canvas)

draw.rectangle(
    [BORDER_MARGIN, BORDER_MARGIN, WIDTH - BORDER_MARGIN, height - BORDER_MARGIN],
    outline=(20, 20, 20),
    width=3,
)
draw.rectangle(
    [BORDER_MARGIN + 6, BORDER_MARGIN + 6, WIDTH - BORDER_MARGIN - 6, height - BORDER_MARGIN - 6],
    outline=(20, 20, 20),
    width=1,
)

draw.text((WIDTH / 2, top + text_h / 2), text, font=f_text, fill=(20, 20, 20), anchor="mm")
if subtitle:
    draw.text(
        (WIDTH / 2, top + text_h + 10 + subtitle_h / 2),
        subtitle,
        font=f_subtitle,
        fill=(90, 90, 90),
        anchor="mm",
    )

out_path = os.path.join(OUT_DIR, "text_label.png")
canvas.save(out_path)
print("saved:", out_path, canvas.size)
