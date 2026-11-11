# Patient intake verification

Offline unit tests (Node24): `node --test tests/intake-draft.test.ts tests/intake-validation.test.mjs`.
Syntax/build: `node --check server/index.js` and `npm run build`.

The public intake uses an explicit1–10 scale. Older unversioned clients keep1–3; historical records are not converted. Notion stores a scale marker and the local patient record stores its scale for the app.

Draft saving is voluntary on personal devices only. Drafts are not sent to a server, exclude professional notes and consent choices, require explicit resume, expire after seven days of inactivity, and are removed on successful submission or disabling saving. Expired drafts are removed on the next visit, not by a background timer.

Before publishing, verify in an authorized staging browser:
- Public route opens without login;1–10 controls fit mobile and keyboard/accessible labels work.
- Opt in, enter synthetic values, reload and resume; symptom values restore and consent must be selected again.
- With saving off, no new draft is stored; internal professional mode never saves a draft.
- Cancel confirmation, double-click submit and simulate a non-JSON network error: no unintended submission or loss of values.
- Submit a specifically authorized synthetic record, verify exact values in Notion and patient detail, and follow approved cleanup.

Production was not modified and no patient record was submitted. Live verification was blocked by network/browser availability, not evidence of an outage.
