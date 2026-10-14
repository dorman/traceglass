---
name: TraceGlass
description: A dark terminal lightbox where log anomalies glow and every finding explains itself. Direction B "Signal" — teal/violet accent pair with depth-aware fallbacks.
colors:
  signal-teal: "#3EE0D8"
  signal-violet: "#8B7CF6"
  surface-ink: "#1A1D27"
  ground-ink: "#0F1117"
  paper-white: "#D7DAE0"
  slate-mute: "#737A8C"
  gutter-steel: "#5A6172"
  row-wash: "#232731"
  border-dim: "#2B3040"
  ink-black: "#0F1117"
  search-violet: "#8B7CF6"
  search-current-teal: "#3EE0D8"
  logo-cobalt: "#5B84EF"
  logo-turquoise: "#3EE0D8"
  error-coral: "#E06C75"
  warn-amber: "#E5C07B"
  crit-alarm-red: "#FF5F6D"
  high-ember-orange: "#FF9F43"
  med-signal-yellow: "#F7C948"
  low-signal-blue: "#5AA9FF"
  chrome-danger: "#E06C75"
  chrome-marked: "#98C379"
  light-ground: "#F6F7FB"
  light-accent: "#0E8C86"
  light-secondary: "#5B4BD6"
  hl-coral: "#E06C75"
  hl-moss: "#98C379"
  hl-amber: "#E5C07B"
  hl-azure: "#61AFEF"
  hl-orchid: "#C678DD"
  hl-cyan: "#56B6C2"
  hl-tangerine: "#E89B54"
  hl-rose: "#EC8CB0"
  hl-lime: "#B5CE6C"
  hl-mint: "#5FC9A6"
  hl-periwinkle: "#9AA7F0"
  hl-brass: "#D0B06A"
typography:
  display:
    fontFamily: "the terminal's own monospace font — traceglass never specifies one"
    fontWeight: 700
    lineHeight: "1 cell"
  headline:
    fontFamily: "the terminal's own monospace font — traceglass never specifies one"
    fontWeight: 700
    lineHeight: "1 cell"
  title:
    fontFamily: "the terminal's own monospace font — traceglass never specifies one"
    fontWeight: 700
    lineHeight: "1 cell"
  body:
    fontFamily: "the terminal's own monospace font — traceglass never specifies one"
    fontWeight: 400
    lineHeight: "1 cell"
  label:
    fontFamily: "the terminal's own monospace font — traceglass never specifies one"
    fontWeight: 700
    lineHeight: "1 cell"
rounded:
  panel: "1 cell, plain box glyphs (┌ ┐ └ ┘)"
  none: "0"
spacing:
  tight: "1 cell"
  glyph: "2 cells"
  gap: "3 cells"
  field: "4 cells"
  modal-pad: "1 cell horizontal"
components:
  panel:
    textColor: "{colors.slate-mute}"
    rounded: "{rounded.panel}"
    padding: "{spacing.modal-pad}"
  panel-active:
    textColor: "{colors.signal-teal}"
    typography: "{typography.headline}"
    rounded: "{rounded.panel}"
    padding: "{spacing.modal-pad}"
  log-line:
    textColor: "{colors.paper-white}"
    typography: "{typography.body}"
    padding: "0"
  log-line-cursor:
    backgroundColor: "{colors.row-wash}"
    textColor: "{colors.paper-white}"
    typography: "{typography.label}"
  log-line-gutter:
    textColor: "{colors.gutter-steel}"
    typography: "{typography.body}"
    width: "4 cells minimum, widening to the digit count of the file's last line"
  highlight-span:
    backgroundColor: "{colors.hl-coral}"
    textColor: "{colors.ink-black}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
  search-match:
    backgroundColor: "{colors.search-violet}"
    textColor: "{colors.ink-black}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
  search-match-current:
    backgroundColor: "{colors.search-current-teal}"
    textColor: "{colors.ink-black}"
    typography: "{typography.label}"
    modifier: "REVERSED"
    rounded: "{rounded.none}"
  severity-badge-crit:
    backgroundColor: "{colors.crit-alarm-red}"
    textColor: "{colors.ink-black}"
    typography: "{typography.label}"
    padding: "1 cell horizontal"
    width: "6 cells (4-cell left-aligned label plus one cell each side)"
  severity-badge-high:
    backgroundColor: "{colors.high-ember-orange}"
    textColor: "{colors.ink-black}"
    typography: "{typography.label}"
    padding: "1 cell horizontal"
    width: "6 cells (4-cell left-aligned label plus one cell each side)"
  severity-badge-med:
    backgroundColor: "{colors.med-signal-yellow}"
    textColor: "{colors.ink-black}"
    typography: "{typography.label}"
    padding: "1 cell horizontal"
    width: "6 cells (4-cell left-aligned label plus one cell each side)"
  tab-active:
    backgroundColor: "{colors.signal-teal}"
    textColor: "{colors.ink-black}"
    typography: "{typography.label}"
    padding: "1 cell horizontal"
  tab-inactive:
    textColor: "{colors.slate-mute}"
    typography: "{typography.body}"
    padding: "1 cell horizontal"
  status-bar:
    backgroundColor: "{colors.surface-ink}"
    textColor: "{colors.slate-mute}"
    typography: "{typography.body}"
    height: "1 cell"
    padding: "1 cell leading"
  status-bar-mode-pill:
    backgroundColor: "{colors.signal-teal}"
    textColor: "{colors.ink-black}"
    typography: "{typography.label}"
  status-bar-message:
    backgroundColor: "{colors.surface-ink}"
    textColor: "{colors.signal-teal}"
    typography: "{typography.label}"
    height: "1 cell"
  header-bar:
    backgroundColor: "{colors.surface-ink}"
    textColor: "{colors.paper-white}"
    typography: "{typography.body}"
    height: "1 cell"
  keycap:
    textColor: "{colors.signal-teal}"
    typography: "{typography.label}"
  input-prompt:
    textColor: "{colors.paper-white}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    height: "3 cells"
    width: "60% of the terminal width"
