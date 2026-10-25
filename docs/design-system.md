# Sincere Bhakti design system

## Direction and identity

A quiet devotional journal: warm ivory, deep ink, restrained brass, generous spacing, and devotional photography. Keep the original lotus-and-text logo intact; do not recreate its lettering or crop it into a new symbol. The generated concept's separate lotus/wordmark is intentionally replaced by the existing logo.

## Theme: light only, by design

Sincere Bhakti ships a single light theme. The warm ivory canvas is part of the devotional-journal identity, and the app deliberately ignores the operating system's dark-mode preference: there is no theme toggle and nothing sets the `.dark` class. Do not add a dark theme, a theme switcher, or `prefers-color-scheme` handling without an explicit product decision.

The `.dark` token overrides in `src/app/globals.css` and the `dark:` utility variants in the UI kit are dormant: they are inherited from the shadcn/ui kit and stay so the kit can be updated without edits. They are not a supported mode and need no testing, so verify new work in the light theme only. Never hardcode a color to compensate for dark rendering.

## Source of truth

- `src/app/globals.css`: semantic color values (light palette; the `.dark` overrides are dormant, see Theme), typography scales, layout measurements, motion, and compatibility aliases for existing features.
- `src/components/ui/`: the existing shared UI kit. Extend a variant before creating another implementation.
- `src/lib/design-system.ts`: token-name and spacing inventory for the gallery; deliberately contains no duplicate color values.
- `/design-system`: development-only live gallery, localized in English, Czech, and Slovak. Shows foundations, controls, disabled/invalid states, feedback, loading, dialogs, and surfaces.

## Color roles

Use `background` for ivory canvas, `card` for interactive surfaces, `foreground` for reading text, and `muted-foreground` for supporting text. `primary` is brass for actions and links; pair solid buttons with `primary-foreground`. Reserve `destructive` for destructive actions and `success` for successful feedback. `border` separates content; `input` is stronger for control boundaries. `ring` supplies visible keyboard focus.

Existing `deep`, `gold`, `saffron`, `warm`, `sand`, and `tulsi` names are compatibility aliases of the semantic palette, not a second set of hex colors. New components should use semantic roles. Semantic roles are the only way to color a component; never hardcode a hex value.

## Contrast

Contrast is measured, not eyeballed. `src/__tests__/design-token-contrast.test.ts` reads the light palette from `globals.css` and enforces: body and muted text at least 4.5:1 on every surface (background, card, popover, muted, secondary), brass links/text (`primary`) at least 5:1 on all of them, button labels on their fills, field borders and the focus ring at 3:1, and card/divider borders at 1.6:1+ so surfaces read as distinct. Current values: `primary` `#7d5a1f` (5.7:1 on ivory), `primary-hover` `#5f4317`, `muted-foreground` `#565951` (6.5:1), `border` `#c7bea9` (1.7:1).

The logo artwork's gold strokes are only ~2.4:1 on ivory, so `BrandLogo` applies a CSS `filter` (`LOGO_CONTRAST_FILTER`) that deepens them to the brand brass (~5.7:1). The mark is neither redrawn nor cropped. When changing a token, run the test; when adding a color, use a semantic role so it inherits the measured pairs.

## Typography

Preserve the local Sincere Bhakti display font, including its Sanskrit/IAST glyphs. Use it for identity and headings; use Geist for body text, navigation, metadata, and controls. Do not synthesize bold display weights.

- `type-display`: responsive 48–92px, line-height 1.08, brand hero only.
- `type-title`: responsive 36–56px, line-height 1.14, page titles.
- `type-section`: responsive 29–44px, line-height 1.2, editorial sections.
- Body: 16px, relaxed line-height. Supporting text: 14px. Compact metadata: 12px.

Use one H1 per page. Keep body text readable rather than turning posts into ornamental typography.

## Layout and spacing

Tailwind's 4px spacing scale is the base: 4, 8, 12, 16, 24, 32, 48, 64px. Use `site-container` for a 76rem outer composition and responsive gutters; `reading-container` for a 46rem reading column. `section-space` supplies responsive 48–80px section padding. Heroes are full bleed; only their content is constrained.

Editorial entries use open space and thin dividers. `Card` provides default, flat, elevated, hover, ghost, muted, and editorial variants; default surfaces have 8px corners and no decorative shadow. Use elevation sparingly. Avatars use quiet solid surfaces.

## Content lists and cards

Every feed-like list (timeline posts, blog articles, gallery albums, channel and profile content) uses the same silhouette: editorial rows separated by thin dividers (`Card variant="editorial"`, `py-7`), in a `flex flex-col` container with no `space-y-*` gaps. `PostCard`, `BlogCard variant="list"` and `AlbumCard` are the row components; `BlogCard variant="editorial"` is the cover-on-top tile for the homepage grid only. Boxed `Card`s are for singular surfaces (forms, profile/channel headers, auth, settings). `PostCardSkeleton` is an editorial row too, so loading and loaded states share one shape. Empty lists use `FeedEmptyState` (lotus/beads icon plus a short message, and a "nothing found" variant while searching).

