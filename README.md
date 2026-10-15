# Minecraft World Atlas v0.1

A small, local-first fantasy map editor: freehand drawings of forests, mountains, villages, rivers, and roads, with names and lore attached. Starts with a blank canvas: all map content comes from you. No accounts, server database, or Minecraft connection.

## Run

With Python 3 installed, run `npm start` from this folder, then open http://localhost:4173. There is no installation or build step. Alternatively serve `dist/` with any static web server.

## Make a map

- **Draw** is active when the editor opens. Set a color and width, then draw as many strokes as you like without switching tools. No categories or preset artwork. A click makes an ink dot.
- **Erase** removes strokes you touch; undo restores an erasing gesture.
- Use **Select** to select and move a drawing. Choose **Edit points** only when you want to reshape it. The details panel stays out of the way while drawing.
- Edit the selected feature's name, story, color, stroke width, visibility, and map label in **Details**.
- Use **Layers** or the stacking buttons to move features forward/backward. The top layer draws last.
- Scroll or use the +/− buttons to zoom. Use **Pan**, the middle mouse button, or Space + drag to move the view. Fit resets the view.
- Undo with Command/Ctrl + Z; redo with Command/Ctrl + Shift + Z. Delete removes the selected feature.
- Use **New map** for a fresh map; this action can be undone during the session.

## Saving

Changes save automatically in this browser's local storage, under `world-atlas-v1`, and return on reload at the same website address. The save indicator reports write failures. Browser data clearing, private browsing, changing the website address, or changing devices can remove or separate this storage. Import and export controls are intentionally omitted.

If an existing browser save cannot be read, it is preserved and autosaving pauses. Undo history and camera position are session-only; map features, order, names, lore, and styles persist. The editor supports touch placement/drawing, and provides zoom/pan buttons on narrow screens. The editor uses system fonts and loads no external art, icons, or fonts.

## Tests

Run `npm test` for the dependency-free data tests.

For browser integration tests, start the app, install Playwright separately, and run `node tests/browser.mjs`. If needed set `ATLAS_PLAYWRIGHT` to an absolute Playwright module path and `ATLAS_BROWSER` to your Chrome executable. Browser tests exercise continuous drawing, brush settings, fine pointer sampling, erasing and undo, movement, optional names/lore, stacking, visibility, zoom/pan, grid, persistence on reload, and mobile overflow. They use an isolated browser context and do not touch your personal map.

## Code layout

- `dist/model.js`: independent feature records, validation, serialization, ordering, and history.
- `dist/render.js`: rendering of user-drawn strokes, separate from stored data.
- `dist/app.js`: editor interactions, panels, camera and local persistence.
- `dist/index.html`, `dist/style.css`: accessible controls and responsive layout.

Data uses world coordinates, with an array determining back-to-front order. Features have stable IDs, a type, geometry, style, name, and short lore. This version intentionally has one world, one geographical scale, and no remote data storage. There are no preset trees, buildings, mountain symbols, fixed islands, paper textures, or pre-named geography. All drawings render only user-created geometry; old single-point placements appear as simple ink dots. The first-release demo features are removed on load only when completely untouched; edited features and user-created places are preserved. Editable coastlines and land painting are outside v0.1.

Saved worlds contain only drawing coordinates, names, lore, colors, widths, visibility, and order. Asset, sprite, SVG, and other unknown fields are stripped when loading or saving. Published file URLs are versioned to avoid stale drawing modules after a refresh.
