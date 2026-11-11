# Saved recommendations in consultation editor

Local feature only; not published or deployed. No patient records accessed.

- Embedded in the existing treatment column of Edit Case / New Visit / Edit Visit.
- Shows saved recommendations through the consultation date, newest first; excludes the visit being edited.
- Patient-facing wording is preferred over clinical wording, with legacy fallback.
- Groups instructions, formulas and dose/instructions/suspended status, food categories and guidance, healthy habits, lifestyle, manual recipes, saved recipes, therapies.
- Respects disabled optional PDF sections. Does not change stored prescriptions or automatically continue them.
- Uses patient records already loaded by the existing authenticated screen. No new endpoint, storage, permissions or writes.
- Historical food tables generated from catalogues are not reconstructed; the UI explains that the original PDF remains the reference for full tables/layout.

Verification:
- 25 node tests passed (5 new history tests + 20 existing intake tests).
- npm run build passed (TypeScript, app Vite, calendar Vite).
- ESLint passed on the two new source files.
- Global lint reports 101 errors and 3 warnings; not a clean repository-wide lint pass.
- UI fixture: /tests/treatment-history-fixture.html, fictional data only. Browser screenshot/interactions could not run: installed Chromium fails with socket() Operation not permitted, including an escalated attempt. Manual visual review still required, especially narrow/mobile screens and repeat open/close.
