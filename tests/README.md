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
