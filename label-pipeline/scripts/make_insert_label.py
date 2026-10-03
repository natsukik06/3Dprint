# -*- coding: utf-8 -*-
"""Generates a condensed, 62mm-wide version of the A5 packing-insert content (thank-you note +
care instructions), for printing on the Brother QL-800 instead of a full-page printer. The real A5
sheet (src/app/admin/slips/page.tsx) stays the source of truth for the actual per-order insert --
this is a smaller supplementary label (e.g. to stick on the outside of a small parcel).

Kept as plain black-on-white (not inverted) -- a white-on-black version was tried, but the direct
-thermal print head can't render small white text on a black field cleanly (heat bleed fills in
the thin white gaps between strokes), so it came out smudged/illegible in an actual test print."""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO_SRC = os.path.join(HERE, "..", "..", "public", "logo-full.png")
QR_SRC = os.path.join(HERE, "..", "..", "public", "instagram-qr.png")
OUT_DIR = os.path.join(HERE, "..", "output")
os.makedirs(OUT_DIR, exist_ok=True)

WIDTH = 696
# The glow-in-the-dark note is only included with `--glow` -- i.e. for orders that contain a
# glow color (the print server passes it per order; see print_server.mjs).
WITH_GLOW = "--glow" in sys.argv[1:]
FONT_DIR = "/usr/share/fonts/opentype/noto/"


def font(size, bold=False):
    path = FONT_DIR + ("NotoSansCJK-Bold.ttc" if bold else "NotoSansCJK-Regular.ttc")
    return ImageFont.truetype(path, size, index=0)


def wrap_and_draw(draw, text, xy, max_width, fnt, fill=(40, 40, 40), line_gap=6):
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


BORDER_MARGIN = 18
INNER_PAD = 10
MARGIN = BORDER_MARGIN + INNER_PAD + 6

canvas = Image.new("RGB", (WIDTH, 1400), (255, 255, 255))
draw = ImageDraw.Draw(canvas)
content_w = WIDTH - MARGIN * 2
y = BORDER_MARGIN + INNER_PAD + 20

logo = Image.open(LOGO_SRC).convert("RGBA")
logo_w = 260
logo_h = int(logo.height * logo_w / logo.width)
logo_resized = logo.resize((logo_w, logo_h))
logo_bg = Image.new("RGBA", logo_resized.size, (255, 255, 255, 255))
logo_bg.alpha_composite(logo_resized)
canvas.paste(logo_bg.convert("RGB"), ((WIDTH - logo_w) // 2, y))
y += logo_h + 24

f_title = font(30, bold=True)
draw.text((WIDTH / 2, y), "この度はお迎えいただき", font=f_title, fill=(20, 20, 20), anchor="ma")
y += 40
draw.text((WIDTH / 2, y), "ありがとうございます", font=f_title, fill=(20, 20, 20), anchor="ma")
y += 55

f_sub = font(20)
draw.text((WIDTH / 2, y), "世界にひとつの、あなただけのお守りです", font=f_sub, fill=(120, 100, 70), anchor="ma")
y += 50

draw.line([(MARGIN, y), (WIDTH - MARGIN, y)], fill=(221, 206, 172), width=2)
y += 30

f_h = font(22, bold=True)
f_b = font(20)

draw.text((MARGIN, y), "お取り扱いについて", font=f_h, fill=(138, 90, 52))
y += 34
y = wrap_and_draw(
    draw,
    "レジン製のため、高温・直射日光の当たる場所は避けて保管してください。落下・強い衝撃で割れる場合があります。",
    (MARGIN, y),
    content_w,
    f_b,
)
y += 20

if WITH_GLOW:
    draw.text((MARGIN, y), "暗闇で光らせるには", font=f_h, fill=(138, 90, 52))
    y += 34
    y = wrap_and_draw(
        draw,
        "蓄光素材入りの色は、明るい場所やスマホのライトを数十秒当ててから電気を消すと、やさしく発光します。",
        (MARGIN, y),
        content_w,
        f_b,
    )
    y += 10
y += 20

draw.line([(MARGIN, y), (WIDTH - MARGIN, y)], fill=(221, 206, 172), width=2)
y += 30

qr = Image.open(QR_SRC).convert("RGBA")
qr_w = 220
qr_h = int(qr.height * qr_w / qr.width)
qr_resized = qr.resize((qr_w, qr_h))
qr_bg = Image.new("RGBA", qr_resized.size, (255, 255, 255, 255))
qr_bg.alpha_composite(qr_resized)
canvas.paste(qr_bg.convert("RGB"), ((WIDTH - qr_w) // 2, y))
y += qr_h + 20

f_ig = font(20, bold=True)
draw.text((WIDTH / 2, y), "Instagramはじめました", font=f_ig, fill=(20, 20, 20), anchor="ma")
y += 30
draw.text((WIDTH / 2, y), "@lumina_charo", font=f_b, fill=(120, 100, 70), anchor="ma")
y += 40

height = y + INNER_PAD + BORDER_MARGIN + 10
final = canvas.crop((0, 0, WIDTH, height))
fdraw = ImageDraw.Draw(final)
fdraw.rectangle(
    [BORDER_MARGIN, BORDER_MARGIN, WIDTH - BORDER_MARGIN, height - BORDER_MARGIN],
    outline=(20, 20, 20),
    width=3,
)
fdraw.rectangle(
    [BORDER_MARGIN + 6, BORDER_MARGIN + 6, WIDTH - BORDER_MARGIN - 6, height - BORDER_MARGIN - 6],
    outline=(20, 20, 20),
    width=1,
)
out_path = os.path.join(OUT_DIR, "insert_label.png")
final.save(out_path)
print("saved:", out_path, final.size)
