// Render the actual editor with real React hooks, effects and event handlers.
// PDF export, browser animation and all network access are isolated test doubles.
import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { build } from 'esbuild';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { createElement } from 'react';
import { create, act } from 'react-test-renderer';

const output = new URL('./.treatment-habits-compiled.mjs', import.meta.url);
const seed = JSON.parse(await readFile(new URL('../src/data/healthy-eating-habits.json', import.meta.url), 'utf8'));
const all = seed.map(h => h.name);
const subset = [all[1], all[0]]; // Preserve saved order, not just membership.
const base = {
    id: 'synthetic-record', title: 'Prueba sintética', date: '2026-11-12',
    diagnosis: 'Diagnóstico ficticio', patientDiagnosis: 'Diagnóstico ficticio',
    treatment: 'Indicación ficticia: ½ taza.', patientTreatment: 'Indicación ficticia: ½ taza.',
    lifestyle: '', patientLifestyle: '', dosha: 'Vata', herbs: [], categories: [], recipes: [],
    showHealthyEatingGuide: true, showRecipesSection: false,
};
const patient = {
    id: 'synthetic-patient', name: 'PRUEBA SIN DATOS PERSONALES', dosha: 'Vata',
    fullNotes: '', visits: [], treatmentPlans: [], symptomCalibrations: [], plainSymptoms: [],
};
function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value); Object.values(value).forEach(deepFreeze);
    }
    return value;
}
deepFreeze(patient);
const result = await build({
    entryPoints: ['src/components/patients/TreatmentPDFModal.tsx'], bundle: true,
    platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', write: false,
    define: { 'import.meta.env': JSON.stringify({ VITE_PROFESSIONAL_NAME: 'Equipo de prueba' }) },
    plugins: [{
        name: 'browser-only-test-doubles',
        setup(build) {
            build.onResolve({ filter: /framer-motion|pdfPreviewExport|pdfMobileExport/ }, args => ({ path: args.path, namespace: 'test-double' }));
            build.onLoad({ filter: /.*/, namespace: 'test-double' }, args => ({
                loader: 'js', resolveDir: process.cwd(), contents: args.path === 'framer-motion'
                    ? `import {createElement, Fragment} from 'react'; export const AnimatePresence = Fragment; export const motion = new Proxy({}, {get: (_, tag) => tag});`
                    : `export async function exportPreviewPdf(){throw Error('PDF disabled in synthetic test')}; export const exportMobilePdf = exportPreviewPdf;`,
            }));
        },
    }],
});
await writeFile(output, result.outputFiles[0].text);
const { TreatmentPDFModal } = await import(output.href);
await unlink(output);