---

# Design System: TraceGlass

## Overview

**Creative North Star: "The Radiologist's Lightbox"** (Direction B — Signal)

traceglass is a dark, evenly-lit field that you hold a log up against so its anomalies glow on their own. The ground is deliberately underexposed — Signal ink `#0F1117` with surface bars `#1A1D27` — not because dark terminals are fashionable, but because tint only carries meaning when nothing around it competes. An `INFO` line keeps neutral message text; only the level *token* is tinted. A `WARN` token warms. An `ERROR`/`ALERT` token glows. That token-only gradient is the primary reading instrument, and it works before the user has typed a single keyword. Chrome speaks in a teal/violet accent pair (`#3EE0D8` / `#8B7CF6`) with hand-mapped Ansi-16 Named fallbacks (Cyan / Magenta) — never nearest-RGB quantization.

Reading a lightbox is diagnosis, so a signal is never left to speak for itself. Every marked thing is paired with plain English: a severity finding carries a title, a category, and an explanation of what the condition *means*; an empty state names the key that gets you out of it; a footer spells out its own keycaps. The system is **legible under pressure** first — a tired reader at 2am must never have to decode a color — and **warm and explanatory** second, where warmth means the interface teaches rather than that it softens. There is no pastel here, no illustration, no reassurance. The warmth is entirely in the sentences.

Two anti-references are confirmed and binding. traceglass is **not an enterprise SIEM dashboard**: no tiles, no donuts, no KPI panels, no chrome that frames data instead of showing it. And it is **not a neon hacker terminal**: no glow, no blink, no green-on-black, no saturation deployed as personality. Both failures share a root cause — spending attention on the interface that belongs to the evidence. The log is the subject; everything else is apparatus.

**Key Characteristics:**

- A dark, even ground (`#0F1117`–`#1A1D27`) whose job is to stay boring so tint reads; light variant `#F6F7FB` via `--theme light|auto`
- Four-step level tint applied to the level *token only* (message text stays neutral)
- A five-step severity scale; Critical `#FF5F6D` remains the one out-of-family break
- Bold and reverse are the *only* text attributes — reverse also marks the *current* search match
- Every judgment is a marginal annotation (`●`/`*` severity, `◆`/`*` brand/bookmark, `▌`/`|` cursor, `██` swatch)
- Every colored background carries ink `#0F1117` text (or light ground on the light theme)
- Plain box panels (`┌ ┐ └ ┘`); only the focused pane gets the teal accent border
- ColorDepth `{ Truecolor, Ansi256, Ansi16, Mono }` with `--color` / `NO_COLOR`; hand-mapped Named tables
- No shadows, no fake depth: three tonal tiers and a hard popup punch-out

## Colors

A muted one-dark graphite ground carrying two independent color languages — a semantic severity ramp that traceglass assigns, and a 12-hue rotation that the user assigns — over near-black text on every filled surface.

### Primary

