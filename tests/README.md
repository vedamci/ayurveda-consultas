# PDF regression checks

The fixture uses a fictitious patient without an ID. Run only Vite with the test API, never the real server or patient data:

```sh
node scripts/test-pdf-preview.mjs
```

Open http://pdf-test.localhost:4179/tests/pdf-fixture.html and use the real export buttons for A4 and mobile. `?long=1` adds long text. The test alias compares each text block by tag, contents and occurrence against the exported SVG, including exact font family and size. It checks loaded Eczar/Mukta faces and embedded font data URLs. Evidence is stored in the fixture's `#pdf-test-evidence` output; errors appear in `#pdf-test-error` without native alerts. This alias is never used in production.

The endpoint http://pdf-test.localhost:4179/__pdf-test-status must show zero backend print requests and zero writes. Downloaded files can be verified with:

```sh
node scripts/verify-pdf-download.mjs PATH_TO_PDF desktop OUTPUT_DIRECTORY
node scripts/verify-pdf-download.mjs PATH_TO_PDF mobile OUTPUT_DIRECTORY
```

The verifier checks every page's paper size and rendered ink, PDF signature/EOF, and the fixture's clickable link. Inspect the rendered pages and contact sheet for overlaps. The raster export preserves visual fonts and links; document text is not selectable.

# Consultation notes (synthetic data only)

Run `node tests/consultation-notes.test.mjs` for legacy/current Markdown, exact content and quantities, inert HTML/URLs/images, cross-category references, and the actual purpose field/fallback/absence. Existing treatment checks: `node --test tests/treatment-history.test.ts` and `node tests/treatment-markdown.test.mjs`.

For the visual fixture, start `node scripts/test-pdf-preview.mjs`, which stubs `/api` and never starts the real backend. Open `http://localhost:4179/tests/consultation-notes-fixture.html`; `?legacy` removes the structured purpose, `?empty` checks missing data. Verify keyboard toggle, category accordions, tables, scroll and narrow layouts. The `/__pdf-test-status` endpoint reports blocked writes.

Automated browser checks own and close the isolated Vite server: `node tests/consultation-notes-browser.mjs` (requires Puppeteer's Chrome, installed with `npx puppeteer browsers install chrome`, or `CHROME_BIN` pointing to Chromium). They check keyboard toggles, scrolling, 375/768 px layouts, legacy/missing purpose, real editor integration and zero API writes/print/tracking requests. Synthetic screenshots are written to `/tmp/consultation-notes-{375,768}.png`.
# Treatment habits (synthetic data only)

Run `npm run test:treatment-habits` on Node 24 after `npm ci --ignore-scripts`.
The actual editor is rendered with React Test Renderer; its hooks, effects,
checkbox handlers and debounced save payloads run unchanged. Only browser
animation and PDF export are doubled. Every fetch is intercepted in memory and
only known synthetic routes are accepted; no real server or clinical data is used.

Covers an initially empty new treatment before/after a delayed catalogue refresh,
manual selection, select all/none, parent refresh and reopen. For both plans and
visits it checks saved subsets (including their order), all habits, empty/missing/
null fields, hidden sections and names no longer in the catalogue. Source records
are frozen and their exact JSON is checked. The original serializer's handling of
hidden PDF sections remains unchanged. These checks verify React behavior and
payloads; they do not replace visual browser/PDF verification.
