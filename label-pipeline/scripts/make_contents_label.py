# -*- coding: utf-8 -*-
"""Generates a 62mm-wide "what's inside this package" label for ONE order -- unlike the bulk
logo/sender/thank-you labels, this changes per order (same idea as make_recipient_label.py), so
it's meant to be printed once per shipment, right before packing, so the customer can check the
contents against what they ordered.

Usage:
    make_contents_label.py "<order number>" "<item line 1>" ["<item line 2>" ...]

Each "item line" is one line of order contents -- e.g. the same summary text already shown on the
admin spec-list / packing-slip pages (subject, size, color x qty, hardware, engraving), so it can
just be copy-pasted from there rather than retyped by hand.
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


def wrap_and_draw(draw, text, xy, max_width, fnt, fill=(20, 20, 20), line_gap=6):
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


if len(sys.argv) < 3:
    print("Usage: make_contents_label.py \"<order number>\" \"<item line 1>\" [...]")
    sys.exit(1)

order_number = sys.argv[1]
item_lines = sys.argv[2:]

BORDER_MARGIN = 18
INNER_PAD = 26
content_w = WIDTH - (BORDER_MARGIN + INNER_PAD) * 2

canvas = Image.new("RGB", (WIDTH, 1400), (255, 255, 255))
draw = ImageDraw.Draw(canvas)
x0 = BORDER_MARGIN + INNER_PAD
y = BORDER_MARGIN + INNER_PAD

f_label = font(20, bold=True)
f_order = font(18)
f_item = font(22)
f_count = font(18, bold=True)

draw.rectangle([BORDER_MARGIN, BORDER_MARGIN, WIDTH - BORDER_MARGIN, y + 34], fill=(20, 20, 20))
draw.text((x0, y + 3), "ご注文内容 / CONTENTS", font=f_label, fill=(255, 255, 255))
y += 34 + 20

draw.text((x0, y), f"注文番号：{order_number}", font=f_order, fill=(100, 100, 100))
y += 30
draw.line([(x0, y), (WIDTH - x0, y)], fill=(200, 200, 200), width=2)
y += 20

for i, line in enumerate(item_lines, start=1):
    y = wrap_and_draw(draw, f"{i}. {line}", (x0, y), content_w, f_item)
    y += 8

y += 12
draw.line([(x0, y), (WIDTH - x0, y)], fill=(200, 200, 200), width=2)
y += 18
draw.text((x0, y), f"内容物：計{len(item_lines)}点", font=f_count, fill=(20, 20, 20))
y += 40

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

out_path = os.path.join(OUT_DIR, "contents_label.png")
canvas.save(out_path)
print("saved:", out_path, canvas.size)