- **Signal Teal** (`#3EE0D8`, Indexed 80, Named Cyan): the primary accent. It marks focus (active panel borders and titles), the mode pill (`NORMAL`/`SEARCH`/`FILTER`), keycaps, the scrollbar thumb, the input caret, bookmark glyphs, and the current-search fill. If something is *reachable or currently yours*, it is Signal Teal.

### Secondary

- **Signal Violet** (`#8B7CF6`, Indexed 141, Named Magenta): search-match fill (non-current), secondary chrome, and the dual-accent pair with teal. Never auto-nearest on Ansi16 — Magenta is mandatory.

### Severity ramp

The severity ramp is traceglass's own voice — the one place the product asserts a judgment — and it runs `Critical → Info`, always left to right, always with its text label attached.

- **Alarm Red** (`#FF5F6D`, 203, LightRed) — `CRIT`: the loudest value and the only one that leaves the family. See The One Break Rule.
- **Ember Orange** (`#FF9F43`, 215, Red) — `HIGH`.
- **Signal Yellow** (`#F7C948`, 221, Yellow) — `MED`: the floor of the shipped signature library.
- **Signal Blue** (`#5AA9FF`, 75, Blue) — `LOW`: defined but **latent**.
- **Slate Mute** (`#737A8C`, 243, DarkGray) — `INFO`: latent for the same reason.

### Tertiary

The highlight rotation: 12 hues cycled by index as the user adds keyword and regex rules, so each term gets its own identity. This language belongs to the *user*, not the product.

- **Coral** (`#E06C75`), **Moss** (`#98C379`), **Amber** (`#E5C07B`), **Azure** (`#61AFEF`), **Orchid** (`#C678DD`), **Cyan** (`#56B6C2`), **Tangerine** (`#E89B54`), **Rose** (`#EC8CB0`), **Lime** (`#B5CE6C`), **Mint** (`#5FC9A6`), **Periwinkle** (`#9AA7F0`), **Brass** (`#D0B06A`)

Order is load-bearing and it is a contract, not a preference. Four of these twelve values are also semantic elsewhere — coral is the `ERROR` tint, amber is the `WARN` tint and `MED`, azure is the accent plus the `INFO` tint and `LOW`, and tangerine sits one shade off `HIGH` — so a highlight wearing one of them reads as the product's judgment rather than the user's bookkeeping. The four compromised hues are therefore handed out **last**, ranked by how compromised they are, leaving eight clean slots first. Those eight are also ordered for distinguishability: minimum circular hue separation between neighbours is 107°, up from 51° when coral led the list. A test enforces the clean run (`first_rotation_slots_avoid_semantic_colors`), so the rule cannot quietly rot.

The two languages still never occupy the same pixels — a tint is foreground on the log's own ground, a highlight is near-black on a filled block — but that is now the second line of defense rather than the only one. Do not add a 13th hue, and do not reorder the first nine, without checking against all four level tints and all five severity steps.

### Neutral

- **Paper White** (`#D7DAE0`): default log *message* text and any line with no detected level.
- **Slate Mute** (`#737A8C`): status-bar text, secondary prose, inactive titles, `DEBUG`/`TRACE` tint, pan-cue chevron.
- **Gutter Steel** (`#5A6172`): line numbers. Sits below Slate Mute — countable without being read.
- **Border Dim** (`#2B3040`): unfocused panel borders and the scrollbar track.
- **Row Wash** (`#232731`): the cursor row and the selected findings row.
- **Surface Ink** (`#1A1D27`): header and status bands.
- **Ground Ink** (`#0F1117`): app background fill (required so light/dark hosts never show through).
- **Ink Black** (`#0F1117`): text on every filled surface. Never a background on dark; light theme uses the light ground as fill text when needed.
- **Search Violet / Current Teal**: non-current matches fill violet; the current match fills teal and adds `REVERSED`.
- **Level tints** (token only): `ERROR`/`ALERT` **Error Coral** (`#E06C75`) · `WARN` **Warn Amber** (`#E5C07B`) · `INFO` **Info Steel** (`#7FA7CF`) · `DEBUG`/`TRACE` **Slate Mute**.
- **Logo gradient**: **Cobalt** (`#5B84EF`) to **Turquoise** (`#3EE0D8`) on truecolor only; solid teal otherwise (lerp is RGB-only).
- **Browser chrome**: `danger` / `marked` as before — punch-out overlay, exempt from rotation collision.
- **Light variant**: ground `#F6F7FB`, accent `#0E8C86`, secondary `#5B4BD6` (`--theme light|auto`).

### Named Rules

