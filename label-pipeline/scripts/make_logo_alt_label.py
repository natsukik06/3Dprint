# -*- coding: utf-8 -*-
"""Alternative logo concept for the 62mm label: a bold circular seal (thick star/sparkle mark +
wordmark) instead of the site's detailed line-art dog-head illustration. Fine illustrated detail
doesn't survive small direct-thermal printing well -- this trades the portrait for a simpler,
bolder mark that should stay crisp at label size, while still tying into the brand's
cosmic/starry color naming (星空・ネビュラ・ギャラクシー・コメット・コズミック...)."""
import math
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "output")
os.makedirs(OUT_DIR, exist_ok=True)

FONT_DIR = "/usr/share/fonts/opentype/noto/"


def font(size, bold=False):
    path = FONT_DIR + ("NotoSansCJK-Bold.ttc" if bold else "NotoSansCJK-Regular.ttc")
    return ImageFont.truetype(path, size, index=0)


SIZE = 640
CX, CY = SIZE // 2, SIZE // 2 - 30
INK = (15, 15, 15)

canvas = Image.new("RGB", (SIZE, SIZE + 90), (255, 255, 255))
draw = ImageDraw.Draw(canvas)

# Double-ring circular seal border, matching the double-rule frame already used on the other
# labels, just circular instead of rectangular.
R = 290
draw.ellipse([CX - R, CY - R, CX + R, CY + R], outline=INK, width=6)
draw.ellipse([CX - R + 14, CY - R + 14, CX + R - 14, CY + R - 14], outline=INK, width=2)


def sparkle_point(cx, cy, outer_r, inner_r, points, rotation_deg=0):
    """A 4/6/8-point sparkle star, built as alternating outer/inner radius vertices -- much bolder
    and more print-robust at small sizes than a thin-lined illustration."""
    coords = []
    n = points * 2
    for i in range(n):
        angle = math.radians(rotation_deg + i * (360 / n))
        r = outer_r if i % 2 == 0 else inner_r
        coords.append((cx + r * math.sin(angle), cy - r * math.cos(angle)))
    return coords


# Main 6-point sparkle, big and bold in the upper-middle of the seal.
star_cy = CY - 60
draw.polygon(sparkle_point(CX, star_cy, 130, 48, 6), fill=INK)
# A couple of small accent sparkles (4-point) around it -- echoes the ✦ marks already used
# elsewhere on the site (STORY_STEPS, feature list) instead of introducing a new motif.
draw.polygon(sparkle_point(CX - 155, star_cy - 70, 26, 10, 4, rotation_deg=15), fill=INK)
draw.polygon(sparkle_point(CX + 150, star_cy + 90, 20, 8, 4, rotation_deg=-20), fill=INK)

f_word = font(46, bold=True)
f_tag = font(20)
draw.text((CX, star_cy + 175), "LUMINA CHARO", font=f_word, fill=INK, anchor="ma")
draw.text((CX, star_cy + 232), "PET KEEPSAKE ATELIER", font=f_tag, fill=(90, 90, 90), anchor="ma")

out_path = os.path.join(OUT_DIR, "logo_alt_label.png")
canvas.save(out_path)
print("saved:", out_path, canvas.size)
