---
name: APEX
description: A daily racing-line game drawn as a circuit seen from the air, timed like a pit wall.
colors:
  ink: "#ff6a13"
  purple: "#a259ff"
  green: "#29cc6a"
  yellow: "#f5c518"
  kerb: "#d7263d"
  lamp-red: "#ff2b1a"
  tarmac: "#1d2024"
  runoff: "#262a30"
  asphalt: "#33383f"
  paint: "#ecebe4"
  steel: "#8b939c"
  board: "#0c0d0f"
  slot: "#17191d"
typography:
  grid-numeral:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "52px"
    fontWeight: 900
    lineHeight: 1
  headline:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "26px"
    fontWeight: 900
    lineHeight: 0.92
    letterSpacing: "0.03em"
  title:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
  button:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "20px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.08em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.375
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.06em"
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.14em"
rounded:
  slot: "2px"
  tile: "3px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  panel: "10px"
  lg: "12px"
  xl: "16px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.board}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-disabled:
    backgroundColor: "{colors.asphalt}"
    textColor: "{colors.steel}"
  button-secondary:
    backgroundColor: "{colors.board}"
    textColor: "{colors.paint}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  icon-button:
    textColor: "{colors.paint}"
    rounded: "{rounded.md}"
    size: "40px"
  gate-chip:
    textColor: "{colors.steel}"
    typography: "{typography.data}"
    rounded: "{rounded.full}"
    height: "32px"
  panel:
    backgroundColor: "{colors.board}"
    textColor: "{colors.paint}"
    rounded: "{rounded.lg}"
    padding: "12px"
  lap-tile:
    rounded: "{rounded.tile}"
    height: "clamp(14px, 3.2vh, 24px)"
  pit-board:
    backgroundColor: "{colors.board}"
    textColor: "{colors.paint}"
    rounded: "{rounded.md}"
    padding: "10px"
  pit-board-slot:
    backgroundColor: "{colors.slot}"
    rounded: "{rounded.slot}"
---

# Design System: APEX

## Overview

**Creative North Star: "The Starting Grid at Dusk"**

APEX is drawn from the materials of a real circuit, not from app chrome. The ground is textured asphalt; structure is white paint on it (grid brackets, track edges, kerbs); instruments are the ones a paddock actually uses: a black start gantry with five red lamp pods, a pit board with slotted digits, seven-segment timing with its unlit segments still showing, a steering-wheel display with rev LEDs. The circuit itself is rendered from the air, grass, gravel, run-off and kerbs, with a detailed open-wheel car in the player's safety orange.

The world is dark, dense and quick. Panels are black boards laid over the circuit, not floating cards; the hub is a grid of painted slots on the tarmac, today's puzzle on pole. Colour is scarce on purpose: paint and steel on near-black, one orange that means "you", and the four sector-timing colours that mean "how much time you lost". Motion is mechanical: lamps step on, blackout is instant, the pit board swings in over the wall, tiles flip as the car passes each corner.

It is an independent game. Nothing borrows a series identity: no series logos, team liveries, driver likenesses or copied broadcast graphics; circuits are named by venue only.

**Key Characteristics:**
- Asphalt ground, white-paint structure, black instrument boards.
- Safety orange is the player; purple/green/yellow/red is the grade; everything else is paint and steel.
- Real timing hardware: ghost segments, dark-glass lamps, slotted pit-board digits.
- Condensed, painted-on uppercase display type; mono only for data.
- Stepped, mechanical motion; every animation drops under reduced motion.

## Colors

A near-black motorsport palette: tarmac and board neutrals, painted off-white, one orange for the player and the sector-timing quartet for feedback.

### Primary
- **Safety Orange** (ink): the player. Their racing line on the canvas, their car livery, the primary action ("Lights out", "Race", "Share"), the gate slider knob, the selected chip, the current lap dot, a new personal best or beaten rival on the pit board, the sound toggle when on, the focus ring and text selection.

### Feedback (sector timing)
- **Purple Sector** (purple): a corner group within 50 ms of the perfect line. Also a perfect-lap board and a live delta at or under 50 ms.
- **Green Sector** (green): within 150 ms.
- **Yellow Sector** (yellow): within 400 ms.
- **Kerb Red** (kerb): more than 400 ms off. Doubles as the kerb stripe on the gate slider and the "INSIDE" label, which is the same painted kerb the circuit uses.

