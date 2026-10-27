# Sincere Bhakti design system

## Direction

A bright devotional journal with a porcelain canvas, saffron orange actions, charcoal reading text, warm peach surfaces, and spacious editorial rows. The user's October 26 revision explicitly asks for the article concept's centered heading, search, category navigation, landscape covers, while retaining the original logo and fonts.

## Palette

| Role | Color |
| --- | --- |
| Background | #FFFEFC |
| Primary / saffron orange | #B65316 |
| Primary hover | #94400D |
| Reading text | #292622 |
| Supporting text | #6A625B |
| Peach surface | #FFF3E8 |
| Decorative divider | #E5E1DA |
| Input boundary | #948B81 |

`src/app/globals.css` owns the production semantic tokens. Existing legacy color names alias these roles. Components use semantic classes rather than separate color values. The application supports the light theme; dormant shadcn dark tokens are not an active product mode. Browser theme color matches the bright canvas.

Primary text and solid button labels meet WCAG AA 4.5:1, including primary on peach. Body and supporting text are checked on all surfaces. Input boundaries and focus rings meet 3:1. Thin decorative dividers are intentionally quieter and are not used as the sole boundary of an input. Contrast checks live in `src/__tests__/design-token-contrast.test.ts`.

## Typography and identity

The original Sanskrit-capable Sincere Bhakti font remains the heading voice throughout, including article titles. Geist remains the body, navigation, search, category, byline, and metadata font. Preserve both font families. All logo placements use the original complete lotus-and-text artwork with its existing contrast filter. Do not replace it with a recreated symbol or wordmark. The header accommodates the original artwork at its intrinsic aspect ratio.

## Articles

`ArticleFeedLayout` owns the centered page heading, search, category links, guest context, and publishing tools. The production blog and development presentation share this implementation. `FeedFilterBar` retains the common search and category URL logic used by posts and articles; its editorial variant uses underlined text navigation. Posts and Blog MUST use this same editorial search layout: a centered search field capped at 38rem, identical input sizing and typography, and category navigation underneath. Apply it to both main feeds and category views on desktop and mobile; do not add page-specific search layout overrides. The Community journal feed and sidebar remain independent of this shared search pattern.

Posts and Blog MUST use `PageHeader variant="editorial"` for their title and subtitle. Use the original heading font at the same responsive scale, a centered muted Geist subtitle, identical top spacing, and the same gap before search. Omit an extra eyebrow above the title. On wide screens, keep the create action on the right without shifting the centered title; below 1024px, center the action on a separate row to avoid crowding or overlap.

The article feed is 64rem wide including gutters. `BlogCard variant="list"` uses a 38% landscape cover column, a text column, and thin horizontal dividers. Titles precede a compact plain summary, author, date, and calculated reading time. Mobile stacks the cover above the copy. Category browsing stays in the page-level navigation; detail views retain category chips. Posts uses the Community journal composition: a 72rem container, compact photo-and-text rows, full-width text-only entries, and a channel sidebar that hides on mobile. Other reading surfaces retain the shared 46rem column.

Show article imagery only when the author has selected a working cover. Coverless articles and failed cover images use a text-only row spanning the available width, with a readable excerpt measure and the same title, author, date, and divider styling. Do not substitute decorative photos or reserve an empty image column: an absent optional cover is not an error or unfinished content. The tulsi/lamp image is sample artwork in the development preview only. The generated community photograph appears only in the development preview. Stored articles, categories, and author identities are not replaced by sample content.

Signed-in readers use the shared New article header action and responsive composer. Existing draft, permission, scheduling, error, pagination, search URL, and locale behaviors remain in the production feed.

## Unified content creation — required across pages

Posts, Blog, and Gallery MUST share one creation interaction and editor shell. This applies to their main feeds, category views, channel views, and empty states. Page-specific creation patterns must not develop independently. Unify the entry point, container, field styling, publishing context, uploads, feedback, action order, and dismissal behavior; retain the fields and capabilities appropriate to each content type.

