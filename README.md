# Dad Tax Attack!

A single-page browser game where you play as a dad trying to steal pizza slices from his two sons during dinner at a pizza parlor, while they try to block you. Built with zero dependencies — just open `index.html` in a browser and play.

## How to Play

**Open `index.html` in any modern browser.** No build step, no install, no server required.

### Controls

| Action | Input |
|---|---|
| Steal cheese (Bro 2's pizza) | Left click |
| Steal sausage (Bro 1's pizza) | Right click |
| Toggle sound | Click speaker icon (top HUD) |

In **3-Player Local Multiplayer** mode, the boys are human-controlled:
- **Bro 2 (Player 2):** Hold any gamepad button to block
- **Bro 1 (Player 3):** Hold any keyboard key to block

### Rules

- You have **5 minutes** of dinner to steal as many of the **8 total slices** as you can
- Each boy has 4 slices — time your steals for when they're distracted or recovering
- Getting blocked stuns you briefly and breaks your combo
- Boys have limited stamina for blocking — they can't guard forever
- Chain consecutive steals for combos

### Ratings

| Slices | Rating |
|---|---|
| 0–1 | Salad Eater... |
| 2–3 | Amateur Taxer |
| 4–5 | Sneaky Dad |
| 6–7 | Master Taxer! |
| 8 | TAX KING!! |

## Architecture

The entire game runs from a single HTML file with no external dependencies. Three logical modules are inlined via `<script>` tags:

```
index.html    137 KB   Rendering, input, game loop (2,683 lines)
engine.js      20 KB   Game logic, AI, audio engine (719 lines)
sprites.js     51 KB   Pixel art data & sprite helpers (1,530 lines)
```

### Design Decisions

- **No build system, no modules, no npm** — everything lives in global scope so the game can be opened as a local file in any browser
- **Canvas 2D rendering at 640x480** logical resolution, scaled with `image-rendering: pixelated` for a retro look
- **Canvas-drawn characters** — while `sprites.js` defines a full palette-indexed pixel art system, the active rendering uses canvas primitives (ellipses, rects, gradients) for richer detail at the game's scale
- **Web Audio API synthesis** — all music and sound effects are generated in real-time from oscillators and noise buffers, no audio files needed
- **IIFE module pattern** — `GameEngine` and `AudioEngine` are immediately-invoked function expressions that return public API objects

### Game Engine

The engine is a frame-based state machine:

```
MODE_SELECT → MENU → PLAYING → GAME_OVER
                ↑                    |
                └────────────────────┘
```

**Dad** cycles through: `idle → reaching → eating/blocked → cooldown → idle`

**Boy AI** (1P mode) has personality-driven behavior:
- Each boy has a `cautious` or `aggressive` personality affecting reaction speed and block duration
- Alertness escalates after each successful steal (capped so the game stays beatable)
- A post-block cooldown guarantees the dad a steal window after every block
- Random distraction periods create natural openings

**Stamina system** prevents infinite blocking — boys drain stamina while guarding and must rest to recharge, creating strategic rhythm for both sides.

### Audio

The music is an Italian tarantella-inspired chiptune in 6/8 time at 160 BPM:
- **Melody:** Square wave, 96-note two-section pattern (A minor / C major)
- **Bass:** Triangle wave on beats 1 and 4
- **Percussion:** Synthesized kick, hi-hat (noise bursts), and snare

Sound effects use ascending tones (steal), crunchy noise (eating), descending buzz (blocked), and fanfares (victory/game over).

### Rendering Pipeline

Each frame during gameplay:

1. **Background** — wall gradient, brick texture, floor tiles, all scenery (oven, arcade, window, lamps, decorations)
2. **Table** — wood grain, gingham cloth, condiments, bread basket, candle, glasses
3. **Table Items** — plates, pizzas (with steam), salad, animated fly
4. **Characters** — dad with stretchy arm animation, boys with state expressions and speech bubbles
5. **Effects** — particles (crumbs, stars, hearts), floating text popups
6. **Vignette** — cinematic corner darkening
7. **HUD** — timer, tax meter, combo display, stamina bars, control hints, mute button (rendered outside screen shake)

Screen shake is applied as a canvas translation before steps 1–6, while the HUD stays stable.

### Input Support

The game handles four input methods simultaneously:
- **Mouse** — primary control for dad (left/right click)
- **Touch** — left/right half of screen maps to left/right click
- **Keyboard** — Bro 1 blocking in 3P mode (any key)
- **Gamepad** — Bro 2 blocking in 3P mode (any button)

## Scenery & Visual Details

The pizza parlor background is packed with hand-drawn details:

- Brick pizza oven with flickering flames and a baking pizza inside
- Arcade cabinet with a pixel-art space invader on the screen
- Neon "PIZZA" sign with animated flicker glow
- Window with night sky, twinkling stars, and moon
- Pendant lamps casting warm light cones with floating dust motes
- Chalkboard specials, menu board, Italian flag
- String bulb garland with twinkling colored lights
- Garlic & chili pepper braid hanging from the ceiling
- Stacked pizza boxes, potted plant, wine bottle
- Candle with flickering flame and dripping wax
- Bread basket with breadsticks, water glasses with straws
- Mouse peeking from the wainscoting (Easter egg)
- Pizza-shaped wall clock with real-time hands

## Development History

Built incrementally from a minimal prototype to a polished game:

1. **Initial commit** — core gameplay loop, basic sprites
2. **Resolution upgrade** — 640x480, 1-player AI mode, improved instructions
3. **Control refinement** — left/right click mapping, bug fixes
4. **Character redesign** — canvas-drawn characters, pizza parlor background
5. **Graphics overhaul** — gradients, lighting, shadows, detailed scenery
6. **Scenery details** — clock, chalkboard, oven, decorations, table items
7. **Character polish** — gradient shading, ears, eyebrows, clothing detail
8. **HUD overhaul** — rounded panels, icons, tax meter redesign
9. **AI balance** — reaction tuning, post-block cooldowns, beatable difficulty
10. **Juice & UX** — screen shake, combos, speech bubbles, mute toggle, animated game over

## Credits

A Cowgill Family Production
