# Bitreq Recorder (Chrome extension)

Playwright recorder UI that runs as a Chrome extension (side panel or popup).

## Build

From repo root:

```bash
bun run build:crx   # build core lib once
cd examples/recorder-crx && bun run build
```

Then load the `examples/recorder-crx/dist` folder as an unpacked extension in Chrome.

## Dev mode: run the sidebar locally (no extension)

To open and test the Playwright sidebar UI in a normal browser tab (e.g. for layout/CSS work) without installing the extension:

1. From repo root, build the core lib once (if not already done):

   ```bash
   bun run build:crx
   ```

2. Start the dev server:

   ```bash
   bun run dev:recorder
   ```

   Or from this directory: `bun run dev`.

3. Open **http://localhost:5173/** (or the port Vite prints). The sidebar UI loads with a mock Chrome API; recording and extension features won’t work, but you can test the layout and components.
