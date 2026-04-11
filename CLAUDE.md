# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dad Tax Attack!** is a single-page browser game (no build system, no dependencies). The player is a dad trying to steal pizza slices from his two sons (Parker and Brennan) during dinner, while they try to block him. It runs entirely from `dad-tax.html` opened in a browser.

## Running the Game

Open `dad-tax.html` directly in a browser. There is no build step, no package manager, and no test framework.

## Architecture

The game is split into three logical modules, all loaded via inline `<script>` in the HTML:

1. **`sprites.js`** — SNES-style pixel art system. Defines palettes (indexed color arrays), sprite grids as hex-encoded pixel data, tile patterns, and rendering functions (`renderSprite`, `fillTiles`, `getAnimFrame`). Sprites are stored as 2D arrays of palette indices.

2. **`engine.js`** — Game logic and audio. Contains:
   - **GameEngine** (IIFE/module pattern) — State machine (`MENU` → `PLAYING` → `GAME_OVER`), game loop update, input handling, timer, and tax meter tracking.
   - **Boy AI** — Each boy (Parker=left, Brennan=right) cycles through states (`idle`, `alert`, `distracted`, `blocking`, `eating_own`) with personality-specific probabilities and reaction times. Alertness escalates after each steal.
   - **Dad (player)** — State machine (`idle` → `reaching` → `eating`/`blocked` → `cooldown`). Input is one-shot (A/Left for Parker's cheese, D/Right for Brennan's sausage).
   - **AudioEngine** (IIFE) — Web Audio API chiptune music (Italian tarantella in 6/8 time) and sound effects (grab, eat, blocked, victory, game_over).
   - **Particles & Popups** — Crumbs, stars, hearts with physics; floating text popups with scale animation.

3. **`dad-tax.html`** — Rendering layer and main loop. The HTML inlines both JS files and adds:
   - Canvas setup (320×240 logical, scaled to fit viewport)
   - All rendering functions (background tiles, table, characters with stretchy arm animation, HUD, menus)
   - Input handling (keyboard + mouse/touch with on-screen buttons)
   - `requestAnimationFrame` game loop

## Key Patterns

- **No modules or imports** — Everything is in the global scope. The sprite/palette data in `dad-tax.html` duplicates and extends what's in `sprites.js`.
- **Palette-indexed sprites** — Pixel art stored as 2D arrays of hex digit indices into palette color arrays. `makeGrid(w,h)` + `paintFromHex(grid, startRow, hexRows)` builds them.
- **IIFE module pattern** — `GameEngine` and `AudioEngine` are both immediately-invoked function expressions returning public API objects.
- **Frame-based timing** — AI timers and animation are counted in frames (60 FPS target), while the main loop uses `dt` (delta time in seconds).
- **Canvas coordinate system** — Logical resolution is 320×240, rendered with `image-rendering: pixelated` for retro look. Scaling handled by CSS.