Supporting text is `text-muted-foreground`, never `text-deep/NN` (those opacities fall below 4.5:1 contrast). Metadata and counters are at least 12px (`text-xs`); do not use `text-[10px]`/`text-[11px]`. Surfaces and meters take colors from semantic roles only (`bg-primary`, `bg-destructive`, `bg-muted`), never hex. Corners are 8px (`rounded-lg`), and headings in the display font do not use `font-bold`.

## Controls and states

`Button` owns action geometry, sizes, icons, hover, active, keyboard-focus, disabled, and aria-disabled states. Primary actions are solid brass, secondary actions outlined, tertiary actions ghost/link, and destructive actions red. No page-level button color overrides. Forms reuse `Input`, `Textarea`, `Switch`, and the established validation components. Tabs wrap at narrow widths; focus remains visible.

Navigation highlights the current section and keeps collapsed mobile content inert. Preserve authentication, locale-aware links, identity switching, and permission behavior.

## Imagery and motion

The homepage uses a standalone generated dawn photograph (`public/images/vrindavan-dawn.jpg`, approximately 232KB JPEG). It is atmospheric artwork, not documentary photography. Real community content and article covers come from the app; never insert the mockup's fictional articles or channel names. Empty article sections stay hidden.

The homepage preserves the concept's composition and natural image treatment. On small screens an ivory fade protects text contrast; this is an intentional responsive adaptation. Entrance and image-hover movement use shared timing tokens, and `prefers-reduced-motion` disables them.

## Scope and fidelity

The homepage follows the proposed image-led composition and editorial articles. The feed adopts the palette, typography, quiet composer, and divider-based posts while retaining the existing single reading column and real filtering workflow. The mockup's fictional category/channel rails are not shipped as fake product data. Existing translated descriptions and legal footer content are preserved.

## Visual review and implementation notes

Reference: the generated homepage concept at `/Users/elfoslav/.codex/generated_images/01a17170-b78a-74b2-9178-12503f3cf56e/exec-34a11a9d-8018-40b7-ab5c-5a9d2f8ebdc9.png` and feed concept at `exec-96112443-2ce2-4e7d-9387-6a3dada00c0e.png` in the same directory.

Final visual review inspects Playwright screenshots against the saved concepts. Reproducible browser checks use Playwright with the installed Chrome channel because the Browser plugin/skill is unavailable. The UI config accepts an optional `PLAYWRIGHT_CHANNEL`; its default browser selection is unchanged. The preview runs on port 3099 because another project occupies 3000. A fresh webpack dev build was used after Turbopack served stale CSS and translation modules; no framework configuration was changed for this workaround.

Run the preview with `pnpm exec next dev --webpack --hostname localhost --port 3099`, then run `PLAYWRIGHT_USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3099 PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test --config playwright.ui.config.ts e2e/design-system.spec.ts --workers=1`. Keep the same bundler and a single server for this checkout throughout verification.

Final screenshots live in `output/design/`: homepage desktop/mobile and concept-sized composition, gallery components desktop/mobile, coverless articles desktop/mobile, and the feed. Coverless regression coverage removes covers from real API responses only inside the test browser; it does not modify stored content. Local database articles include existing test content, so screenshots demonstrate layout rather than publication-ready editorial content.

Known development integration messages: Vercel Analytics' debug script is blocked by the existing CSP, Sentry reports duplicate client initialization and a deprecated client config, and webpack reports an inability to persist its dependency snapshot cache. The browser tests annotate the exact analytics CSP error while rejecting other console errors and uncaught runtime errors. Security headers are unchanged.

Continuation verification (25 October 2026): all 1,250 unit tests passed with `pnpm test --maxWorkers=1`; TypeScript passed; lint reported only the seven permitted image-element warnings. All eight design browser checks passed across the final suite (seven checks) and the targeted coverless rerun. The latter needed a longer wait for real articles to load. Browser checks run sequentially without retries. Navbar hydration, Base UI's roving tab registration, and article loading use their own readiness assertions; a CSS-hidden mobile trigger is not used as a desktop readiness signal. Development compilation/hydration remains slow and variable, so this is development-preview evidence rather than a production performance measurement.

Feed desktop/mobile captures also show no horizontal overflow or observed runtime exceptions. The first real post embeds YouTube; the external player did not paint in those captures, so third-party playback is not verified by this visual pass.

Comparison checkpoints:

