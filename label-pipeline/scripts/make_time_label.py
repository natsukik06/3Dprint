# -*- coding: utf-8 -*-
"""Generates a 62mm-wide label showing one elapsed-time mark (e.g. "30分") in large centered
text, for timing experiments (e.g. testing how long to wait before adding glitter to curing resin
at different points) -- stick one on each test cup so they don't get mixed up.

Usage:
    make_time_label.py <minutes> [<subtitle>]

    <minutes>   Elapsed minutes since the timer started (0, 30, 60, ...).
    <subtitle>  Optional second line, e.g. "ラメ投入" (defaults to none).

Writes to output/time_label_<minutes>.png (distinct per value, not overwritten by the next one),
so print_time_labels.bat can generate the whole batch before printing any of them.
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
    print("Usage: make_time_label.py <minutes> [<subtitle>]")
    sys.exit(1)

minutes = sys.argv[1]
subtitle = sys.argv[2] if len(sys.argv) > 2 else ""

WIDTH = 696
BORDER_MARGIN = 18
INNER_PAD = 26

f_time = font(90, bold=True)
f_subtitle = font(28)

top = BORDER_MARGIN + INNER_PAD
y = top
time_h = 100
y += time_h
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

draw.text((WIDTH / 2, top + time_h / 2), f"{minutes}分", font=f_time, fill=(20, 20, 20), anchor="mm")
if subtitle:
    draw.text(
        (WIDTH / 2, top + time_h + 10 + subtitle_h / 2),
        subtitle,
        font=f_subtitle,
        fill=(90, 90, 90),
        anchor="mm",
    )

out_path = os.path.join(OUT_DIR, f"time_label_{minutes}.png")
canvas.save(out_path)
print("saved:", out_path, canvas.size)