**The One Break Rule.** Exactly one color in traceglass may leave the Signal family, and it is Alarm Red `#FF5F6D` on `CRIT`. It outranks the in-family `ERROR` tint `#E06C75` by being *visibly out of place* — that dissonance is the mechanism, not an accident. A second out-of-family value would spend the same rank twice and cost this one its power. Adding one is a violation.

**The Hand-Mapped Depth Rule.** Every theme slot carries an `(Rgb, Indexed, Named)` triple. Ansi16 uses the Named column from the design table — never Euclidean nearest-RGB (which collapses teal/violet/crit onto White/BrightBlack). `--color 16|256|truecolor|never|always|auto` and `NO_COLOR` select the depth.

**The Dark-Text-On-Fill Rule.** Every filled surface — severity badge, highlight span, search match, active tab, selected row — pairs its color with Ink `#0F1117` (or the light ground on the light theme). No exceptions for "light enough" fills.

**The Two Languages Rule.** Severity color is the product's judgment; highlight color is the user's bookkeeping. They must never be blended, cross-referenced, or unified into one scale. A finding never adopts a highlight hue, and a highlight never inherits a severity.

**The Label-Always Rule.** Color never carries meaning alone. Every severity renders its text label (`CRIT` `HIGH` `MED` `LOW` `INFO`) adjacent to its color, so a monochrome terminal, a colorblind reader, or a low-fidelity palette loses no information. Any future signal must pass the same test: turn the color off, and the screen must still be readable.

## Typography

**Display Font:** the terminal's own monospace font — traceglass never specifies, requests, or ships one.
**Body Font:** the same font. There is exactly one family, and it is not ours.
**Label/Mono Font:** the same font.

