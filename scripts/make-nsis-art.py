"""Generate NSIS installer wizard graphics.

NSIS uses two specific BMPs in its modern UI:
- installerHeader.bmp (150×57)  — small header strip on each wizard page
- installerSidebar.bmp (164×314) — full-height sidebar on welcome/finish pages
- uninstallerSidebar.bmp (164×314) — same, for the uninstaller

electron-builder picks these up from desktop/build/ automatically when named
exactly like above.
"""

import os
from PIL import Image

BADGE = 'desktop/build/logo.png'  # transparent badge
OUT_DIR = 'desktop/build'

BG = (10, 10, 15, 255)        # --color-symbolic-bg
ACCENT = (124, 111, 247, 255) # --color-symbolic-accent
MUTED = (107, 114, 128, 255)  # --color-symbolic-muted

badge = Image.open(BADGE).convert('RGBA')


def fit(badge_img, max_w, max_h):
    """Resize the badge to fit within max_w x max_h preserving aspect."""
    w, h = badge_img.size
    ratio = min(max_w / w, max_h / h)
    return badge_img.resize(
        (max(1, int(w * ratio)), max(1, int(h * ratio))), Image.LANCZOS
    )


def make_header():
    """150×57 strip, badge on the left, dark background."""
    img = Image.new('RGB', (150, 57), BG[:3])
    fitted = fit(badge, 110, 40)
    x = (150 - fitted.size[0]) // 2
    y = (57 - fitted.size[1]) // 2
    img.paste(fitted.convert('RGBA'), (x, y), fitted)
    out = os.path.join(OUT_DIR, 'installerHeader.bmp')
    img.save(out, 'BMP')
    print(f'wrote {out}')


def make_sidebar(name):
    """164×314 panel: dark gradient + centered badge + faint wordmark."""
    w, h = 164, 314
    img = Image.new('RGB', (w, h), BG[:3])

    # Subtle vertical gradient from bg to a slightly lighter shade.
    top = BG[:3]
    bottom = (18, 18, 26)  # symbolic-surface
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        px_color = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = px_color

    # Center the badge in the upper half.
    fitted = fit(badge, 130, 70)
    bx = (w - fitted.size[0]) // 2
    by = 90
    img.paste(fitted.convert('RGBA'), (bx, by), fitted)

    out = os.path.join(OUT_DIR, name)
    img.save(out, 'BMP')
    print(f'wrote {out}')


make_header()
make_sidebar('installerSidebar.bmp')
make_sidebar('uninstallerSidebar.bmp')
