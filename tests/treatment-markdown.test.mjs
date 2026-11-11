// Synthetic recommendations only. Bundles JSX with the same automatic runtime as Vite.
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { writeFile, unlink } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const output = new URL('./.treatment-markdown-test.mjs', import.meta.url);
try {
    const result = await build({ entryPoints: ['src/components/patients/SavedRecommendations.tsx'], bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', write: false });
    await writeFile(output, result.outputFiles[0].text);
    const { SavedRecommendations } = await import(output.href);
    const recipe = '**Receta de prueba:** conserva ½ taza y 25 minutos.\n\n1. Primer paso ficticio.\n2. Segundo paso ficticio.\n\n### Indicaciones de prueba\n\n- Indicación A\n- Indicación B\n\n<script>unsafe()</script>';
    const plan = { id:'synthetic', date:'2026-11-01', diagnosis:'', treatment:recipe, lifestyle:'', dosha:'', herbs:[], categories:[] };
    const before = JSON.stringify(plan);
    const html = renderToStaticMarkup(createElement(SavedRecommendations, {plans:[plan],visits:[],date:'2026-11-11'}));
    assert.ok(html.includes('<strong>Receta de prueba:</strong>'));
    assert.ok(!/<details[^>]*\sopen(?:[= >])/.test(html), 'details start collapsed');
    assert.ok(html.includes('Ver detalle completo'));
    assert.ok(html.includes('Ocultar detalle'));
    assert.ok(html.includes('<ol>') && html.includes('<ul>'));
    assert.ok(html.includes('½ taza y 25 minutos.'));
    assert.ok(html.includes('Primer paso ficticio.') && html.includes('Segundo paso ficticio.'));
    assert.ok(!html.includes('<script>unsafe()'));
    assert.ok(html.includes('&lt;script&gt;unsafe()&lt;/script&gt;'));
    assert.equal(JSON.stringify(plan), before, 'presentation must never mutate source');
    console.log('PASS: bold headings, ordered/unordered steps, exact quantities, escaped HTML, unchanged source.');
} finally { await unlink(output).catch(()=>{}); }
