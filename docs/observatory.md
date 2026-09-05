# Observatory 3D refresh

## Scope
The existing live API, demo state machine, site graph, avatar painter, tracking SDK, D1 schema and deployment targets are preserved. Rendering now lives in `scene.js`; the dark instrument-panel styles live in `scene.css`. There is still no bundler and no external model, HDR, image or runtime CDN dependency.

## Visual direction
A dark, restrained observatory replaces the warm cartoon treatment. The globe combines a layered instrument pedestal, fine gimbal, etched meridians and instanced land plates. The park uses bevelled ceramic/metal buildings on a layered deck, a glass laboratory and inset route traces. Amber indicates visitors and the selected route; cyan is structural. All content text stays in the DOM sidebar rather than floating over the 3D models.

## Interaction and compatibility
Only the active camera controller receives input. Reset clears pending damping before returning to the fitted view. Both cameras respond to the stage ResizeObserver, with a small-screen fit margin. Reduced-motion disables decorative rotation/bobbing/pulses; the rotation control reflects that restriction. WebGL initialization failure and context loss reveal the original 2D fallback. Full visitor IDs are retained for selection and escaped before insertion into event attributes; event clock values are converted with performance.timeOrigin for display.

## Performance
The renderer is capped at 30 fps, data synchronization at 200 ms. Pixel ratio is capped at 1.75 on larger stages and 1.5 on small stages. Land is instanced, avatar textures redraw only on state changes, and departing sprites/beacons release GPU resources. These are implementation limits, not a measured frame-rate guarantee on every device.

## Local preview
Run `node server.cjs` and open `http://127.0.0.1:8893/?demo=1`. The development server resolves files relative to the checkout, not a machine-specific absolute path. Its default port retains the original demo behavior.

## Browser regression suite
Install `playwright@1.55.0` and Chromium (`npx playwright install --with-deps chromium`). Start `PORT=8894 node server.cjs`, then run `node tests/visual.mjs`. Port 8894 is deliberate: the live API tests must not accidentally enter the port-8893 demo mode. The workflow runs these checks with read-only repository permissions.

The suite covers actual WebGL pixel output, desktop/mobile viewports, keyboard visitor selection, drag/zoom/reset, repeated tab switching, reduced-motion/default-motion behavior, mocked live visitors sharing an ID prefix, escaped markup and the WebGL-disabled fallback. PNG captures and results.json are attached to each Visual review run as `tidestat-visual-review`. Browser viewport checks are not physical-device or Safari testing; the live API is mocked and production data is not modified.
