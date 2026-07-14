#!/usr/bin/env python3
"""
Patch Marcellus with the Sanskrit/IAST dotted glyphs it lacks, by composing
each precomposed character from Marcellus's own base letter + its own period
(dot). Output family is renamed to "Sincere Bhakti" per the OFL Reserved Font
Name clause. See scripts/README for regeneration.
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

SRC, OUT = sys.argv[1], sys.argv[2]
NEW_FAMILY = "Sincere Bhakti"
NEW_PS = "SincereBhakti-Regular"

# codepoint -> (base char, "above" | "below")
GLYPHS = {
    0x1E45: ("n", "above"),  # ṅ
    0x1E41: ("m", "above"),  # ṁ
    0x1E5B: ("r", "below"),  # ṛ
    0x1E47: ("n", "below"),  # ṇ
    0x1E63: ("s", "below"),  # ṣ
    0x1E6D: ("t", "below"),  # ṭ
    0x1E0D: ("d", "below"),  # ḍ
    0x1E25: ("h", "below"),  # ḥ
    0x1E37: ("l", "below"),  # ḷ
    0x1E43: ("m", "below"),  # ṃ
    0x1E44: ("N", "above"),  # Ṅ
    0x1E40: ("M", "above"),  # Ṁ
    0x1E5A: ("R", "below"),  # Ṛ
    0x1E46: ("N", "below"),  # Ṇ
    0x1E62: ("S", "below"),  # Ṣ
    0x1E6C: ("T", "below"),  # Ṭ
    0x1E0C: ("D", "below"),  # Ḍ
    0x1E24: ("H", "below"),  # Ḥ
    0x1E36: ("L", "below"),  # Ḷ
    0x1E42: ("M", "below"),  # Ṃ
}

font = TTFont(SRC)
glyf = font["glyf"]
hmtx = font["hmtx"]
cmap = font.getBestCmap()
gs = font.getGlyphSet()
upm = font["head"].unitsPerEm
GAP_ABOVE = round(0.075 * upm)
GAP_BELOW = round(0.09 * upm)

period_name = cmap[0x2E]

def bounds(gname):
    pen = BoundsPen(gs)
    gs[gname].draw(pen)
    return pen.bounds  # (xMin, yMin, xMax, yMax)

p_x0, p_y0, p_x1, p_y1 = bounds(period_name)
p_cx = (p_x0 + p_x1) / 2

new_names = []
for cp, (base, pos) in GLYPHS.items():
    if cp in cmap:
        continue  # already present, don't clobber
    base_name = cmap[ord(base)]
    bx0, by0, bx1, by1 = bounds(base_name)
    b_cx = (bx0 + bx1) / 2
    dx = b_cx - p_cx
    if pos == "above":
        dy = (by1 + GAP_ABOVE) - p_y0
    else:  # below
        dy = (0 - GAP_BELOW) - p_y1
    pen = TTGlyphPen(gs)
    gs[base_name].draw(pen)                                   # base letter
    gs[period_name].draw(TransformPen(pen, (1, 0, 0, 1, dx, dy)))  # the dot
    g = pen.glyph()
    gname = "uni%04X" % cp
    g.recalcBounds(glyf)
    glyf[gname] = g
    hmtx[gname] = (hmtx[base_name][0], g.xMin if hasattr(g, "xMin") else 0)
    for tbl in font["cmap"].tables:
        if tbl.isUnicode():
            tbl.cmap[cp] = gname
    new_names.append(gname)

# Note: assigning `glyf[name] = g` above already appends to the shared glyph
# order, so no explicit setGlyphOrder is needed here.

# Rename ONLY the font-name fields (drop the Reserved Font Name "Marcellus").
# The copyright (0), license (13) and license URL (14) MUST be preserved as-is
# — OFL requires keeping the original attribution and RFN statement intact.
name = font["name"]
for rec in list(name.names):
    if rec.nameID in (1, 4, 16): rec.string = NEW_FAMILY
    elif rec.nameID == 6: rec.string = NEW_PS
    elif rec.nameID == 3: rec.string = "SincereBhakti-1.0"

font.flavor = "woff2"
font.save(OUT)
print(f"Added {len(new_names)} glyphs -> {OUT}")
