import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIntake, intakeScaleFromNotes, cacheCreatedIntakeScale } from '../server/intakeValidation.js';
const fixture = () => ({ patientName: ' Persona de prueba ', email: ' prueba@example.invalid ', phone: '+52 33 0000 0000', consent: true, dataProtection: true, intensityScale: 10,
    symptomCalibrations: { 'Síntoma ficticio': { frequency: 'Diaria', intensity: 10 } } });
test('accepts 1–10 and trims contact fields without changing source', () => {
    const original = fixture(); const { value } = validateIntake(original);
    assert.equal(value.patientName, 'Persona de prueba'); assert.equal(value.email, 'prueba@example.invalid');
    assert.equal(value.intensityScale, 10); assert.equal(original.patientName, ' Persona de prueba ');
});
test('legacy callers remain on 1–3', () => {
    const body = fixture(); delete body.intensityScale;
    body.symptomCalibrations['Síntoma ficticio'].intensity = 3; assert.equal(validateIntake(body).value.intensityScale, 3);
    body.symptomCalibrations['Síntoma ficticio'].intensity = 4; assert.ok(validateIntake(body).error);
});
for (const value of [null, false, 'true', undefined]) test(`requires real informed consent (${String(value)})`, () => {
    assert.ok(validateIntake({ ...fixture(), consent: value }).error); assert.ok(validateIntake({ ...fixture(), dataProtection: value }).error);
});
for (const value of [0, 11, -1, 1.5, '5', null]) test(`rejects invalid intensity ${String(value)}`, () => {
    const body = fixture(); body.symptomCalibrations['Síntoma ficticio'].intensity = value; assert.ok(validateIntake(body).error);
});
test('requires valid contact data', () => {
    for (const patch of [{ patientName: '  ' }, { email: 'wrong' }, { phone: 'abc' }, { phone: '1' }, { email: {} }]) assert.ok(validateIntake({ ...fixture(), ...patch }).error);
});
test('rejects invalid payload and calibration structure', () => {
    for (const body of [null, [], 'wrong']) assert.ok(validateIntake(body).error);
    for (const patch of [{ intensityScale: 7 }, { intensityScale: '10' }, { symptomCalibrations: [] }, { symptomCalibrations: { foo: null } }, { symptomCalibrations: { foo: { intensity: 4, frequency: 'other' } } }]) assert.ok(validateIntake({ ...fixture(), ...patch }).error);
});
test('Notion notes retain explicit scale, old notes stay on three', () => {
    assert.equal(intakeScaleFromNotes('header\nEscala de intensidad de ingreso: 10\n\nbody'), 10);
    assert.equal(intakeScaleFromNotes('Escala de intensidad de ingreso: 3'), 3);
    assert.equal(intakeScaleFromNotes('Intensidad: 10 (Fuerte)'), 3);
    assert.equal(intakeScaleFromNotes('Escala de intensidad de ingreso: 100'), 3);
});
test('cache success persists the selected scale exactly once', async () => {
    const calls = []; assert.equal(await cacheCreatedIntakeScale('fake-id', 10, (...args) => calls.push(args)), true);
    assert.deepEqual(calls, [['fake-id', 10]]);
});
test('cache failure after Notion commit does not fail or repeat the submission', async () => {
    let calls = 0; const warnings = [];
    const result = await cacheCreatedIntakeScale('fake-id', 10, () => { calls++; throw new Error('disk unavailable'); }, message => warnings.push(message));
    assert.equal(result, false); assert.equal(calls, 1); assert.equal(warnings.length, 1); assert.ok(!warnings[0].includes('fake-id'));
});