Implemented on 27 October 2026. Posts, Blog, Gallery, and channel post creation use ContentCreateAction and ContentCreationDialog. Post, article, and album editing use the same ContentComposer shell. The former inline expandable composer has been removed.

### Recommended interaction

- Put one primary Create action in a shared page-header action slot, aligned to the right of the heading on desktop. Use the same filled saffron button, plus icon, dimensions, and responsive placement across pages. Use specific translated labels: New post, New article, and New album. On narrow screens, let the action wrap below the heading when needed; do not squeeze the title or introduce a separate floating action button.
- Open the same responsive composer shell: a spacious dialog on desktop and a full-screen editor on mobile. The background feed keeps its scroll position, search, category, and selected tab. Do not expand a large form into the feed or scroll the reader to a different creation area.
- Give all content types the same expand-to-full-page option for focused work. Articles open at a wider editor size because they support long-form writing; this is a size configuration of the shared shell, not a different interaction. Expanding or collapsing must preserve the draft and editor selection.
- Keep the shell header, publishing context, and footer consistent. Use the shared DialogHeader for the title and helper text. Show Posting as with the active channel/avatar and the content language before the fields. Channel pages may preselect a channel only when the author can publish there; a category filter must not silently change publishing identity. Keep identity and language visible in every size mode.
- Keep the primary content first and secondary metadata later. Use the same labels, spacing, input boundaries, placeholder treatment, focus indicator, validation messages, and disabled states. Do not add empty fields or unsupported settings merely to make forms look identical.

| Surface | Main content | Type-specific controls |
| --- | --- | --- |
| Posts | Post text and optional media | Existing category and attachment controls |
| Blog | Article title and rich-text body | Cover, excerpt, categories, preview, and existing draft/scheduling controls |
| Gallery | Album title, description, and media | Media ordering and existing album settings |

### Shared behavior

- Use one attachment experience wherever media is supported: the same add-files/drop-zone treatment, thumbnail and video presentation, remove/retry controls, progress, and translated size/type errors. Retain the existing per-type limits. Preserve text and successfully uploaded files after a failed submission; do not force duplicate uploads or silently leave partial content published.
- Saving feedback must not move the footer, resize the editor, or change the action row height. Use the existing Saving… button state and a screen-reader live announcement; do not insert a visible status row below the buttons when a request starts.
- Keep publish actions in a persistent footer with enough bottom padding that it never covers fields, validation messages, or the mobile keyboard focus target. Use Cancel as the secondary action on the left and the submit action on the right. Its label reflects the outcome: Publish for immediate public content, Save privately for private content, or Schedule when supported and selected; editing uses Save changes. Public/private visibility is an explicit, consistently placed setting. Preserve existing visibility defaults and permission checks during migration. Show Save draft and scheduling only for types that actually support them; do not imply that all types have durable drafts or autosave.
- Use the same verification and permission states before submission. Guests get a consistent sign-in action in the creation slot; preserve the intended return location through authentication. Do not render an editable composer behind a sign-in prompt. During session refresh, use the shared authenticated-status helper to avoid a flashing or disappearing create action.
- Closing, Cancel, Escape, backdrop clicks, and full-page navigation must share an unsaved-change policy. A pristine editor closes immediately. Dirty editors require explicit confirmation with Keep editing and Discard; only an explicit discard may clear the work. During file preparation or a publish/upload request, dismissal is blocked and the shared status explains why: Discard cannot cancel work already received by the server. When draft saving exists, also offer Save draft. Never suggest a draft is saved without a successful persistence response. Preserve the editor after validation, upload, or network failures.
- Focus the first meaningful field on open; trap focus in dialog mode and restore it to the initiating button on close. Announce errors and upload/submission status. Block duplicate submissions, focus the first invalid field, honor reduced motion, and keep all actions usable with a keyboard and screen reader. A mobile upload picker or keyboard must not dismiss the editor or hide its actions.
- After a successful publish, close the composer, announce success, and update the relevant lists through their existing callbacks without resetting filters, tabs, or scroll. Insert content only where it matches the active visibility, channel, category, language, and search scope. If the new item is hidden by the current filters or is private/scheduled, provide a clear translated confirmation and an appropriate view/edit action instead of implying publication failed. Saving an article draft keeps the editor open.
- Empty-state creation actions invoke the same composer as the header. Editing reuses the same shell and field components, with appropriate edit labels and the existing permission checks. No sibling implementation should copy the shared shell, upload UI, or close/submit state machine.

