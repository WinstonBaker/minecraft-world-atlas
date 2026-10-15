# Minecraft World Atlas v0.1

A small, local-first fantasy map editor: hand-drawn trees, mountain ranges, villages, rivers, roads, and the stories behind them. Starts with a blank canvas: all map content comes from you. No accounts, server database, or Minecraft connection.

## Run

With Python 3 installed, run `npm start` from this folder, then open http://localhost:4173. There is no installation or build step. Alternatively serve `dist/` with any static web server.

## Make a map

- Drag with **River** or **Road** to draw a path; release to finish.
- Choose **Forest**, **Mountains**, or **Village**, then click the map to place one.
- Use **Select & move** to select and drag features. Drag a selected path's small points to reshape it.
- Edit the selected feature's name, story, colour, size, visibility, and map label in **Details**.
- Use **Layers** or the stacking buttons to move features forward/backward. The top layer draws last.
- Scroll or use the +/− buttons to zoom. Use **Pan the map**, the middle mouse button, or Space + drag to move the view. Fit resets the view.
- Undo with Command/Ctrl + Z; redo with Command/Ctrl + Shift + Z. Delete removes the selected feature.
- Use **New map** for a fresh map; this action can be undone during the session.

## Saving

Changes save automatically in this browser's local storage, under `world-atlas-v1`, and return on reload at the same website address. The save indicator reports write failures. Browser data clearing, private browsing, changing the website address, or changing devices can remove or separate this storage. Import and export controls are intentionally omitted.

If an existing browser save cannot be read, it is preserved and autosaving pauses. Undo history and camera position are session-only; map features, order, names, lore, and styles persist. The editor supports touch placement/drawing, and provides zoom/pan buttons on narrow screens. Google Fonts improve the typography when online; local font fallbacks are provided.

## Tests

Run `npm test` for the dependency-free data tests.

For browser integration tests, start the app, install Playwright separately, and run `node tests/browser.mjs`. If needed set `ATLAS_PLAYWRIGHT` to an absolute Playwright module path and `ATLAS_BROWSER` to your Chrome executable. Browser tests exercise all tools, path reshaping, movement, names/lore, stacking, visibility, undo/redo, zoom/pan, grid, persistence on reload, and mobile overflow. They use an isolated browser context and do not touch your personal map.

## Code layout

- `dist/model.js`: independent feature records, validation, serialization, ordering, and history.
- `dist/render.js`: SVG illustrations and rendering, separate from stored data.
- `dist/app.js`: editor interactions, panels, camera and local persistence.
- `dist/index.html`, `dist/style.css`: accessible controls and responsive layout.

Data uses world coordinates, with an array determining back-to-front order. Features have stable IDs, a type, geometry, style, name, and short lore. This version intentionally has one world, one geographical scale, and no remote data storage. There is no fixed island, built-in scenery, or pre-named geography. The first-release demo features are removed on load only when completely untouched; edited features and user-created places are preserved. Editable coastlines and land painting are outside v0.1.