**Character:** Typography here is a discipline of restraint rather than selection. With no families, no sizes, and no leading to compose, the entire hierarchy is built from four moves: **weight** (bold or not), **color** (five recessive steps), **case** (the severity labels and level tokens are the log's own uppercase, never ours), and **glyph** (a small vocabulary of box and geometric characters). The result reads as instrumentation because every row occupies exactly one cell of height and every column lands on a grid — a rhythm no proportional system can imitate.

### Hierarchy

- **Display** (bold, 6 rows tall, gradient-filled): the ANSI-Shadow banner on the welcome screen, at 60–61 cells wide, with a 34-cell fallback for narrow panes. The only typographic gesture in the product, and it appears exactly once, before any log is open.
- **Headline** (bold, accent or dim): panel titles, inlaid into the top border (` agent.log [FILTER] [/cert] `). Active panels title in Signal Blue; inactive in Slate Mute. Titles carry live state, which is why they earn bold.
- **Title** (bold when selected, `#CED3DE` otherwise): finding titles in the findings list and the detail header. Bold is the selection cue here, paired with a Row Wash background.
- **Body** (regular, `#CED3DE` or its level tint): the log line itself, and all list rows. Never bold — the log is quoted material, and the system does not editorialize inside it. Only the cursor row goes bold, and only to answer "where am I".
- **Label** (bold, near-black on fill, or accent on ground): severity badges, keycaps, tab labels, repeat counts, the `██` legend swatch. Labels are the smallest unit that carries state, so they are always bold.

### Named Rules

**The Two-Attribute Rule.** Bold and reverse are the only text attributes in this system. No italic, no underline, no strikethrough, and above all no blink. Reverse is reserved for one job (see below).

**The Dim-Is-A-Color Rule.** Recession is expressed with a dimmer *color* — Slate Mute, Gutter Steel, Panel Graphite — never with the terminal `DIM` attribute, which renders inconsistently or not at all across terminals and would silently drop the hierarchy. If something should recede, give it a color, not an attribute.

**The Reverse-For-Selected Rule.** `REVERSED` has two jobs: (1) the active severity filter tab, and (2) the *current* search match. Both need a structural "this one" cue that survives faint palettes. Do not spend reverse anywhere else.

**The Log-Is-Quoted Rule.** Never restyle the log's own text to express your own emphasis. Level tint recolors only the level token; highlights and search fill behind the message; nothing bolds, cases, truncates, or rewrites it. When horizontal pan scrolls the level token off-screen, the visible message stays neutral `text` — the tint is a property of the token, not of the whole line.

## Layout

The unit is the character cell, and the grid is absolute: every row is exactly one cell tall, and every column is one cell wide. There is no fluid spacing, no optical centering, and no fractional rhythm — only integer counts.

**Vertical structure**, top to bottom: a 1-cell branded header (always), a 1-cell borderless file-tab strip (only when more than one file is open), the body at `Min(3)`, and a 1-cell segmented status band. The status band is never bordered and never taller than one row.

**Horizontal structure**: at a usable width the log pane takes `Min(20)` cells and the highlights legend is a fixed 34-cell rail on the right — but only when `rules` is non-empty. An empty legend is hidden; "press a to add highlight" moves into the status hints. Below the width breakpoint, the rail stacks beneath the log.

**The log row** composes left to right in fixed zones: a 2-cell annotation slot (`● ` severity dot, `◆ ` bookmark, or two blanks), then the right-aligned line number at a minimum of 4 cells — widening to the digit count of the file's last line, so the `│` rule stays in one column for the entire file — then ` │ `, then an optional `‹` pan cue, then the text. Annotation accrues leftward; the text column never moves.

**Spacing rhythm**: 1 cell separates adjacent spans; 2 cells form the glyph slot; a 3-cell-dot-3-cell separator (`   ·   `) divides metadata groups inside progress and status rows; 4 cells is the minimum gutter. Status metadata joins with ` · ` and appears only when non-default — no filter means no filter segment, not an empty one.

**Overlays** are centered rects, sized by intent rather than a shared modal scale: findings 84%×84% (the working surface — it earns the most room), browser 74%×76%, input 60%×3 cells. The progress overlay, the settings panel and the help sheet are all sized to their own content in cells instead — a live counter, a setting's explanation, or a keybinding row that truncates mid-word is worse than a narrower panel. The help sheet takes the width its widest row needs, reflows into two columns when both fit (~135 cells), wraps compact descriptions below that, and caps its height at 92% of the terminal, scrolling the remainder. The findings panel subdivides its interior into a 1-cell severity bar, a 1-cell filter-tab row, a list that keeps one row when possible, and a detail box that gives up height on compact terminals so the exit action remains visible.

**Responsive behavior** is width-driven and discrete. Below roughly 65 cells of pane width the display banner swaps to its 34-cell variant. When the legend is enabled but the log cannot retain its 20-cell minimum beside the 34-cell rail, it stacks below the log; each visible rule still occupies one row, so its click rectangle remains aligned with its painted row. The legend remains a user toggle (`l`, persisted), and the stacked form does not change filtering or click-to-cycle behavior. Scrollbars appear only when content overflows, inset one cell from the panel's top and bottom so they never collide with the border arcs.

Compact overlays make the same decision from their available cells: findings preserve a selected row, source/evidence summary, and `q/Esc`/`e` actions before secondary prose; the filter row collapses to the active label plus `f/F cycle`; help wraps descriptions before measuring its scroll range; and watchlist/browser footers use two short rows when one would clip their exit or persistence keys. No overlay changes its keyboard ownership or inserts rows into a hit-tested list.

### Named Rules

**The Held-Row Rule.** A row must not move because state changed elsewhere. Findings scroll position is held in application state, not derived at render time, so the window stays still while the selection moves inside it. A directory-read error takes over the browser's footer row instead of being inserted into the list, because inserting a row would shift every entry and silently break click-to-row mapping. If new information needs a row, take an existing one.

**The Quiet-Default Rule.** Status segments, repeat counts, pan cues, and scrollbars exist only when they carry information. A repeat count is absent at `×1` and emphasized in the severity's own color at `×900`, because the difference between "this happened" and "this happened 900 times" is the whole finding.

## Elevation & Depth

A terminal has no shadows, so depth here is **strictly tonal, in three explicit tiers** — and the absence of shadow is a constraint to design within, never one to simulate.

1. **Ground** — the log field and its panels, on the terminal's own background.
2. **Wash** — Row Wash `#2E3440` on the cursor row and the selected findings row; Status Trench `#1B1F27` on the status band. These read as *nearer* because they are darker and denser than the field, not because they are lifted.
3. **Punch-out** — overlays clear the cells beneath them outright before drawing. A popup does not float above the viewer; it replaces that region of it. Nothing shows through, and nothing is dimmed behind it.

Focus is carried by border color rather than by elevation: only the focused pane gets the teal accent border; unfocused panes stay Border Dim. That is the only "raised" signal in the system.

### Named Rules

**The No-Fake-Depth Rule.** Never simulate elevation. No ASCII drop shadows, no offset duplicate borders, no half-block gradients under panels, no dimmed backdrop behind a modal. Three tiers, tonal only. If something needs to feel closer, darken beneath it or give it the accent border.

## Shapes

One container form, one corner language: a full box border in plain glyphs (`┌ ┐ └ ┘` with `─` and `│`), used by every panel — viewer, legend, findings, browser, help, input, progress. File tabs are borderless (1 row). Uniformity is the decision. Modals get `Padding::horizontal(1)` so text does not touch the border.

Titles are inlaid into the top border rather than placed below it. Centered titles are used exactly once, on the help sheet.

The geometric vocabulary is small and each glyph means one thing: `●`/`*` a scanned severity, `◆`/`*` brand mark or bookmark, `▸` the row being acted on, `██` a highlight swatch, `▌`/`|` the cursor / progress head, `▰▱`/`=-` the findings severity bar, `‹` content hidden to the left, `›` an input prompt, `█` the input caret, `✓` a marked file, `×N` a repeat count, `░` unread progress track. Ascii fallbacks are mandatory on Ansi16/Mono (and legacy conhost). Emoji appear in exactly one place — `📁`/`📄` in the file browser.

### Named Rules

**The One-Frame Rule.** Plain box borders on every panel, no other border type. No rounded arcs, no double lines, no heavy lines, no dashed dividers. Tabs stay borderless.

**The One-Glyph-One-Meaning Rule.** Each glyph in the vocabulary carries exactly one meaning system-wide. Before introducing a new glyph, prove that no existing one covers it — and prove it survives a terminal that renders it as a blank or a double-width cell (ship an ASCII fallback).

## Components

Components are **explanatory — every surface names its next move**. No panel, empty state, or footer leaves the user without a stated action, and the action is always a literal key rendered as a keycap. This is the mechanism by which the system is warm.

### Header Bar

One surface row: ` ◆ TraceGlass │ agent.log (3/7) │ lens general-triage │ ● 0 crit ● 17 high ● 14 med ` with right-aligned key hints. Severity counts keep their labels (Label-Always).

### Panels

- **Shape:** full plain border (1 cell, `┌ ┐ └ ┘`), title inlaid in the top edge, 1-cell horizontal padding on overlays.
- **Active (focused only):** Signal Teal border, bold teal title.
- **Inactive:** Border Dim, bold Slate Mute title.
- **Log title:** file name (and `/query` when searching). Lens/version live in the header, not the title.

### Log Line

The signature component. Fixed left-to-right zones: 1-cell cursor marker (`▌`/`|`) → severity/bookmark glyph → right-aligned line number → optional `‹` → text.

- **Level token:** highest-ranking token (`ERROR`/`ERR`/`FATAL`/`CRITICAL`/`ALERT` > `WARN` > `INFO` > `DEBUG`/`TRACE`) is tinted; the rest of the line stays Paper White.
- **Highlight span:** the rule's rotation color as background, Ink bold text.
- **Search match:** violet fill; **current** match = teal fill + `REVERSED`.
- **Cursor row:** Row Wash background only (no whole-row bold).

### Severity Badge

- **Style:** severity color as background, Ink Black bold label, left-aligned in a 4-cell field with one cell of padding each side (` CRIT ` / ` HIGH ` / ` MED  `). The fixed field is what keeps a mixed-severity list aligned in one column.
- **In the detail header:** the same badge, followed by the category in Signal Blue, then the bold title, then a dim span statement (`3 hits, lines 412–7781`) when the finding repeats.

### Findings List Row

- **Composition:** badge → title (bold when selected) → repeat count `×N` in the severity's own bold color, omitted at 1 → dim `file:line` location.
- **Selected:** Row Wash background plus bold title. Never a border, never an arrow.

### Evidence and Provenance

- **Source:** the `source: builtin` label is accent-bold structural metadata; catalog, version, and pattern recede in Slate Mute.
- **Evidence:** the matched excerpt is introduced by an accent `evidence` label and remains Paper White. This separates what the catalog says from the line that triggered it without borrowing a highlight hue or implying an AI verdict.
- **Compact detail:** a narrow findings panel keeps category/title, source/catalog, severity rationale, excerpt, and `q/Esc`/`e` actions in a short summary. The full explanation and false-positive note remain in the normal-width detail surface and in export output.

### Severity Bar

A one-cell-tall proportional stacked bar using `▰` (filled) / `▱` (empty), Critical to Info left to right, each segment floored at one cell. Ascii fallback on Ansi16/Mono: `=` / `-`. This is the only quantitative graphic in the product — one row, no axis, no frame.

### Severity Filter Tabs

- **Style:** ` all 12 `, ` CRIT 3 `, ` HIGH 5 `, ` MED  4 ` — each label paired with its live count, tinted with its own severity color.
- **Active:** `REVERSED` + bold (see The Reverse-For-Selected Rule).
- **Empty:** a tab with zero findings drops to Slate Mute — still selectable, but not competing with tabs that hold something.
- **Trailing:** the `f/F or ←/→` keycap, so the control explains itself in place.
- **Compact:** when the terminal cannot hold every tab, the active label and count remain visible beside `f/F cycle`; the omitted tabs are still reached with the unchanged key binding.

### File Tabs

- **Layout:** exactly 1 row, borderless. Mouse `tab_hits` align with painted cells (no bordered inset).
- **Active:** Signal Teal background, Ink bold text.
- **Inactive:** Slate Mute on ground.

### Status Bar

- **Style:** 1 cell, Surface Ink background, segmented spans — left mode pill, middle context/message, right `Ln x/y  p%`.
- **Mode pill:** `NORMAL` / `SEARCH` / `FILTER` on teal fill.
- **Default content:** expanded words (`findings`, `highlights`, `bookmarks`) — no `hl`/`fd` jargon. Search shows `n of N`. Empty-rules hint: `press a to add highlight`.
- **Message state:** transient messages occupy the middle segment; left mode pill and right position remain. Voice stays lowercase and actionable.
- **Outcome tint:** success → Moss, progress → Teal, warnings → Warn Amber, failures → Error Coral.

### Watchlist Workspace

- **Kind:** `[keyword]` uses the marked-entry green and `[regex]` uses the structural accent; both keep their literal labels and values.
- **State:** selected rows use Row Wash. Saved/unsaved, validation, reload, and save outcomes reuse the status-tone vocabulary. At compact widths the footer becomes two rows so `s`, `R`, and `q/Esc/W` remain visible.

### Input Prompt

- **Style:** 60%-wide, 3-cell rounded panel, `›` prompt in Signal Blue, Paper White text, a `█` block caret in Signal Blue.
- **Title:** states the task, the local persistence boundary, and both exits — ` Add keyword highlight to local watchlist — Enter to go, Esc to cancel `.

### Progress Overlay

- **Style:** a 5-row rounded panel sized to its own rows (never a share of the terminal), with a 44-cell content floor so the bar stays coarse enough to read a severity mix off. Row one is the work bar with a right-aligned percentage in a fixed 5-cell field, so the bar does not shift sideways as the number gains a digit; row two is a live detail row (`1247/9000 lines   ·   4 findings so far`, the count in accent); row three is a dim row naming the current file and `Esc to cancel`.
- **The work bar is the verdict assembling.** Its *length* is real progress and its *composition* is the severity mix found so far — the same Critical→Info order and one-cell floor as the findings panel's severity bar, scaled to the scanned length. A scan that has found nothing fills in Signal Blue, which is the honest reading of "running, clean so far"; the first Critical repaints the run in Alarm Red. By the time the panel opens, the reader has already watched its severity bar form.
- **The head marks the boundary.** `▌` in accent sits between what has been read and what has not, and `░` in Panel Graphite carries the remainder. At 100% both disappear rather than implying more to come.
- **Motion comes only from real work.** The head advances because lines were scanned, never on a timer. A rescan has no verdict to paint, so its bar stays a single accent — same component, one less dimension.
- **Distinctive behavior:** long work is chunked and always cancellable, and the overlay says so. Progress is never shown without an exit.

### Settings Panel

- **Style:** a rounded panel sized to its own rows, opened with `,` (the editor convention for preferences). Interior is a 1-cell pad, one row per setting, a pad, a single dim explanation row for the selected setting, a pad, and a keycapped footer (`j/k move   Enter toggle   Esc close`).
- **A row is `▸ Label      i   [ on]`.** The marker is the same `▸` the legend uses for the row being acted on, and the selected row wears the Row Wash — the same cursor treatment as the log and the findings list. `REVERSED` stays reserved for the severity filter tabs.
- **The value column belongs to the list, not to the panel.** `[ on]` / `[off]` is a fixed 5-cell field pinned to the widest *row*, so a long explanation underneath can widen the panel without stranding the values on the far side of it. On carries the accent; off recedes with a dimmer color, never an attribute.
- **The panel teaches its own shortcut.** A setting that also has a viewer key shows it in accent beside the value (`i`, `l`), so opening settings once is how a user stops needing to open it. A setting with no key shows nothing rather than inventing one.
- **Distinctive behavior:** every row dispatches to the same toggle its keybinding calls, so the panel is a second door onto one behaviour rather than a parallel implementation that can drift. Being the topmost overlay, it claims the whole click — a row toggles, anywhere else is absorbed rather than falling through to the log it covers.

### Empty States

Two cases, distinguished on purpose: a genuinely empty file says `This file has no lines.`, while a filter that excluded everything says `No lines match the current filter.` — never blaming the filter for an empty file, or the file for an aggressive filter. Both offer two keycapped exits.

### Welcome Screen

Vertically centered in the log pane: the gradient banner, the version, the line `local highlights · no AI`, then two rows of keycaps (`o` open · `a` add to watchlist · `S` scan / `?` help · `q` quit). The one place the product is allowed to be decorative — and it disappears permanently the moment a file is open.

## Do's and Don'ts

### Do:

- **Do** let the ground stay underexposed and even. Tint only carries meaning when nothing around it competes; the field's dullness is load-bearing.
- **Do** pair every color with a word. Severity labels (`CRIT`/`HIGH`/`MED`), level tokens, and counts must survive the color being turned off.
- **Do** put Ink Black `#14161B` on every filled surface — badges, highlights, search matches, active tabs, selected rows — without a per-color contrast exception.
- **Do** keep annotation in the margin. Dots, bookmarks, numbers, and cues accrue leftward of the `│`; the log's own text is quoted, never edited.
- **Do** hold the grid: one cell per row, the gutter sized to the file's last line number, the text column fixed for the whole file.
- **Do** end every surface with its next move as a literal keycap in Signal Blue with dim prose beside it.
- **Do** express recession with a dimmer color, and reserve `REVERSED` for the active severity filter tab.
- **Do** show a segment only when it carries information — no `×1`, no empty filter marker, no scrollbar on content that fits.
- **Do** make long work chunked, cancellable, and honest about its progress — and let the progress carry the finding, not just the percentage.
- **Do** tie motion to real work. The bar head moves because lines were read; nothing in this product animates on a timer.
- **Do** distinguish "nothing here" from "nothing matched" in every empty state.
- **Do** let a panel that collects existing commands dispatch to those same commands, and show the keys beside them. A second door onto one behaviour, never a second implementation of it.

### Don't:

- **Don't** add a second out-of-family color. Alarm Red `#FF5F6D` on `CRIT` is the one permitted break, and a second one costs it its rank.
- **Don't** auto-quantize colors to Ansi16 via nearest-RGB. Use the hand-mapped Named column.
- **Don't** build a dashboard. No tiles, donuts, gauges-as-decoration, KPI panels, or chart frames. Quantitative graphics stay one row tall and inline, like the severity bar.
- **Don't** reach for neon-terminal affect: no glow, no blink, no green-on-black, no saturation standing in for personality.
- **Don't** use italic, underline, strikethrough, blink, or the terminal `DIM` attribute. Bold and reverse are the whole vocabulary.
- **Don't** simulate depth — no ASCII shadows, offset borders, half-block gradients, or dimmed modal backdrops. Three tonal tiers and a hard punch-out.
- **Don't** introduce a second border style. Plain boxes on every panel; tabs stay borderless.
- **Don't** color the whole log line for level — tint the token only.
- **Don't** replace the whole status bar with a transient message — keep mode and position.
- **Don't** blend the two color languages: findings never adopt highlight hues, highlights never inherit severities.
- **Don't** let a row move because state changed elsewhere — take an existing row instead of inserting one, and never break click-to-row mapping.
- **Don't** restyle the log's own text for emphasis, or let horizontal panning change a line's tint.
- **Don't** add a 13th highlight hue, or reorder the first nine, without checking against all four level tints and all five severity steps — `first_rotation_slots_avoid_semantic_colors` will fail if you do.
- **Don't** borrow a rotation index for chrome. `danger` and `marked` exist because `palette[0]` and `palette[1]` were standing in for them, which silently coupled the browser's colors to the highlight order.
- **Don't** size a surface to a percentage of the terminal when its content has a natural width. Truncated help, or a truncated live counter, is worse than a narrower panel.
- **Don't** animate on a timer, spin a decorative glyph, or show motion that does not correspond to work actually completing. A bar that moves while nothing happens is a lie.
- **Don't** add emoji beyond the file browser's `📁`/`📄`, or a glyph whose meaning an existing one already carries.
- **Don't** let an overlay pass input through to the surface underneath it. A panel that covers the log owns every click inside its own rect, whether or not the click landed on something actionable — and it owns the keyboard for as long as it is open. Overlays are checked *before* the mode routing, never inside one mode's handler: help is reachable from the browser as well as the viewer, and while its keys lived in the viewer's handler alone, `q` on the help sheet quit the application instead of closing it.
- **Don't** compute a row's layout in two places. The width formula and the row builder must come from one function, or the longest label eventually collides with the column beside it.
- **Don't** specify a font, font size, or line height. The terminal owns those, and assuming otherwise breaks the grid.