### Implementation and acceptance

ContentComposer owns focus, dismissal, unsaved-change confirmation, busy state, and full-screen sizing. ContentCreateAction supplies the shared header action; ContentCreationDialog and the edit adapters wrap PostForm, BlogForm, and AlbumForm. ContentPublishingContext, AttachmentPicker, ContentVisibilityControl, and ContentFormActions provide the common form chrome. usePendingMediaUploads reuses completed uploads after a failed submission and cleans up uncommitted uploads on discard; successful saves mark referenced files committed before the editor closes. Reuse the existing Dialog, DialogHeader, DialogActions, ConfirmDialog, ChannelAvatar, ContentLanguageNotice, validation, media-upload, and form components. Keep type-specific payloads and service rules in their existing layers. Allow only documented size and capability props to vary across pages.

A creation-flow change is complete only when all three pages use the shared pattern. Verify desktop and mobile entry points, guest/signed-in/unverified states, channel permissions, text/media/long-article editing, upload failure and retry, duplicate-submit prevention, unsaved-change confirmation, focus restoration, and successful list updates under active filters. Cover the shared shell with component tests and each content type with browser tests; retain the relevant API/service tests. Keep this pattern unified whenever adding a new creation or editing entry point. Expanding uses the same mounted editor in a full-viewport dialog, preserving draft and rich-text selection without a route transition. This is not autosave: article draft actions persist explicitly, while other unsaved content remains local to the open editor.

## Shared controls and accessibility

Use the existing UI kit, translated labels, locale-aware links, shared loading/error/empty states, and visible focus. Mobile navigation remains inert while collapsed. Controls retain distinct field boundaries and 44px primary touch targets. Motion respects reduced-motion preferences.

## Previews and verification

`/design-preview` is development-only and rate-limited. It compares three warm palettes plus tulsi and indigo alternatives using the same article and homepage components. `?palette=saffron&presentation=1` shows the clean article composition with clearly illustrative sample content. Production `/blog` uses real API data. Palette overrides are removed when leaving the preview.

Reference: `/Users/elfoslav/.codex/generated_images/01a17680-e7ed-7bf1-9e7a-82cd542dac0f/exec-acb77077-cc6c-4c1c-8ed4-5df253afce52.png`.

Browser checks use Playwright with the installed Chrome channel because the Browser plugin is unavailable. Run one existing local dev server, then use `PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm exec playwright test --config playwright.ui.config.ts --workers=1` for the relevant scenarios. Local stored articles include test content, so the clean sample presentation is useful for comparing composition; real feed functionality must be checked separately.

Verification on 26 October 2026: the full suite passed 1,431 tests across 194 files. After restoring the original font families and complete logo at the user's request, all 57 affected component/contrast tests passed. Fifteen article/filter/palette browser checks passed, including original-branding assertions and 320–1470px layouts; sixteen cross-page checks passed, including authenticated management views. TypeScript passed, and lint reported no errors with only nine permitted image-element warnings. Final screenshots are stored in the task's visualization directory and use sample content only in the development presentation.

## Lotus and browser icons

`public/images/lotus.svg` is the single vector master for the small devotional ornament. `LotusIcon` uses it as a CSS mask, inheriting semantic color instead of relying on a device-specific emoji. Authentication, empty/error states, article dividers, and the footer share this component. The original complete brand logo and font families remain unchanged.

Run `node scripts/generate-brand-icons.mjs` after editing the master drawing or primary color. It derives the saffron color from the production CSS token and generates `src/app/icon.svg`, a five-resolution ICO (16, 32, 48, 64, 256px), and an opaque 180px Apple touch icon. Next.js file metadata supplies versioned icon links; do not override these with a locale-level favicon-only metadata object. The white-on-saffron favicon has heavier strokes for small sizes, while the in-app outline stays lighter.
