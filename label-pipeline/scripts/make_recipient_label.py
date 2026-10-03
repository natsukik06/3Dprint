# -*- coding: utf-8 -*-
"""Generates a 62mm-wide recipient (お届け先) shipping label -- unlike make_address_label.py
(the shop's own return address, fixed and printable in bulk ahead of time), this one changes
per order, so it's meant to be run once per shipment with that order's real customer details.

Usage:
    make_recipient_label.py "<postal code>" "<address, \\n for line breaks>" "<name>"
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "output")
os.makedirs(OUT_DIR, exist_ok=True)

WIDTH = 696
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

f_label = font(20, bold=True)
f_postal = font(30, bold=True)
f_addr = font(28)
f_name = font(36, bold=True)
f_sama = font(28)

# "お届け先" in a filled bar (not just a hairline label) so it reads clearly different from the
# sender label at a glance, even when both are stuck on the same envelope.
draw.rectangle([BORDER_MARGIN, BORDER_MARGIN, WIDTH - BORDER_MARGIN, y + 34], fill=(20, 20, 20))
draw.text((x0, y + 3), "お届け先 / TO", font=f_label, fill=(255, 255, 255))
y += 34 + 22

draw.text((x0, y), f"〒{postal}", font=f_postal, fill=(20, 20, 20))
y += 46

for line in address.split("\\n"):
    y = wrap_and_draw(draw, line, (x0, y), content_w, f_addr)

y += 16
name_line_w = draw.textlength(name, font=f_name)
sama_x = x0 + name_line_w + 10
draw.text((x0, y), name, font=f_name, fill=(20, 20, 20))
draw.text((sama_x, y + 8), "様", font=f_sama, fill=(20, 20, 20))
y += 56

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

out_path = os.path.join(OUT_DIR, "recipient_label.png")
canvas.save(out_path)
print("saved:", out_path, canvas.size)
