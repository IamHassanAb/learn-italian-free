# -*- coding: utf-8 -*-
"""Generate the app icons (run once; the results are committed in app/icons/). Needs Pillow."""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "icons")
DUSK, CREAM, SAGE, TERRA = "#2b2235", "#f6ece0", "#6a9b7e", "#d9936c"   # portfolio palette

SVG = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Italiano ogni giorno">
  <rect width="512" height="512" rx="96" fill="{DUSK}"/>
  <rect x="116" y="136" width="93" height="240" rx="10" fill="{SAGE}"/>
  <rect x="209.5" y="136" width="93" height="240" fill="{CREAM}"/>
  <rect x="303" y="136" width="93" height="240" rx="10" fill="{TERRA}"/>
</svg>
'''

def png(size, maskable=False):
    s = size
    img = Image.new("RGBA", (s, s), DUSK if maskable else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if not maskable: d.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.1875), fill=DUSK)
    scale = 0.74 if maskable else 1.0                      # maskable keeps the art inside the safe zone
    def box(x0, y0, x1, y1):
        cx = cy = s / 2; k = s / 512 * scale
        return (cx + (x0 - 256) * k, cy + (y0 - 256) * k, cx + (x1 - 256) * k, cy + (y1 - 256) * k)
    d.rounded_rectangle(box(116, 136, 209, 376), radius=int(10 * s / 512), fill=SAGE)
    d.rectangle(box(209.5, 136, 302.5, 376), fill=CREAM)
    d.rounded_rectangle(box(303, 136, 396, 376), radius=int(10 * s / 512), fill=TERRA)
    return img

os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, "icon.svg"), "w", encoding="utf-8").write(SVG)
png(192).save(os.path.join(OUT, "icon-192.png")); png(512).save(os.path.join(OUT, "icon-512.png")); png(512, True).save(os.path.join(OUT, "icon-maskable-512.png"))
print("icons written to", OUT)
