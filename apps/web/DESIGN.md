---
name: APEX
description: A daily racing-line game drawn as a circuit seen from the air, timed like a broadcast timing tower.
colors:
  ink: "#ff6a13"
  ink-hot: "#ff8a45"
  purple: "#a259ff"
  green: "#29cc6a"
  yellow: "#f5c518"
  kerb: "#e5332a"
  lamp: "#ff2b1a"
  night: "#0a0b0d"
  board: "#121418"
  graphite: "#1c1f25"
  line: "#2b2f37"
  asphalt: "#262a31"
  paint: "#f2f2ee"
  steel: "#9aa1ab"
typography:
  display:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.005em"
    fontFeature: "\"tnum\" 1"
    fontVariation: "\"wdth\" 125"
  headline:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.005em"
    fontVariation: "\"wdth\" 125"
  headline-lg:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.005em"
  numeral:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 0.85
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.005em"
    fontVariation: "\"wdth\" 125"
  body:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.375
    fontVariation: "\"wdth\" 100"
  data:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "\"tnum\" 1"
    fontVariation: "\"wdth\" 100"
  segment:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
    fontVariation: "\"wdth\" 80"
  label:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "0.1em"
    fontVariation: "\"wdth\" 72"
  caption:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0"
    fontVariation: "\"wdth\" 100"
  button-secondary:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0"
    fontVariation: "\"wdth\" 100"
rounded:
  none: "0px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  row: "10px"
  panel: "12px"
  xl: "16px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.night}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "12px 40px 12px 24px"
  button-primary-disabled:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.steel}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.paint}"
    typography: "{typography.button-secondary}"
    rounded: "{rounded.none}"
    padding: "10px 16px"
  icon-button:
    backgroundColor: "{colors.board}"
    textColor: "{colors.paint}"
    rounded: "{rounded.none}"
    size: "40px"
  gate-tab:
    textColor: "{colors.paint}"
    typography: "{typography.segment}"
    rounded: "{rounded.none}"
    height: "36px"
  gate-tab-selected:
    backgroundColor: "{colors.paint}"
    textColor: "{colors.night}"
  tower-row:
    backgroundColor: "{colors.night}"
    textColor: "{colors.paint}"
    typography: "{typography.segment}"
    height: "27px"
  tower-row-active:
    backgroundColor: "{colors.paint}"
    textColor: "{colors.night}"
  tower-plate:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.steel}"
    width: "22px"
  sheet:
    backgroundColor: "{colors.night}"
    textColor: "{colors.paint}"
    rounded: "{rounded.none}"
    padding: "12px"
  dialog:
    backgroundColor: "{colors.board}"
    textColor: "{colors.paint}"
    rounded: "{rounded.none}"
    padding: "16px"
  delta-plate:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.paint}"
    typography: "{typography.data}"
    padding: "6px 12px"
  lap-tile:
    rounded: "{rounded.none}"
    height: "clamp(14px, 3.2vh, 22px)"
---

# Design System: APEX

## Overview

**Creative North Star: "The Timing Tower at Night"**