| Area | Reference and implementation review |
| --- | --- |
| Identity | The original complete lotus-and-text logo replaces the mockup wordmark, per the user's direction. It is never cropped. |
| Hero composition | A full-width riverside photograph with architecture on the right and a left-aligned brand/title/actions group. Text was moved higher to avoid the dark horizon. |
| Typography | The existing Sanskrit-capable serif and Geist replace the approximate fonts in the generated mockup. Display and body scales are shared tokens. |
| Palette | Warm ivory, ink, and brass are retained; the action brass is deliberately darker for accessible text contrast. Essential foreground/background and button pairs are checked in the light theme. |
| Containers and rhythm | Open editorial entries and thin dividers replace heavy cards; shared 8px control corners and 4px spacing increments keep components consistent. |
| Copy | Brand, subtitle, navigation, and both hero actions are retained. Existing localized article headings, descriptions, and legal footer replace illustrative mockup copy. |
| Responsive behavior | The desktop composition collapses to one column. An ivory fade protects mobile hero text. Navigation collapses below 1024px; its trigger waits for hydration before accepting clicks. |
| Content | The app's real articles and channel names replace fictional examples. Empty article sections remain hidden. The feed keeps its existing reading column rather than adding static mockup rails. |

The result is an implementation of the approved visual direction with the intentional identity, content, typography, and responsive adaptations listed above; it is not a pixel-for-pixel reproduction of generated sample content.

## Cross-page consistency audit

All standard pages use the same ivory background, semantic card/popover surfaces, typography, controls, and navigation. `SiteLayout` owns the shared header, main landmark, and footer, including the root 404 fallback. Page content uses `reading-container page-space` for reading/forms, `site-container page-space` for directories, and `auth-layout` for centered authentication and recovery states. The homepage retains its wider image-led composition. `PageHeader`, `SignInPrompt`, `Heading`, `Alert`, and the existing UI primitives keep repeated page elements aligned.

The audit also connected authentication labels to fields, translated search accessibility labels, added current-page mobile navigation, made feedback colors readable in both themes, and fixed inconsistent server/client excerpt markup. Single-post pages expose a meaningful H1 without adding a duplicate visible heading. Gallery metadata wraps long names and descriptions.

Browser coverage lives in `e2e/page-design-consistency.spec.ts`: desktop (1440px) and mobile (390px) public routes, real article/post details, account and channel management pages when local review credentials exist, navigation/form interactions, shared backgrounds, overflow, and feedback contrast. Use the same preview/channel environment variables as above. Account checks sign in through the normal CSRF-protected credentials endpoint and inspect pages without saving changes. Album detail coverage requires an existing public album; when none exists locally, the browser check records that limitation and component tests cover layout and media interaction.

Recommended next UX work, in priority order:

1. ~~Add consistent search/category filtering across posts and articles so readers can find older material.~~ Done (25 October 2026): `FeedFilterBar` (search + category chips) is shared by the timeline and blog; the server `q` filter matches post text and article title/excerpt. Known limit: matching is a case-insensitive substring and does not fold diacritics (searching `krsna` will not find `Kṛṣṇa`); fixing that needs Postgres `unaccent`.
2. ~~Collapse the signed-in composer until requested, keeping the feed easier to reach on mobile.~~ Done (25 October 2026): `CollapsibleComposer` shows a quiet prompt (`aria-expanded`), expands and focuses the textarea, keeps the draft on Cancel, and collapses after a successful post. Used on the posts feed and channel pages.
3. ~~Give external media explicit loading, unavailable, and retry states.~~ Done (25 October 2026): `LoadableMedia` (`src/components/ui/loadable-media.tsx`) adds a loading skeleton, a translated unavailable message and a Retry button around gallery/album images, post and album videos, and the lightbox image. Videos with `preload="none"` show only the error state; YouTube iframes are unchanged because embed failures cannot be detected.
4. ~~Improve the custom media viewer's focus containment and translated controls; connect inline form errors to their fields with `aria-describedby`.~~ Done (25 October 2026): `MediaLightbox` moves focus into the dialog, traps Tab, restores focus to the opener, and uses translated labels (`MediaLightbox` namespace); `Input` links `errorMessage` to the field via `aria-describedby`/`aria-invalid`.

The visual direction is intentionally calm and editorial. These improvements should preserve its open spacing and avoid adding more decorative cards or competing actions.

### Generated hero asset details

Built-in Image Gen was used, with the homepage concept as a supporting image. Final production asset: `public/images/vrindavan-dawn.jpg` (1942 × 809, approximately 232 KB). The original PNG stays in the image-generation cache.

Prompt: “Extract/recreate the photographic hero scene from this website concept as a standalone production image. Panoramic wide landscape approximately 2.4:1. Beautiful realistic Vrindavan-style sandstone riverside ghats and temple architecture on the right third, tranquil Yamuna-like river foreground, pale soft ivory sky across left two thirds with calm low contrast usable for dark text. Warm natural sunrise, subtle peach light and a small sun near the left horizon, river and architecture details authentic and peaceful. Keep most architectural detail to right third; left two thirds bright and quiet for real HTML typography. Photography only, no UI, no text, no logo, no frames, no collage, no people close up, no added ornaments, no deities. Match the reference hero's scene and natural color balance closely. Output only the photograph.”