### Tertiary
- **Lamp Red** (lamp-red): lit start-lamp glass only (radial from #ffb3a8 through lamp red to #9e0f06, with a red glow). Unlit lamps are dark glass (#2a1412 to #0b0404). Used in the gantry and the favicon.

### Neutral
- **Tarmac** (tarmac): the page, header and canvas infield; also the browser theme colour.
- **Run-off** (runoff) and **Asphalt** (asphalt): track surfaces on the canvas; asphalt is the gate slider's track bed and the disabled primary button.
- **Paint** (paint): all primary text and every painted line (grid brackets, track edges, slider edges). Dimmed with opacity (/85, /80, /70, /65, /45) for secondary copy, labels and grid numerals.
- **Steel** (steel): data labels, units, secondary headers, the sound toggle when off.
- **Board** (board): panels, pit board, HUD, dialogs, button text on orange. Used at 88–92% opacity with a small backdrop blur over the canvas.
- **Slot** (slot): the recessed cells behind pit-board characters.
- Borders are white at low alpha: 5–12% at rest, 30–45% on hover.

### Named Rules
**The You Are Orange Rule.** Safety orange marks the player and the player's next action, nothing else. If an orange element is not the player's line, car, choice, record or primary action, it is wrong.

**The Sector Colours Rule.** Purple, green, yellow and red mean time lost at a corner against the perfect line (≤50 / ≤150 / ≤400 / more ms, from `modes/grading.ts`) and nothing else. They speak on the lap tiles, the loss-coloured line and corner deltas on the canvas, the adjust chips and the legend. The pit board stays paint unless the whole lap is purple.

**The Paint Is Structure Rule.** Structure is drawn as white paint on dark ground (3px brackets, edges, ticks), never as filled card surfaces.

## Typography

**Display Font:** Big Shoulders Display (with Arial Narrow), weights 700 and 900
**Body Font:** Barlow (with system-ui), weights 400/500/600
**Label/Mono Font:** IBM Plex Mono (with ui-monospace), weights 400/500/600

**Character:** A condensed, stencil-straight display face that reads as paint on a grid box or numbers on a pit board, over a plain humanist sans for sentences, with mono kept for readouts.

### Hierarchy
- **Grid numeral** (900, 52px, 64px on desktop, line-height 1): painted grid positions beside the hub slots, at paint/45.
- **Headline** (900, 24–30px, line-height 0.92–1, 0.03em, uppercase): slot names, panel and dialog headlines, the corner name in setup. "Lights out" on the race screen runs at 34px with 0.1em.
- **Title** (700, 19–20px, 0.04em, uppercase): header breadcrumb, track picker rows.
- **Button** (900, 20–21px, 0.08em, uppercase): primary actions only.
- **Body** (Barlow 400/500, 13–15px, line-height 1.375): status sentences, readouts, secondary buttons.
- **Label** (Barlow 600, 11–13px, 0.06–0.1em, uppercase): record-strip keys, hub sub-lines, "Next quali in".
- **Data** (Plex Mono 400/500, 10–11px, 0.12–0.14em, uppercase): units (KM/H), lap counters, board row labels (LAP / TGT / RIV / PB), slider ends, chip text, legend, canvas corner labels.

### Named Rules
**The Mono Is Data Rule.** IBM Plex Mono appears only on numbers and their labels. Sentences are Barlow; names and actions are Big Shoulders.

**The Timing Face Rule.** Live timing (speed, delta, countdown) is drawn with seven-segment digits, not a font. Final lap times on the pit board use Big Shoulders 900 in slots.

## Layout

Mobile-first at 390px. Over the circuit canvas, controls dock to the bottom edge in a panel capped at 512px (setup, result, daily summary), the race HUD caps at 560px top and bottom, and from 720px the result column moves to a 400px right rail. Panels report their size back to the canvas so the camera frames the track around them. Safe-area insets pad the header and every bottom-docked panel (`max(12px, env(safe-area-inset-bottom))`).

The hub is a vertical starting grid: slots at 62% width (236–400px), alternating left and right, pole on the left and deeper; from `lg` they sit in a two-column grid with the right column staggered 112px lower. The gantry spans the top; a four-cell record strip is pinned to the bottom edge.

Spacing runs on Tailwind's 4px step, and in practice tightly: 4–8px between related items, 10–12px panel padding and section gaps, 16px page gutter. Density is high by design; everything fits the first viewport on a phone.

## Elevation & Depth

Depth comes from physical objects, not UI elevation. Panels are flat boards separated from the canvas by opacity and a light backdrop blur, with a 1px white/10 border. Shadows appear only where a real object hangs or sits proud: the gantry truss, the lamp pods, the pit board held out over the wall, the slider knob. Inset shadows recess the pit-board slots and unlit LEDs.

### Shadow Vocabulary
- **Gantry drop** (`box-shadow: 0 10px 24px rgba(0,0,0,0.5)`): the overhead truss on the hub.
- **Lamp pod** (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 14px rgba(0,0,0,0.5)`): each five-light pod.
- **Lit lamp glow** (`box-shadow: 0 0 14px 3px rgba(255,40,20,0.55)`): lit lamps only.
- **Pit board** (`box-shadow: 0 18px 40px rgba(0,0,0,0.55)`): the result board.
- **Slot recess** (`box-shadow: inset 0 -2px 0 rgba(255,255,255,0.04), inset 0 2px 0 rgba(0,0,0,0.5)`): pit-board character cells.
- **Knob** (`box-shadow: 0 2px 10px rgba(0,0,0,0.5)`): the gate slider thumb.

### Named Rules
**The Ghost Segment Rule.** Unlit hardware stays visible. Seven-segment digits draw their off segments at 8–20% opacity, start lamps show as dark glass, rev LEDs show as #141517 with a faint inset highlight. Nothing that is off is ever simply absent.

## Shapes

Small, machined corners. 2–3px on tiles and pit-board slots, 6px on buttons, pods, the pit board and the slider bed, 8px on panels and dialogs, full rounds only on lamps, LEDs, chips, dots and the knob. Digits are skewed 6 degrees like real timing displays. Painted lines are 3px. Kerbs are 7px red/paint stripes. Grid brackets are open at the back: a front line and two legs fading to transparent.

## Components

### Buttons
Tactile, heavy, and one colour for the one action that matters.
- **Shape:** gently squared (6px).
- **Primary:** safety orange with board-black text, Big Shoulders 900 uppercase at 0.08em, 10–12px by 20px padding; presses to 97% scale. Disabled goes asphalt with steel text.
- **Secondary:** board at 60–80% with a white/12–20 border and paint text; border brightens to white/30–45 on hover; disabled at 35% opacity.
- **Icon buttons:** 36–40px squares, same border treatment, 18px stroked icons (24-grid, 2px stroke, round caps).
- **Focus:** a 2px safety-orange outline at 2px offset, global.

### Chips
- **Gate chips:** 32px pills with mono 11px labels, one per gate in the selected corner; abbreviated when there are many, spelled out when selected.
- **Adjust chips (result):** 6px rounded, white/15 border, corner name in paint plus its delta in its sector colour.

### Panels
- **Corner Style:** 8px.
- **Background:** board at 88–92% with backdrop blur over the canvas; solid board for dialogs over a black/60 scrim.
- **Border:** 1px white/10.
- **Internal Padding:** 10–12px (16px in dialogs).
- Enter with `rise` (260ms ease-out, 8px up); the result panel is delayed 200ms behind the pit board.

### Inputs / Fields
- **Gate slider:** a 56px cross-section of the track in asphalt with 3px paint edges, a 7px kerb stripe on the inside edge, metre ticks, and a 32px orange knob ringed in 3px paint. Tap jumps, drag moves at reduced gain, pulling away from the bar enters fine mode (shown in orange). Readout above in Barlow, LEFT/RIGHT/INSIDE below in mono (INSIDE in kerb red).

### Navigation
- **Header:** tarmac bar with the APEX wordmark (Big Shoulders 900, 26px), a steel breadcrumb of mode and venue, a back chevron to the grid, and the sound toggle on the right. Sound is off until the player turns it on.

### Start-Light Gantry (signature)
Five black pods (6px radius, white/8 border), two lamps each, sizes 16/24/36px. On the hub it is the day's clock, one pod per fifth of the day, with a seven-segment countdown beneath. On the race screen lamps step on one at a time, hold, and black out instantly; no easing on lights.

### Seven-Segment Timing (signature)
SVG digits in a 10×18 cell, skewed −6 degrees, with ghost segments. Used for speed, live delta (purple at ≤50 ms, otherwise paint) and the hub countdown.

### Lap Grid (signature)
One row per lap, one tile per corner group. Empty rows are outlined at white/12; the live row is outlined at white/35 on white/5; graded tiles fill with their sector colour and flip in (`tile-flip`, 240ms) as the car leaves each group. Small size (10px, 2px radius) on the hub, medium (14–24px, 3px radius) elsewhere.

### Pit Board (signature)
A board-black plate with a 2px #3a3f46 frame, mono row labels (LAP, TGT or RIV, PB) and characters set one per recessed slot in Big Shoulders 900. It swings in from the right over the pit wall (`board-in`, 520ms, overshoot and settle). Values are paint, orange for a PB or beaten rival, purple only for an all-purple lap.

### Steering-Wheel HUD (signature)
A board panel at the top with a full-width row of rev LEDs, a 44px gear digit in a black cell, segment speed and delta, and mono units. The live lap tiles dock at the bottom.

### Grid Slot (signature)
A painted box on the asphalt: 3px paint front line, side legs fading out toward the back, the grid numeral painted beside it. Content sits directly on the ground, no card. The hub ground is procedural asphalt with rubbered-in lines down each grid column.

## Do's and Don'ts

### Do:
- **Do** keep safety orange (#ff6a13) for the player's line, car, choice and primary action only.
- **Do** grade corners with purple ≤50 ms, green ≤150 ms, yellow ≤400 ms, red beyond, and keep those four colours for grading.
- **Do** draw every unlit segment, lamp and LED as a ghost (8–20% segments, dark-glass lamps).
- **Do** draw structure as 3px white paint on dark ground, and let hub content sit on the asphalt.
- **Do** keep lamp motion stepped with an instant blackout, and turn off `board-in`, `rise` and `tile-flip` under reduced motion.
- **Do** keep colours in `index.css` @theme and `game/palette.ts` in sync.
- **Do** name circuits by venue only.

### Don't:
- **Don't** use series logos, team liveries, driver likenesses or copied broadcast graphics.
- **Don't** play any sound until the player switches it on.
- **Don't** put hub modes in same-size cards; they are grid slots.
- **Don't** colour pit-board values with sector colours, except purple for an all-purple lap.
- **Don't** set sentences in Plex Mono or data in Barlow.
- **Don't** hide the off state of timing hardware.
