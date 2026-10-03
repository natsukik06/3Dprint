# -*- coding: utf-8 -*-
"""Generates a 62mm-wide return-address label. Usage:
    make_address_label.py "<postal code>" "<address, \\n for line breaks>" "<name>"
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "output")
os.makedirs(OUT_DIR, exist_ok=True)

WIDTH = 696
MARGIN = 28
FONT_DIR = "/usr/share/fonts/opentype/noto/"


def font(size, bold=False):
    path = FONT_DIR + ("NotoSansCJK-Bold.ttc" if bold else "NotoSansCJK-Regular.ttc")
    return ImageFont.truetype(path, size, index=0)


def wrap_and_draw(draw, text, xy, max_width, fnt, fill=(20, 20, 20), line_gap=8):
    x, y = xy
    line = ""
    for ch in text:
        test = line + ch
        if draw.textlength(test, font=fnt) > max_width and line:
            draw.text((x, y), line, font=fnt, fill=fill)
            y += fnt.size + line_gap
            line = ch
        else:
            line = test
    if line:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + line_gap
    return y


postal = sys.argv[1]
address = sys.argv[2]
name = sys.argv[3]

BORDER_MARGIN = 18
INNER_PAD = 26
content_w = WIDTH - (BORDER_MARGIN + INNER_PAD) * 2

canvas = Image.new("RGB", (WIDTH, 900), (255, 255, 255))
draw = ImageDraw.Draw(canvas)
x0 = BORDER_MARGIN + INNER_PAD
y = BORDER_MARGIN + INNER_PAD

f_label = font(18)
f_postal = font(28, bold=True)
f_addr = font(26)
f_name = font(32, bold=True)

draw.text((x0, y), "差出人 / FROM", font=f_label, fill=(120, 100, 70))
y += 32
draw.line([(x0, y), (WIDTH - x0, y)], fill=(200, 200, 200), width=2)
y += 24

draw.text((x0, y), f"〒{postal}", font=f_postal, fill=(20, 20, 20))
y += 44

for line in address.split("\\n"):
    y = wrap_and_draw(draw, line, (x0, y), content_w, f_addr)

y += 20
draw.line([(x0, y), (WIDTH - x0, y)], fill=(200, 200, 200), width=2)
y += 24
draw.text((x0, y), name, font=f_name, fill=(20, 20, 20))
y += 50

height = y + INNER_PAD + BORDER_MARGIN
canvas = canvas.crop((0, 0, WIDTH, height))
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

out_path = os.path.join(OUT_DIR, "address_label.png")
canvas.save(out_path)
print("saved:", out_path, canvas.size)
