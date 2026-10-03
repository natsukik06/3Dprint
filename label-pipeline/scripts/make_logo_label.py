# -*- coding: utf-8 -*-
"""Generates a 62mm-wide LUMINA CHARO brand-seal label: the logo inside a thin rule border with a
tagline underneath, instead of the logo printed bare -- meant to read as an intentional brand mark
rather than plain printer output, within what a monochrome label printer can actually do."""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO_SRC = os.path.join(HERE, "..", "..", "public", "logo-full.png")
OUT_DIR = os.path.join(HERE, "..", "output")
os.makedirs(OUT_DIR, exist_ok=True)

FONT_DIR = "/usr/share/fonts/opentype/noto/"


def font(size, bold=False):
    path = FONT_DIR + ("NotoSansCJK-Bold.ttc" if bold else "NotoSansCJK-Regular.ttc")
    return ImageFont.truetype(path, size, index=0)


WIDTH = 640
BORDER_MARGIN = 18
INNER_PAD = 28

im = Image.open(LOGO_SRC)
if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
    bg = Image.new("RGB", im.size, (255, 255, 255))
    im_rgba = im.convert("RGBA")
    bg.paste(im_rgba, mask=im_rgba.split()[3])
    im = bg
else:
    im = im.convert("RGB")

logo_w = WIDTH - (BORDER_MARGIN + INNER_PAD) * 2
ratio = logo_w / im.width
logo_h = int(im.height * ratio)
im = im.resize((logo_w, logo_h))

f_tagline = font(20)
tagline = "PET KEEPSAKE ATELIER"

top = BORDER_MARGIN + INNER_PAD
y = top
logo_y = y
y += logo_h + 22
tagline_y = y
y += 28 + INNER_PAD
height = y + BORDER_MARGIN

canvas = Image.new("RGB", (WIDTH, height), (255, 255, 255))
draw = ImageDraw.Draw(canvas)

# Outer thin rule + a slightly inset second hairline -- the double-rule is what reads as a
# deliberate "seal/card" border rather than a plain printed rectangle.
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

canvas.paste(im, ((WIDTH - logo_w) // 2, logo_y))
draw.text((WIDTH / 2, tagline_y), tagline, font=f_tagline, fill=(90, 90, 90), anchor="ma")

out_path = os.path.join(OUT_DIR, "logo_label.png")
canvas.save(out_path)
print("saved:", out_path, canvas.size)
