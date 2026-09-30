---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/ui/Hub.tsx","src/game/game.ts"]
---

# APEX game surface: hub + Daily Quali / Perfect Season / Free Practice

Scope: the whole web app (home hub, setup, race, result). Visitor mode: Experience.
Audience/job: fans on phones in idle minutes; set a line, race, read the colours, retry; come back daily.
Constraints: PRODUCT.md modes (Daily 6 laps then locked, all-purple wins; Season 12 rounds × 3 laps vs rival; Practice unlimited). No F1 branding. Sound opt-in only.
Memorable moment: lights out, then the lap's corner tiles reveal one by one as the car passes them.

## Direction contract

THESIS: Home is a starting grid, not a card menu. Modes are painted grid slots on asphalt, today's puzzle on pole, the start-light gantry is the clock. Refuses the category's grid of same-size game cards.

OWN-WORLD: textured asphalt ground; white painted grid brackets; black gantry with five red lamp pods (ghost lamps visible when off); pit board with slotted digits; seven-segment timing digits with ghost segments; sector colours purple / green / yellow / red as the only feedback language; safety orange = you. Big Shoulders Display for slot labels, Barlow for copy, Plex Mono only for data.

STORY: see today's circuit on pole and the lights counting down, tap Lights out, set gates, race; each lap reveals a row of corner tiles; win on an all-purple row; share the grid; chase 12–0 in Season; practise freely.

FIRST VIEWPORT (390×844): gantry across the top 14% with 5 lamp pods and a segment countdown under it; P1 slot (left, 60% width) with the circuit outline, #N, flag, six lap rows and the orange Lights out button; P2 Season slot staggered right; P3 Practice slot left; record strip at the bottom edge.

FORM: Starting Grid, position 4 of my ordered list, dealt as lead; seed 7b8d7b65. Signature interaction: five lamps light one by one, hold, black out, then the car launches and tiles reveal live. Motion grammar: stepped lamp-on, instant blackout, no easing on lights.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