APEX reads like a race broadcast laid over a circuit seen from the air. The ground is broadcast black; the circuit underneath is drawn from real materials (grass, gravel, run-off, red-and-white kerbs, a detailed open-wheel car in the player's safety orange). Over it sit the graphics a timing feed actually uses: a left-edge tower with one row per corner group, a lap clock box, a timing card with a wide lap time and a delta plate, square hairline panels that wipe in from the side. The paddock hardware stays where it is real: the five-pod start gantry, the in-car speed in seven-segment digits, the rev lights.

The world is clean, dark and dense. Everything is square, separated by 1px hairlines rather than cards and shadows; one angled cut marks the thing to press and the tower's position plates. One type family does all the talking at three widths: wide and heavy for times and names, normal for sentences, condensed for labels. Colour is scarce on purpose: paint and steel on near-black, one orange that means "you", and the four sector-timing colours that mean "how much time you lost". The hub keeps the starting grid: painted slots on textured asphalt, today's puzzle on pole, the gantry as the day's clock.

It is an independent game. Nothing borrows a series identity: no series logos, team liveries, driver likenesses or copied broadcast graphics; circuits are named by venue only.

**Key Characteristics:**
- Broadcast-black ground, square hairline panels, the circuit underneath.
- Safety orange is the player; purple/green/yellow/red is the grade; everything else is paint and steel.
- One family (Archivo) at three widths; tabular figures on every number that moves.
- Square corners everywhere; one angled cut on primary actions and position plates.
- The corner tower is the spine of setup, race and result.
- Motion wipes and flashes like a graphics package; lamps step and black out; all of it drops under reduced motion.

## Colors

A broadcast-dark palette: four near-black neutrals in steps, painted off-white and steel for type, one orange for the player and the sector-timing quartet for feedback.

### Primary
- **Safety Orange** (ink): the player. Their racing line and car on the canvas, the primary action ("Lights out", "Improve line", "Share result"), the gate slider knob, the selected gate's name beside the corner headline, the current round on the season bar, a new personal best or a beaten rival in the timing lines, fine-mode on the slider, the focus ring and text selection.

- **Ink Hot** (ink-hot): only the revved-up hover fill of the primary button.

### Feedback (sector timing)
- **Purple Sector** (purple): a corner group within 50 ms of the perfect line; the "Perfect" delta plate on an all-purple lap; the live "to perfect" delta at or under 50 ms.
- **Green Sector** (green): within 150 ms.
- **Yellow Sector** (yellow): within 400 ms.
- **Kerb Red** (kerb): more than 400 ms off. The same red as the painted kerbs on the canvas and the kerb stripe and "INSIDE" label on the gate slider.

### Tertiary
- **Lamp Red** (lamp): lit start-lamp glass only (radial from #ffb3a8 through lamp red to #9e0f06, with a red glow). Unlit lamps are dark glass (#2a1412 to #0b0404).

### Neutral
- **Night** (night): the page, header, tower, sheets and HUD boxes (at 82–95% over the canvas); text on orange and on inverted rows.
- **Board** (board): dialogs and the resting fill of icon buttons.
- **Graphite** (graphite): the raised step: hover fill on rows and tabs, tower position plates, the delta plate, disabled primary, unlit rev LEDs.
- **Line** (line): every hairline: panel borders, row dividers, tab separators, empty lap tiles, unplayed season rounds.
- **Asphalt** (asphalt): the gate slider's track bed.
- **Paint** (paint): primary type, painted lines (grid slots, slider edges), the inverted highlight, a won season round. Dimmed with opacity (/85, /80, /75, /40) for secondary copy and grid numerals.
- **Steel** (steel): labels, units, inactive plate numerals, a lost season round (at 35%).

### Named Rules
**The You Are Orange Rule.** Safety orange marks the player and the player's next action, nothing else. If an orange element is not the player's line, car, choice, record or primary action, it is wrong.

**The Sector Colours Rule.** Purple, green, yellow and red grade time lost at a corner against the perfect line (≤50 / ≤150 / ≤400 / more ms, from `modes/grading.ts`). In the interface they speak only on the tower's grade bars and deltas, the lap tiles, the loss-coloured line and corner deltas on the canvas, the adjust cells, the legend and the purple "Perfect" plate. The lap time, timing lines and season bar stay paint, steel and orange. Kerb red is also the kerb itself, and the rev lights keep their hardware green and blue (#3d7bff); those are the circuit and the car, not grades.

**The Inversion Rule.** Selection and "where you are" is a paint plate with night text (the active tower row, the selected gate tab), never an orange fill.

## Typography

**Display Font:** Archivo Variable at 125% width, 800 (with Archivo, system-ui)
**Body Font:** Archivo Variable at 100% width, 400–700
**Label Font:** Archivo Variable at 72–85% width, 650–700

**Character:** One grotesque stretched three ways, the way a broadcast package sets times wide and heavy, copy plain, and captions tight. The widths carry the hierarchy so no second family is needed.

### Hierarchy
- **Display** (wide 800, 34px, line-height 1, tabular): the lap time on the timing card.
- **Headline** (wide 800, 18–22px, up to 30px on the hub at `lg`, line-height 0.95–1, uppercase): sheet and dialog headlines, the corner name in setup, hub slot names, "Lights out" on the race screen (26px, 0.04em). The lap clock runs 22–26px and stat values 20–24px, both tabular.
- **Title** (wide 800, 15px, uppercase): primary button labels, track picker rows; the APEX wordmark at 19px.
- **Body** (normal 400–600, 13–14px, line-height 1.375): status sentences, slot descriptions, the slider readout (13px 600, tabular), the track name in the header (14px 700).
- **Data** (normal 700, 13–15px, tabular): timing-line values, the delta plate, deltas in the adjust cells and the live delta.
- **Segment** (condensed 80–85%, 700, 12–13px): tower row names, gate tabs (uppercase, 0.04em), adjust-cell corner names.
- **Label** (condensed 72%, 650, 11px, 0.1em, uppercase, steel): tower header, timing-line keys, record-strip keys, units, slider ends, legend, the mode line in the header.
- **Secondary button** (normal 600, 14px, sentence case).
- **Caption** (`.caption`; normal 400, 13px, steel, sentence case): the header mode line, timing-line keys and "Lap time" on the result sheet, "Lap N of 6", "Corner N of M", the legend (Perfect, Within 0.15s, Within 0.4s, Slower), the picker's countries; hub captions (the countdown's "Next circuit in", circuit facts on practice tiles, the record line), gate readouts, adjust-cell meta. Captions replace uppercase micro-labels everywhere outside the in-race broadcast graphics.

### Named Rules
**The Three Widths Rule.** Width is the hierarchy: wide for display, names and times; normal for copy; condensed for labels and corner segments. Never introduce a second family.

**The Tabular Rule.** Any number that updates or sits in a column (times, deltas, counts, position plates) uses tabular figures.

**The Timing Face Rule.** Seven-segment digits survive in two places only, the hub's gantry countdown and the in-car speed, because those are hardware readouts. Every other time is set in Archivo.

## Layout

Mobile-first at 390px. The canvas fills the area under a 52px header; graphics dock to its edges. The corner tower sits top-left (8px inset), 84px wide on phones and 172px from 720px, where it gains deltas. The setup control bar, result sheet and locked note dock to the bottom edge at up to 560px wide; from 720px the result sheet becomes a 380px right rail inset 8px, and docked panels gain a full border. View controls stack top-right as a column of joined 40px icon buttons. The race HUD puts a 148–188px lap clock box top-right and a 320px onboard cluster bottom-centre. Panels report their size to the canvas so the camera frames the track around them. Safe-area insets pad the header and every bottom-docked panel (`max(12px, env(safe-area-inset-bottom))`).

The hub is a vertical starting grid: slots at 62% width (236–400px), alternating sides, pole first and deeper; from `lg` a two-column grid with the right column staggered 112px lower. The gantry spans the top; a four-cell record strip is pinned to the bottom edge.

Spacing runs on a 4px step and runs tight: 4–8px between related items, 10px row padding, 12px panel padding, 16px page gutter and dialog padding. Rows and tabs are joined edge to edge with hairline dividers rather than gaps. Everything fits the first viewport on a phone.

## Elevation & Depth

Flat. Interface surfaces are night at 82–95% opacity over the canvas with a 2–3px backdrop blur, separated by 1px line hairlines; depth between interface layers is the tonal step night → board → graphite. Shadows exist only on physical hardware: the gantry and its pods, lit lamps and rev LEDs, and the slider knob.

### Shadow Vocabulary
- **Gantry drop** (`box-shadow: 0 10px 24px rgba(0,0,0,0.5)`): the overhead truss on the hub.
- **Lamp pod** (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 14px rgba(0,0,0,0.5)`): each five-light pod.
- **Lit lamp glow** (`box-shadow: 0 0 14px 3px rgba(255,40,20,0.55)`): lit lamps only.
- **LED glow** (`box-shadow: 0 0 8px <led colour>`): lit rev LEDs only.
- **Knob** (`box-shadow: 0 2px 10px rgba(0,0,0,0.5)`): the gate slider thumb.

### Named Rules
**The Flat Graphics Rule.** Broadcast graphics do not cast shadows. A panel, sheet, dialog, button or row is separated by a hairline and a tonal step, never by a drop shadow.

**The Ghost Segment Rule.** Unlit hardware stays visible. Seven-segment digits draw their off segments at 10–20% opacity, start lamps show as dark glass, rev LEDs show as graphite. Nothing that is off is ever simply absent.

## Shapes

Square. Every panel, button, tab, tile, row, plate, dialog and gantry pod has 0 radius. Full rounds are reserved for physical round things: lamps, the slider knob, the start dot on circuit outlines and gate markers on the canvas. One angled cut is the only other silhouette: a 10px slant off the bottom-right of primary buttons, and an 8px slant off the top-left of position plates and the delta plate. Painted lines are 3px; kerbs are 7px red/paint stripes; seven-segment digits are skewed 6 degrees. Grid slots are open at the back: a 3px front line and two legs fading to transparent.

### Named Rules
**The One Cut Rule.** The angled cut appears on primary actions and on plates that carry a position or delta, and nowhere else. One slant per element, four vertices, never stacked.

## Components

### Buttons
Square, flat, one orange slab for the one action that matters.
- **Shape:** square (0), with the cut on primary.
- **Primary (the launch button):** safety orange with night text, wide 800 uppercase at 15px, 12px 40px 12px 24px padding, a drawn forward chevron 22px from the right edge. Hover revs it: an ink-hot fill climbs across in eight discrete steps (360ms, `steps(8)`), masked into segments like a rev-light bar, and the chevron kicks 5px forward. Press squats it (1px down, scale 0.975 × 0.96, brightness 112%) and kicks the chevron 9px. Disabled goes graphite with steel text. One per screen.
- **Secondary (painted line):** transparent with a 1px paint/20 border and paint/90 text, 600 sentence case at 14px. Hover brightens the text and border and draws a 2px paint line along the bottom edge from the left (280ms ease-out), a track limit being painted; press drops 1px. Disabled at 35% opacity.
- **Icon buttons:** 40px squares, board at 85%, line border, 18px Phosphor icons at bold weight (one family, one weight, via ui/icons.tsx); press scales to 0.92 on graphite. Stacked groups join by dropping the shared border.
- **Layering:** button rules live in `@layer components` so position and size utilities still override them.
- **Focus:** a 2px safety-orange outline at 2px offset, global.

### Setup bar (line styles first)
Corner name (wide 20px), "Corner N of M" caption and a small "Next" outline button (chevron; "First corner" on the last). Below, the **line row**: a joined three-way radio group (Early apex / Classic / Late apex, 40px tall, 14px 600, selected = paint fill with night text), with a one-line caption explaining the selected style, or "Your own line…" once the gates have been fine-tuned away from it. **Fine-tune** (a secondary button in the action row, remembered per device) opens the gate tabs, slider and nudges; closed by default so a lap is a handful of taps.

### Tabs (gate selector)
- **Style:** a joined strip in a line-bordered box, 36px tall, condensed 700 uppercase 12px; tabs share width when there are five or fewer, otherwise scroll.
- **State:** selected is the inverted paint plate; rest is paint/80, hover graphite.

### Containers
- **Sheets** (setup bar, result, locked note): night at 94–95% with a 3px blur, top hairline on phones and full hairline from 720px, 12px padding. They enter with `wipe-in` (360ms, `cubic-bezier(0.16, 1, 0.3, 1)`, revealed left to right).
- **Dialogs** (track picker, today's result): solid board with a line border, 16px padding, over a night/75 scrim; also `wipe-in`.
- **HUD boxes** (lap clock, onboard cluster): night at 88–90% with a line border and a label header row.

### Inputs / Fields
- **Gate slider:** a 48px cross-section of the track in asphalt with a line border, 3px paint edges, a 10px kerb stripe on the inside edge, metre ticks, and a 28px orange knob ringed in 3px paint. Tap jumps, drag moves at reduced gain, pulling away from the bar enters fine mode (labelled in orange). Readout above in 13px 600 tabular; LEFT/RIGHT/INSIDE below as labels, INSIDE in kerb red. 40px nudge buttons flank it.

### Navigation
- **Header:** night, 52px, line bottom border, joined cells split by hairlines: a 48px back chevron cell, the APEX wordmark (wide 19px), a mode label over the track name, and the colour-blind toggle cell on the right. The game has no sound.

### Corner Tower (signature)
The broadcast timing tower turned to corners. A night/82 column with a blur, a label header ("Lap 2/6"), and one 27px row per corner group split by line/70 hairlines. Each row: an angled 22px graphite position plate (steel numeral), the corner name in condensed 700, the delta in its sector colour on wide screens, and a 4px grade bar on the right edge, the only colour on the tower. The active row inverts to paint with night text and a night plate. It is the same strip in all three phases: in setup a row jumps to that corner; in the race rows fill as the car clears them, each with `row-flash` (700ms paint/28 fading out); in the result a row opens that corner to fix.

### Timing Card (signature)
The head of the result sheet: a "Lap time" label over the wide 34px lap time, an angled delta plate beside it (graphite with paint text, or purple "Perfect" on an all-purple lap), then timing lines, each a hairline row with a label key left and a tabular 15px 700 value right (orange for a new personal best or a beaten rival).

### Lap Grid
One row per lap, one square tile per corner group. Empty tiles are line-bordered on night/30; the live row is paint/35 on paint/5; graded tiles fill with their sector colour and flip in (`tile-flip`, 240ms) as the car leaves each group. 10px tiles on the hub, 14–22px elsewhere.

### Season Bar
Twelve 6px segments: won rounds paint, lost rounds steel/35, the current round orange, unplayed rounds line. No sector colours.

### Start-Light Gantry (signature hardware)
Five square black pods (#060607, line border), two lamps each at 16/24/36px. On the hub it is the day's clock, one pod per fifth of the day, with a seven-segment countdown beneath; it hangs from a hatched truss. On the race screen lamps step on one at a time, hold, and black out instantly, then "Lights out" shows for 900ms. No easing on lights.

### Sectors, real pole, speed trace, perfect-lap reveal, colour-blind mode
- **Sectors:** three cells under the lap clock (a 3px bar that fills from the left as the line is crossed, "S1" in 11px condensed, the time from 720px); the result sheet repeats them larger with times to the thousandth and a swatch legend (Perfect sector / Your best / Slower). F1 rules: purple = within 0.05 s of the perfect lap's sector, green = personal best on this circuit, yellow = slower.
- **Real 2025 pole:** a timing line on every result ("Real 2025 pole 1:09.511", gap in ink when beaten); on the hub, a caption row under the medal ladder only where the pole can be beaten before perfection ("Beat the real 2025 pole" / "Faster than the real 2025 pole by 0.211s"). Times only, never names.
- **Speed trace:** after the lap grid on the result sheet: speed (km/h, 50-step gridlines) against distance, perfect lap in a 1.1px purple line, yours in 1.4px orange, the slower gap shaded red at 22%, corner numbers along the bottom (crowded labels left as ticks), a touch/hover cursor with "T7 263 / 264 km/h".
- **Watch the perfect lap:** only once the daily is locked; a demo run with "Perfect lap" in purple in the HUD and all splits purple, then the perfect line stays drawn under yours.
- **Colour-blind colours:** a header toggle (palette icon, ink when on) swaps the four timing colours for an Okabe-Ito set (blue, bluish green, yellow, reddish purple) in both the CSS tokens and the canvas; copy never names a colour ("Every corner perfect").

### Lights out (reaction test, `/reaction`)
A full-height stage that is itself the button (tap anywhere or Space/Enter): title "Lights out" in wide display, one plain sentence with the reference points (F1 drivers about 0.2 s, most people about 0.27 s), the large gantry, the reaction on a 64–80px seven-segment readout ("0.000" ghosted while waiting, white when timed, "-.---" in lamp red for a jump start), a one-line verdict, and Best / Last 5 average / Jump starts. After a timed start: Share (secondary) and "Now find the perfect lap" (primary) into the daily. The hub links to it from a compact band above the record line.

### Result map views and record
- **Map switch** (result sheet, only when there is something to compare): a joined radio row Corners / Previous best / Challenge (32px, paint fill when selected). Corners = grades against the perfect lap; the duel views split the lap into 25 equal mini-sectors and colour each by the quicker lap (orange = you, steel = your previous best, paint = the challenger, neutral grey within 5 ms), the track-dominance idiom, with a swatch key underneath.
- **Your record** (hub footer link): Played / Medals / Streak / Best streak, how your days ended as medal-coloured bars with no tracks behind them, best lap and medal per circuit, best start.
- **Race week** banner (board strip above the hub, ink lead-in) Monday to Sunday of a real Grand Prix weekend at one of our circuits; that Saturday's daily is the race-weekend circuit ("race-weekend special").

### Challenge links
A `?vs=` link opens Free Practice on the challenger's circuit. The setup bar shows "Challenge: beat 1:08.515" (13px paint, time tabular bold); the HUD's pace target becomes "To Challenge" with a paint-coloured ring; the result sheet adds a "Challenge 1:08.515" timing line (ink when beaten) and the headline "Challenge beaten". A practice result offers a secondary "Challenge" share button beside Improve line.

### Corner coach (result sheet)
The three worst corners as rows under the lap grid (top hairline, a hairline under each): corner name in 14px condensed bold with its gap in the grade colour beneath (56px column), the coach's reason in 13px steel, a chevron that nudges right on hover (the row jumps to that corner), and an outline "Hint" button. A revealed hint replaces the reason in paint ("Apex T5: move 6.4 m right"). In the daily, hints open after lap 2 ("Hints open after lap 2." caption until then) and the count goes on the share text; elsewhere they are free. Reasons come from where the time was lost (way in / apex / exit) and are phrased as a driver would hear them: "Braking 75 m early for T4", "Braking 50 m earlier than the perfect lap", "33 km/h slower at the apex", "18 km/h slower on average out of the corner".

### Race: pace marker, ghost and splits
- **Pace target:** the lap clock's second line reads "To Bronze/Silver/Gold/Perfect": the next medal above your personal best (Perfect once Gold is yours). Delta in tabular 14px bold, green when ahead, paint when behind.
- **Pace marker:** a ring (7 px radius, 2.5 px stroke) in the target medal's colour with a night/55 fill, riding *your own* line where a car at the target pace would be, so it never reveals the perfect line. Your personal-best ghost (pale livery at low alpha) runs in every mode.
- **Splits:** as each corner group is cleared, a split plate slides in under the lap clock (same width; a 4px sector-colour bar, group name in 13px condensed bold, gap in tabular 14px in the sector colour) for 1.6s. A purple split gives a 35 ms haptic tick on phones; lights out gives 20 ms.

### The car (canvas, game/car.ts)
A generic modern open-wheeler seen from above, drawn 1.2x life size (never under 44 CSS px long) so it reads at chase-cam distance. The body is pre-rendered as a mip chain (20, 40, 80, 150 px per metre) and each frame uses the smallest sprite that covers the screen, so it stays sharp at every zoom instead of shimmering as one big bitmap shrinks and rotates. Body in cylindrical shading (dark flanks, lit crown) with a darker undercut where the sidepods fall away; carbon floor with a lit edge and diffuser strakes; wishbones; sidepod inlets; a white chevron on each sidepod and a stripe down the nose; a lit engine-cover spine; cockpit with helmet, visor, halo (lit edge) and mirrors; three-element front wing and a rear wing with a lit flap edge, endplates in body colour. Tyres show a lit tread crown and a sliver of yellow sidewall. Live per frame: the front wheels steer by the path's curvature (doubled so the angle reads from above), the front discs glow orange under heavy braking (eased in and out like a disc heating and cooling), and two shadows sit under the car: a tight, dark contact shadow and a soft one offset south-east that slides toward the outside of a corner with lateral load. Player in ink orange, the personal-best ghost in pale silver at 55%. No numbers, sponsors or team marks.
Realism layer: bare carbon is a 2x2 twill weave (2 cm tow); the body carries a clear coat (the sky mirrored along the crown, a soft sun hot spot on the north-west sidepod), panel seams and sidepod louvres; the rear wing has its DRS pod. Tyres are rolling cylinders (dark fore and aft, shaded shoulders), slicks show faint scrub streaks and a yellow band; on wet days the car runs full wets (chevron grooves, blue band) and the rain light under the rear wing flashes at 2 Hz.

### The world (canvas, game/materials.ts, trees.ts, boats.ts)
Satellite realism, not flat map fills. Every surface is a procedural, tileable material sized in world metres: grass (fbm greens, straw patches, blades), asphalt (stains, grain, aggregate chips), gravel (shaded pebbles), concrete paving (slabs and joints), water (two crossing wave trains with glints), clay and slate roof courses, roof membranes. A low-frequency luminance layer (soft-light) breaks tile repeats over the whole map, and cloud shadows drift across everything, cars included, at 2.2 m/s (none on wet days: overcast has no cloud edges). Materials are generated once per page and memoised, so a retry or a new circuit starts instantly; they stay on up to 5 m per pixel (the setup and result overviews), only fine props drop out below 0.9 m per pixel. Trees are sprites by regional flora (broadleaf, conifer, palm; Spa and the Red Bull Ring conifer, Monaco and Barcelona Mediterranean, Interlagos tropical), each with its own silhouette shadow cast south-east; forests are a stamped canopy tile with a ragged edge and a band of treeline shade on the fields. Monaco's harbour holds sprite yachts (motor, sail, larger yacht: teak decks, tinted glass, flybridges) with soft shadows on the water. Kerbs are grimed with rubber and bevelled (lit north-west edge, shaded south-east). Wet days darken every material, lay a sky-reflecting water film on the track, scatter puddles near the edges, glaze the kerbs, and cut every shadow to a third.
Motion and light: the dry racing line carries a band of laid rubber (darker, and glossy in the wet); dry sessions get a sun grade fixed to the world (a warm lift on the north-west side of the frame, a cool tone on the far side); tree crowns sway a few centimetres in travelling gusts against their fixed shadows (stronger in the wet, off for reduced motion); rooftop plant units have lit and shaded edges and fan grilles. In the race the car leaves up to four motion-blur echoes along the path it drove during the frame (playback runs at 4x, so it covers metres per frame), off for reduced motion. Buildings and trees are grouped in 250 m blocks and only blocks on screen are drawn, shadows for all of them first, so the extra detail costs no frame time.

### Chase camera
Heading-up and following a heading smoothed over neighbouring samples, so the car turns rather than stepping between segment angles. The camera eases with frame-rate-independent exponential smoothing (position 4/s, rotation 2.6/s, zoom 1.6/s), sits at 84 px per track width in slow corners and 58 at top speed (scaled up on large screens), and above 260 km/h rumbles with layered low-frequency sines instead of per-frame random jolts. A soft vignette (night at 42% at the corners, cached per canvas size) frames race and result views; setup stays unvignetted so the edges of the map stay legible.

### Onboard Cluster
A row of square rev LEDs (green building, the last three blue, all blue on the shift flash; unlit graphite), a wide 40px gear numeral, and the speed in seven-segment digits with ghost segments, units as labels.

### Ad slots
Side rails (176px from 1280px, 316px from 1536px) are their own grid columns beside `main`, night background with a hairline toward the content, the slot centred vertically under a small "Advertisement" caption (11px steel/70). Below 1280px, one 300×250 slot sits in the hub between Perfect Season and Free Practice. No ad is ever placed next to game controls (setup bar, race HUD, result sheet). Without an AdSense client, production lays out no ad space; development and `?ads=preview` show dashed placeholders. See docs/ADS.md.

### Circuit surroundings (canvas)
Each circuit sits in a thin band of its real surroundings from OpenStreetMap (buildings within 90 m of the track edge, grandstands and pit buildings within 160 m, trees within 60 m, roads only where they meet the circuit; tools/track-builder/src/trim-scenery.ts), drawn flat from above under the run-off: farmland, parks, urban ground, parking, scrub, sand (textured), woods (a tree-top canopy texture), water and the sea (textured, lighter shoreline), rivers, piers, roads (kerb edge + surface, width by class), rail, other raceway (old layouts in asphalt, the pit lane with white edge lines), buildings drawn as a satellite photo shows them (game/buildings.ts): houses with hip roofs from a ridge skeleton, each face shaded by its angle to a north-west sun, ridge, hip and eave lines (roof colours by region: terracotta at Monaco, Monza, Imola, Barcelona and Interlagos, slate greys elsewhere); flat roofs with a parapet, plant units with their own shadows and skylights on big sheds; grandstands with seat rows along the stand, aisles and a ribbed white canopy on the side away from the track; pit buildings (named, or found by shape near the start line) with a row of garage doors facing the track; shadows south-east by height in two soft passes; trees as pre-rendered crown sprites; woodland as irregular leaf-cluster crowns with shadowed gaps. Track detail (game/scenery.ts buildDetail), never following the racing line so it can't give the puzzle away: paving seams, darker resurfaced patches and black sealant lines in braking zones, lock-up tyre pairs spread across the width before slow corners, faint run-wide arcs on exit run-off, green astroturf behind exit kerbs, a raked darker rim on gravel traps, kerbs with a thin south-east shadow, 300/200/100 m brake boards (white, 3/2/1 black bars) on the outside before slow corners with long enough straights, grid positions painted behind each box, and the start-light gantry (truss beam on two pylons, five pods, an 8 m shadow) just past the line. Barriers: guardrail with a lit edge and posts every 2.5 m, street walls as concrete with joints every 5 m, TecPro blocks with gaps and a lit top. Monaco moors yachts stern-to along its quays. Landmarks are drawn standing: Suzuka's big wheel, Austin's observation tower with its red strands, Spielberg's bronze bull. Race-day dressing on top: TecPro blocks (red/blue) in front of the rail behind gravel traps and at slow street corners, a catch-fence line with posts, and a white marshal cabin with a yellow flag behind every slow corner. "Map data © OpenStreetMap contributors" shows top-centre during setup, linked to the licence.

### Medals
Four tiers, one disc shape: a 20-unit circle with a night/28 inner ring when earned, an empty 1.5-unit ring at 45% when not. Colours are the only place metal tones appear: bronze #c8834f, silver #c3c8d0, gold #e2b13c; Pole uses sector purple. The hub's **medal ladder** is four columns under the lap grid (2px top rule in the medal colour once earned, line colour before; name in 13px 600; target time in tabular 13px, "All purple" for Pole). The result sheet's **medal row** sits first under the lap time: the earned disc at 22px and name in wide 15px, right-aligned caption "Gold at 1:08.460, 0.055s to find". A medal earned on a new personal best is stamped in (scale 2.2 → 0.9 → 1 with a slight rotation, 520ms from 900ms).

### Loading
While a circuit loads, its outline (paint-free steel stroke) draws and undraws in a loop above "Loading <venue>"; on failure the line says what failed and to go back to the grid.

### Mystery circuit (/mystery)
Asymmetric split from lg (5fr clue / 6fr board). The clue: one ink stroke on board/70, revealing 18, 32, 46, 60, 75, 90% of the lap from a per-day offset (stroke-dasharray transition, 900ms ease-out); when the day ends the full outline turns green (solved) or paint (missed) over asphalt with the orange start dot, and the venue is named. The board: a 6-row table (circuit, country, km, corners, first GP), cells 44px tall, green for exact, yellow for close (same continent, 0.5 km, 2 corners, 10 years), graphite otherwise, with Phosphor arrows pointing at the answer; each new row's cells flip down left to right (90ms apart). Guesses come from twelve name chips (two or three columns), struck through once used; no free text, so there is nothing to misspell.

### Corner of the week (/corner)
One famous corner a week (Monday to Sunday), unlimited tries, a medal for the week. Only corners whose place in the lap is certain are used (the first after the start, the last before the line), named the way fans know them and never after a driver or sponsor (src/modes/corner.ts). The rest of the lap sits on the perfect line, so the run-in speed is the same for everyone; the corner itself starts from the centre of the track. The run skips the start lights and plays only from about 2.5 s before the corner to just past it. The score is the time lost to the perfect line in that corner: Pole within 0.05 s, Gold 0.09, Silver 0.16, Bronze 0.40. Setup hides the corner tower, the Next button and the first-run tips, and titles the bar with the corner's name. The result panel: caption "Corner of the week #N", the corner in wide 22px with the medal at right, the gap as the headline (wide 40px, in the colour of its sector grade), the medal ladder, the week's best and days left, then Try again, Share and Grid. Hub band between the hero and Perfect Season: the circuit on the left with the corner lit in ink (a slow 1.8 s breathe), the brief on the right (ink caption with the week number and days left, the corner in the wide display, the circuit, one sentence on what makes it hard), a secondary "Take the corner" button and the week's best.

### Conditions (wet, low downforce)
Each circuit moves to the next condition every 12-day cycle (dry, wet, low downforce; four days of each per cycle; race-weekend Saturdays stay dry), so a line remembered from its last visit no longer holds. The physics is real: the wet car has about 28% less tyre grip, the low-downforce car less downforce and less drag (quicker at Monza, slower on twisty circuits); each condition has its own perfect line and medal times, computed offline (tools/track-builder/src/build-conditions.ts, build-outlines.ts). The real 2025 pole is only shown in the dry. On the hub a line under the facts names the condition with a Phosphor icon in a hairline square (CloudRain, Wind) and says what changes; the race header, the archive tiles, the share text and the share card name it too. On the canvas a wet day is a shade darker and cooler (night-blue at 24% over the scenery), rain falls across the lens in short slanted streaks during the race, the rear tyres throw a soft white plume of spray (seeded along the whole distance covered each frame, so it stays continuous at 4x playback), and there are no floor sparks. Free practice can be driven in any condition (a three-way switch in the circuit picker, `&cond=` in the address).

### First-run coaching (setup bar)
Three tips over the first line, shown once (stored on the device): a strip at the top of the setup bar with a 2px ink left rule on ink/10, three 12×4px progress pips, one plain sentence and a "Skip" link. The control each tip is about wears a slow ink ring (outline pulsing 2 to 5 px): the style picker, then Next, then Lights out. Tips advance on what happens in the game, so keys work as well as taps; the first race (or Skip) ends them.

### Archive (/archive)
Every past Daily Quali, newest first, as tiles (two columns from md, three from lg): the circuit outline, "No. N" and the date as a caption, the venue in wide 20px, then the day's result ("On the day": medal disc, medal, best lap) and any replay's, and the action in ink ("Play", "Replay", "Continue, 4 laps left"). A replay plays exactly like the daily (six laps, medals, the perfect lap after) but is stored apart and never counts for the streak or the record; the header reads "Archive, quali No. N" and the share text says "(archive)". Before any day has passed, one line says the archive starts at midnight. Entry points: "Play past days" becomes the hero's primary action once today's daily is finished, and "Past dailies" sits in the footer.

### Pit stop (/pit-stop)
Split from lg: timing on the left (5fr), the pit box on the right (6fr); on phones the box comes straight after the title, with a small clock riding in its corner. The box is drawn from above on the circuits' own asphalt: garage apron on the left, a yellow box with a white stop line and wheel marks, the fast lane dashed on the right, and a two-lamp release light (red, then green with a glow). The car is the race car's own sprite without wheels; the tyres are DOM elements so they can move: every wheel always carries a tyre: the worn one (grained) until its wheel is done, then the fresh one (lit crown, a yellow sidewall band) seats from the outside in 180 ms. Beside each wheel lies the spare: a fresh tyre waiting, which becomes the worn one set down at an angle and left on the ground when the car leaves. Each wheel has its crew member (dark shoulders, an ink helmet that greys once their wheel is done). The car rolls in decelerating (950 ms ease-out), leaves accelerating (650 ms ease-in). The active wheel pulses an ink outline and its crew member shows a key cap (paint on night, pressed-key bottom edge); on phones the cap says "Tap". A wrong key flashes that wheel kerb red and shakes the box. Timing column: a segment clock, a penalty note in kerb, then a timing tower with one row per wheel in the order they lit (a wheel's name appears only when it lights, so the daily order isn't given away) and the release, each graded purple/green/yellow/red like a sector; then the verdict, Share, Go again, and best, last-five average and stop count. Daily and Practice sit in a two-option switch; one daily attempt counts. A haptic tick on phones.

### Higher or lower (/higher-lower)
Two equal circuit cards (outline, venue, country, the stat label, the value in wide type). The right card's value is a steel "?" until called, then rolls in and the card's border turns green or kerb red. A right call deals the next pair after 1.3s (cards slide in from the right, 80ms apart), the revealed circuit taking the left seat. Two full-width secondary buttons carry the stat's own words (Longer/Shorter, More/Fewer, Later/Earlier, Slower/Quicker). Streak rolls top right beside the best.

### Today bar
A 52px strip above the hub on board/60, the session status of a timing screen: "Today" with one 20×6px pip per daily (ink when done, asphalt before), then one entry per daily (Daily Quali, Mystery circuit, Pit stop; "Quali" and "Mystery" on phones, where the state line hides and the glyph carries it) with a 24px status glyph (the medal disc once a medal is won, a Phosphor chequered flag once finished without one, a hollow square before) over its state in 12px ("4 laps left", "Solved in 3", "Not started"), and the medal streak at the right as a wide 18px figure over "day streak". Entries are buttons (graphite on hover) that open the game or today's result. Hairline separators between entries; no cards.

### Share card
The Daily Quali result as a 1080×1350 PNG (src/ui/shareCard.ts), drawn on canvas from the live tokens (so colour-blind mode carries over): wordmark and puzzle number over a hairline, the venue in the wide display at up to 104px, the facts line, then the circuit fitted to its own bounds and painted like the hub map (asphalt ribbon, corner groups in the day's best colours, ink start dot), then a hairline, the medal disc and verdict, the best lap in the wide display at 120px, the lap count, the lap grid on the right, and "Find the perfect lap at <host>" in ink. The hub's result dialog previews it (4:5, a sweeping skeleton while it draws, then a 420ms scale-in) with Share (sends the image with the text where the device can share files) and Save image.

### Hub (the landing surface)
Three sections over plain night, separated by hairlines; no cards, no ground texture.
- **Today's circuit (hero):** asymmetric split from lg (5fr copy / 6fr map), stacked on phones with the map between the facts and the lap grid so the CTA stays in the first viewport. Copy column: small gantry as the clock with a red seven-segment countdown, the one orange line ("Daily Quali No. N"), the venue in wide 800 at clamp(44px, 6vw, 84px) mixed case, a steel facts line (country, length, corners), the lap grid, one sentence, one primary button.
- **The hero map (signature):** generated from track data (tools/track-builder/src/build-outlines.ts → src/game/outlines.ts) and drawn like a timing map (the f1-dash / monaco idiom: quiet base, coloured sectors, car dot). One asphalt stroke (#23262d, 2.2× true width, round joins); each corner group painted at 42% of that width in its personal best of the day (the best colour reached there on any of today's laps, F1 style; modes/grading.ts bestPerGroup) (the same purple/green/yellow/red the result screen uses), lighting up in lap order (110ms apart from 1.5s); the perfect line as a 2-unit paint/22 hairline; the car as a 10-unit ink dot ringed in night with a tapering streak (three stacked dashes of 16%, 7% and 2.5% of the lap at 10%, 30% and 85% opacity). Car and streak share one timing: SVG animateMotion and stroke-dashoffset driven by keyPoints/keyTimes from the optimal lap (×4 playback). No corner numbers, no glow. Caption under a hairline, two columns: "Your best today" (or "No lap yet today") and "Perfect lap, driven live", each with its time. Phones cap the map at min(26vh, 320px), and the hero's action sticks to the bottom of the screen (over a night fade) while the hero is in view, so it is always in the first viewport.
- **Perfect Season band:** board/60 band. Heading, one sentence, the score rolling at 44px, the button; beside it the calendar, 12 circuit outlines (6×2, 4×3 on phones): won in paint, lost in steel/40, current in ink, upcoming in #3a3f49, each with its orange start dot and an "R1" caption.
- **Free Practice rail:** heading and sentence, then a horizontal scroll-snap rail of 176px tiles (outline, venue in wide 15px, caption). Hover lifts the tile to graphite and runs a white lap around the outline; a tile opens that circuit directly.
- **Minigames:** heading and sentence, then four equal tiles in a 2×2 grid from md (stacked on phones), each opening its own screen and address: Mystery circuit (today's first clue: 18% of the answer's outline in ink), Higher or lower (a wide "7.004 ↕ ?"), Pit stop (four key caps, the first lit), Lights out (the small gantry). Under each: title in wide 22px, one sentence, and a caption row with the player's status left ("Solved in 3", "Best streak 7") and the action in ink right. Tiles share the practice tile's hover.
- **Footer:** the record as one line of rolling figures and captions, and the independence note.

## Motion

One curve family, the exponential ease-out of a car leaving a corner (`--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`); nothing bounces. Three authored moments, plus feedback:
- **Arrival (hub):** everything readable within about 0.8s. The gantry's lit pods snap on one at a time (70ms each, 140ms apart, from 80ms); the venue name rises out of its own baseline behind a mask (760ms from 100ms) while the facts (200ms) and lap grid (260ms) rise after it; the map's track traces itself from the start line (1100ms from 60ms), the perfect-line hairline follows (900ms from 450ms), corner groups light from 950ms (70ms apart), the caption fades in at 1s, and the car appears at 1.25s and starts lapping at 1.3s. Below the fold, calendar outlines and practice tiles rise as they scroll into view (CSS view timeline, where supported; otherwise they are simply there).
- **The cut (navigation):** grid ↔ circuit runs through a view transition on `main` (`stage`): the new view wipes in behind a slanted leading edge (the button's angle), the old one dims and drifts 4% left. 460ms. The header stays put.
- **The timing reveal (result):** the lap time rolls in (`Roll`: each digit a 0–9 strip, 900ms, 45ms stagger left to right), the delta plate slides in from the right at 520ms, the timing lines rise from 640ms, and the newest lap row of the lap grid flips in tile by tile (55ms apart). The season score and record figures roll the same way.
- **Lights out:** the words slam in (scale 1.5 → 1, 8° skew and 8px blur clearing, 380ms).
- **Minigames:** clue cells flip in, the mystery lap draws on with each miss, higher-or-lower pairs are dealt in.
- **Feedback:** see Buttons. The back chevron leans 3px left on hover.
- Everything above drops to static under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** keep safety orange (#ff6a13) for the player's line, car, choice, record and primary action only.
- **Do** grade corners with purple ≤50 ms, green ≤150 ms, yellow ≤400 ms, red beyond, and keep those four colours for grading in the interface.
- **Do** set every number that updates in tabular figures, and choose width before size: wide for times and names, condensed for labels.
- **Do** keep corners square and reserve the angled cut for primary actions and position or delta plates.
- **Do** mark selection by inverting to paint on night.
- **Do** draw every unlit segment, lamp and LED as a ghost.
- **Do** keep lamp motion stepped with an instant blackout, and turn off `wipe-in`, `tile-flip` and `row-flash` under reduced motion.
- **Do** keep colours in `index.css` @theme and `game/palette.ts` in sync.
- **Do** name circuits by venue only.

### Don't:
- **Don't** use series logos, team liveries, driver likenesses or copied broadcast graphics.
- **Don't** add sound: it was tried and removed; feedback is visual and haptic.
- **Don't** put hub modes in same-size cards; they are grid slots.
- **Don't** round interface corners; rounds belong to lamps, knobs and map markers.
- **Don't** put drop shadows on panels, sheets, dialogs or buttons.
- **Don't** add a second type family or use seven-segment digits beyond the gantry countdown and the speed.
- **Don't** colour the lap time, timing lines or season bar with sector colours, except the purple "Perfect" plate.
