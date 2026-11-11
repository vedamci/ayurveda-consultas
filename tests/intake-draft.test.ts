import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeIntakeDraft, decodeIntakeDraft, DRAFT_MAX_AGE_MS } from '../src/utils/intakeDraft.ts';
const defaults = { patientName: '', email: '', symptoms: [] as string[], symptomCalibrations: {}, consent: false, dataProtection: false, recordingConsent: '', studentListeners: '', professionalNotes: '' };
const fixture = { ...defaults, patientName: 'Prueba ficticia', symptoms: ['Ansiedad'], symptomCalibrations: { Ansiedad: { frequency: 'Diaria', intensity: 10 } }, consent: true, professionalNotes: 'PRIVATE', recordingConsent: 'yes' };
test('round trips ten-point intensity without retaining notes or consent', () => {
 const raw = encodeIntakeDraft(fixture, 1000);
 assert.ok(!raw.includes('PRIVATE'));
 const result = decodeIntakeDraft(raw, defaults, 2000)!;
 assert.equal(result.patientName, fixture.patientName);
 assert.deepEqual(result.symptomCalibrations, fixture.symptomCalibrations);
 assert.equal(result.consent, false);
 assert.equal(result.recordingConsent, '');
});
test('rejects malformed, expired, future and unknown-version drafts', () => {
 assert.equal(decodeIntakeDraft('{', defaults), null);
 assert.equal(decodeIntakeDraft(encodeIntakeDraft(fixture, 1000), defaults, DRAFT_MAX_AGE_MS + 1001), null);
 assert.equal(decodeIntakeDraft(encodeIntakeDraft(fixture, 2000), defaults, 1000), null);
 assert.equal(decodeIntakeDraft('{"version":2,"savedAt":1000,"data":{}}', defaults, 1000), null);
});
test('ignores unknown fields, wrong types, invalid calibrations and forged consent', () => {
 const raw = JSON.stringify({ version: 1, savedAt: 1000, data: { patientName: 42, symptoms: ['Ansiedad'], symptomCalibrations: { Ansiedad: { frequency: 'Diaria', intensity: 11 } }, consent: true, professionalNotes: 'PRIVATE', extra: 'unknown' } });
 const result = decodeIntakeDraft(raw, defaults, 1000)!;
 assert.equal(result.patientName, '');
 assert.deepEqual(result.symptomCalibrations, {});
 assert.deepEqual(result.symptoms, []);
 assert.equal(result.consent, false);
 assert.equal('extra' in result, false);
});