await test('treatment habits: synthetic editor lifecycle and persistence payloads', async t => {
    const oldFetch = globalThis.fetch;
    const oldWindow = globalThis.window;
    const oldStorage = globalThis.localStorage;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.window = { isSecureContext: true };
    globalThis.localStorage = { getItem: () => null };
    const requests = [];
    let catalogue = seed;
    let pendingCatalogue;
    globalThis.fetch = async (url, options = {}) => {
        // No native fetch or real server is ever called.
        const method = options.method || 'GET';
        requests.push({ url, method, body: options.body ? JSON.parse(options.body) : undefined });
        if (method === 'GET') {
            assert.ok(['/api/healthy-habits', '/api/therapies'].includes(url), `unexpected GET: ${url}`);
            if (url === '/api/healthy-habits' && pendingCatalogue) return pendingCatalogue;
            return { ok: true, json: async () => ({ success: true, habits: catalogue, therapies: [] }) };
        }
        assert.match(url, /^\/api\/patients\/synthetic-patient\/(treatment-plans|visits)(\/synthetic-record)?$/);
        return { ok: true, json: async () => ({ success: true, plan: { id: 'synthetic-record' } }) };
    };
    mock.timers.enable({ apis: ['setTimeout'] });
    let renderer;
    const props = { isOpen: true, onClose() {}, patient, initialDiagnosis: null };
    const update = async overrides => {
        Object.assign(props, overrides);
        await act(async () => { renderer.update(createElement(TreatmentPDFModal, props)); });
    };
    const nodeText = node => typeof node === 'string' || typeof node === 'number' ? String(node) : node.children.map(nodeText).join('');
    const button = text => renderer.root.findAllByType('button').find(node => nodeText(node) === text);
    const click = async text => {
        assert.ok(button(text), `missing button: ${text}`);
        await act(async () => button(text).props.onClick());
    };
    const panel = () => renderer.root.findByProps({ children: 'Hábitos para comer saludablemente' }).parent.parent;
    const inputs = () => panel().findAllByType('input').filter(node => node.props.type === 'checkbox');
    const selected = () => inputs().filter(node => node.props.checked).map(node => node.parent.findAllByType('span')[0].children.join(''));
    const expectSelected = (names, total = names.length) => {
        assert.deepEqual(selected(), catalogue.map(h => h.name).filter(name => names.includes(name)));
        assert.ok(panel().findAllByType('span').some(node => node.children.join('') === `${total} seleccionados`));
    };
    const autosave = async () => {
        await act(async () => { mock.timers.tick(1600); });
        return requests.filter(r => r.method !== 'GET').at(-1)?.body;
    };
    try {
        await t.test('new treatment starts empty; late catalogue refresh stays empty', async () => {
            let resolveCatalogue;
            pendingCatalogue = new Promise(resolve => { resolveCatalogue = resolve; });
            await act(async () => { renderer = create(createElement(TreatmentPDFModal, props)); });
            await click('Comida');
            const initiallySelected = selected();
            catalogue = [...seed, { name: 'Plantilla sintética nueva', text: 'Texto ficticio' }];
            await act(async () => resolveCatalogue({ ok: true, json: async () => ({ success: true, habits: catalogue }) }));
            pendingCatalogue = undefined;
            assert.deepEqual(initiallySelected, [], 'new treatment must initially have no habits');
            expectSelected([]);
            assert.equal(inputs().length, catalogue.length);
            const body = await autosave();
            assert.deepEqual(body.healthyEatingHabits, []);
            assert.deepEqual(body.healthyEatingHabitDetails, []);
        });
        await t.test('manual selection and select all/none; parent refresh preserves edits', async () => {
            await act(async () => inputs()[0].props.onChange());
            expectSelected([all[0]]);
            await update({ patient: { ...patient } });
            expectSelected([all[0]]);
            assert.deepEqual((await autosave()).healthyEatingHabits, [all[0]]);
            await click('Seleccionar todos');
            assert.equal(selected().length, catalogue.length);
            await click('Ninguno');
            expectSelected([]);
            assert.deepEqual((await autosave()).healthyEatingHabits, []);
        });
        const cases = [
            ['subset', subset, true], ['all', all, true], ['empty', [], true],
            ['legacy', undefined, true], ['null', null, true],
            ['hidden', subset, false], ['unknown', [...subset, 'Hábito guardado fuera del catálogo'], true],
        ];
        for (const type of ['plan', 'visit']) for (const [name, habits, visible] of cases) {
            await t.test(`saved ${type}/${name}: reopen, refresh and frozen source`, async () => {
                const record = deepFreeze({ ...base, id: 'synthetic-record', showHealthyEatingGuide: visible,
                    ...(name === 'legacy' ? {} : { healthyEatingHabits: habits }) });
                const snapshot = JSON.stringify(record);
                // Closing clears the record identity guard, just like the real parent.
                await update({ isOpen: false });
                await update({ isOpen: true, editingRecord: { type, record } });
                const names = Array.isArray(habits) ? habits : [];
                expectSelected(names, names.length);
                await update({ patient: { ...patient } });
                expectSelected(names, names.length);
                await update({ isOpen: false });
                await update({ isOpen: true });
                expectSelected(names, names.length);
                const body = await autosave();
                assert.deepEqual(body.healthyEatingHabits, visible ? names : []);
                assert.equal(body.treatment, base.treatment);
                assert.equal(JSON.stringify(record), snapshot, 'never mutate the saved record');
            });
        }
        await t.test('switching from existing to new and reopening resets to empty', async () => {
            await update({ editingRecord: undefined });
            expectSelected([]);
            await update({ isOpen: false });
            await update({ isOpen: true });
            expectSelected([]);
        });
    } finally {
        if (renderer) await act(async () => renderer.unmount());
        mock.timers.reset();
        globalThis.fetch = oldFetch;
        globalThis.window = oldWindow;
        globalThis.localStorage = oldStorage;
        delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    }
    console.log(`Synthetic requests: ${requests.length}; native network calls: 0; clinical writes: 0.`);
});
