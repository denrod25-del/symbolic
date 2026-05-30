"""Generate the desktop app icon from public/logo.png.

Removes the outer black background via flood-fill, crops to the badge,
adds a small transparent padding, then writes a multi-resolution ICO and a
high-res PNG that electron-builder picks up automatically.
"""

import os
from PIL import Image, ImageDraw

SRC = 'public/logo.png'
OUT_DIR = 'desktop/build'
ICO_PATH = os.path.join(OUT_DIR, 'icon.ico')
PNG_PATH = os.path.join(OUT_DIR, 'icon.png')
LOGO_PNG_PATH = os.path.join(OUT_DIR, 'logo.png')

os.makedirs(OUT_DIR, exist_ok=True)

img = Image.open(SRC).convert('RGBA')

# The outer black "frame" surrounds a white-bordered badge. Flood-fill from
# each corner with transparent — the white border around the badge halts the
# fill, preserving the badge's interior black half.
transparent = (0, 0, 0, 0)
w, h = img.size
for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
    ImageDraw.floodfill(img, corner, transparent, thresh=20)

# Crop tightly to the badge.
bbox = img.getbbox()
badge = img.crop(bbox)
bw, bh = badge.size

# Save a transparent PNG of the bare badge.
badge.save(LOGO_PNG_PATH)

# Square canvas with padding for the icon. ~12% padding on each side gives the
# logo room on rounded-corner OS icons.
pad_ratio = 0.12
side = int(max(bw, bh) * (1 + pad_ratio * 2))
canvas = Image.new('RGBA', (side, side), transparent)
canvas.paste(badge, ((side - bw) // 2, (side - bh) // 2), badge)

# Write a 512px PNG (used by Linux AppImage and as fallback).
icon_png = canvas.resize((512, 512), Image.LANCZOS)
icon_png.save(PNG_PATH)

# Multi-resolution ICO for Windows.
ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
canvas.save(ICO_PATH, format='ICO', sizes=ico_sizes)

print(f'wrote {LOGO_PNG_PATH}  ({bw}x{bh}, transparent badge)')
print(f'wrote {PNG_PATH}       ({icon_png.size[0]}x{icon_png.size[1]} square)')
print(f'wrote {ICO_PATH}       ({len(ico_sizes)} resolutions)')
