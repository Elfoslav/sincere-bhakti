# Heading font — "Sincere Bhakti" (patched Marcellus)

The app's heading serif is **Marcellus** ([OFL 1.1](./OFL.txt), © Astigmatic),
patched to add the Sanskrit/IAST transliteration glyphs it ships without:

```
ṅ ṁ ṛ ṇ ṣ ṭ ḍ ḥ ḷ ṃ   +   Ṅ Ṁ Ṛ Ṇ Ṣ Ṭ Ḍ Ḥ Ḷ Ṃ
```

Each glyph is **composed from Marcellus's own base letter + its own period
(dot)** — so `saṅga`, `Kṛṣṇa`, `Śrīmad-Bhāgavatam` render in one seamless
typeface instead of falling back mid-word. The family is renamed to
**Sincere Bhakti** because the OFL Reserved Font Name clause forbids reusing
"Marcellus" for a modified version. The original copyright and license are
kept intact in the font's name table.

## Regenerate

Requires `fonttools` and `brotli` (`pip install fonttools brotli`):

```bash
python3 scripts/heading-font/patch_font.py \
  scripts/heading-font/Marcellus-Regular.ttf \
  src/app/fonts/SincereBhakti-Regular.woff2
```

Then it's loaded in `src/app/layout.tsx` via `next/font/local` and exposed as
the `--font-heading-face` CSS variable (see `--font-heading` in
`src/app/globals.css`).

## Notes

- Only characters actually used are worth adding; the very rare long vocalic
  `ṝ`/`ḹ` (dot-below **and** macron) are intentionally omitted and fall back to
  the serif stack in `--font-heading`.
- To adjust dot placement, tweak `GAP_ABOVE` / `GAP_BELOW` in `patch_font.py`
  and rebuild.
- `Marcellus-Regular.ttf` here is the unmodified upstream source, kept for
  reproducibility.
