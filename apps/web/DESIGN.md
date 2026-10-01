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
- **Safety Orange** (ink): the player. Their racing line and car on the canvas, the primary action ("Lights out", "Improve line", "Share result"), the gate slider knob, the selected gate's name beside the corner headline, the current round on the season bar, a new personal best or a beaten rival in the timing lines, fine-mode on the slider, the sound toggle when on, the focus ring and text selection.

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
- **Steel** (steel): labels, units, inactive plate numerals, a lost season round (at 35%), the sound toggle when off.

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
- **Icon buttons:** 40px squares, board at 85%, line border, 18px stroked icons (24 grid, 2px stroke, round caps); press scales to 0.92 on graphite. Stacked groups join by dropping the shared border.
- **Layering:** button rules live in `@layer components` so position and size utilities still override them.
- **Focus:** a 2px safety-orange outline at 2px offset, global.

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
- **Header:** night, 52px, line bottom border, joined cells split by hairlines: a 48px back chevron cell, the APEX wordmark (wide 19px), a mode label over the track name, and the sound toggle cell on the right. Sound is off until the player turns it on.

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

### Onboard Cluster
A row of square rev LEDs (green building, the last three blue, all blue on the shift flash; unlit graphite), a wide 40px gear numeral, and the speed in seven-segment digits with ghost segments, units as labels.

### Grid Slot
A painted box on the asphalt: 3px paint front line, side legs fading out toward the back, the grid numeral (wide, paint/40, 40–52px) beside it. Content sits on the ground, no card. The hub ground is procedural asphalt with rubbered-in lines down each grid column.

## Motion

One curve family, the exponential ease-out of a car leaving a corner (`--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`); nothing bounces. Three authored moments, plus feedback:
- **Arrival (hub):** the gantry's lit pods snap on one at a time (70ms each, 220ms apart, from 180ms), then each grid slot is painted onto the tarmac in grid order (P1 at 900ms, +160ms per slot): front line left to right, legs downward, position number slides in, contents rise 10px. The record line rises last.
- **The cut (navigation):** grid ↔ circuit runs through a view transition on `main` (`stage`): the new view wipes in behind a slanted leading edge (the button's angle), the old one dims and drifts 4% left. 460ms. The header stays put.
- **The timing reveal (result):** the lap time rolls in (`Roll`: each digit a 0–9 strip, 900ms, 45ms stagger left to right), the delta plate slides in from the right at 520ms, the timing lines rise from 640ms, and the newest lap row of the lap grid flips in tile by tile (55ms apart). The season score and record figures roll the same way.
- **Lights out:** the words slam in (scale 1.5 → 1, 8° skew and 8px blur clearing, 380ms).
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
- **Don't** play any sound until the player switches it on.
- **Don't** put hub modes in same-size cards; they are grid slots.
- **Don't** round interface corners; rounds belong to lamps, knobs and map markers.
- **Don't** put drop shadows on panels, sheets, dialogs or buttons.
- **Don't** add a second type family or use seven-segment digits beyond the gantry countdown and the speed.
- **Don't** colour the lap time, timing lines or season bar with sector colours, except the purple "Perfect" plate.
