// Synthetic text only. No backend, IDs, credentials or clinical records.
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { writeFile, unlink } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const output = new URL('./.consultation-notes-test.mjs', import.meta.url);
try {
    const result = await build({ stdin: { contents: `export * from './src/utils/consultationNotes'; export * from './src/components/patients/ConsultationNotes';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', write: false });
    await writeFile(output, result.outputFiles[0].text);
    const { consultationNoteSections: split, consultationPurpose: purpose, ConsultationNotes: View, ConsultationNoteMarkdown: Markdown } = await import(output.href);
    const render = text => renderToStaticMarkup(createElement(Markdown, { text }));
    const cases = [
        '', '   ', 'Nota antigua sin encabezados.\nSegunda línea: ½ taza, 0.25 g; 25 minutos.',
        'Introducción intacta.\n\n## Antecedentes\nTexto A\n\n### Seguimiento\nTexto B',
        '**Salud y Antecedentes**\n- Motivo Consulta: Prueba ficticia\n\n**Detalles Dieta**\n- Cantidad: ½ taza\n\n**Observaciones Adicionales**: Texto completo',
        '__Salud:__ texto en línea\n\n**Salud**\nSección repetida',
        'Título Setext\n===\nTexto\n\nSegundo\n---\nTexto',
        '```md\n## NO es categoría\n**Etiqueta**\n```\n\n## Real\nTexto',
        '> ## Dentro de cita\n> Texto\n\n- **Elemento**\n  ## Dentro de lista\n\n## Real\nTexto',
        '[Primera referencia][r]\n\n| Campo | Valor |\n|---|---|\n| **Dosis** | 0.25 g |\n\n## Real\n[Referencia][r]\n\n[r]: https://example.invalid/reference',
        '\r\n**Categoría**\r\n- A: 1–2; ½ taza\r\n\r\n**Otra**\r\nTexto final\r\n',
        '**No aumentar** la cantidad.\nConservar toda la frase.',
    ];
    for (const text of cases) {
        const sections = split(text);
        assert.equal(sections.map(section => section.source).join(''), text.trim() ? text : '', 'every source character preserved');
        for (const section of sections) { render(section.title); render(section.markdown); }
    }
    assert.deepEqual(split(cases[4]).map(s => s.title), ['Salud y Antecedentes', 'Detalles Dieta', 'Observaciones Adicionales']);
    assert.equal(split(cases[7]).length, 2, 'fenced headings stay inside code');
    assert.equal(split(cases[8]).length, 2, 'nested headings stay inside lists/quotes');
    assert.equal(split(cases[11])[0].title, 'Nota general', 'emphasized sentence is not a category');
    assert.ok(split(cases[9]).every(section => render(section.markdown).includes('https://example.invalid/reference')), 'reference definitions work across sections');
    const headingReference = split('## [Categoría con referencia][r]\nTexto intacto.\n\n[r]: https://example.invalid/categoria')[0];
    assert.ok(render(headingReference.title).includes('https://example.invalid/categoria'), 'heading references remain readable');
    const clinicalData = { 'Propósito de Consulta': '**Objetivo ficticio**\nSegunda línea.' };
    const patient = { fullNotes: cases[4], clinicalData };
    const record = { note: '## Nota de visita\nTexto de visita íntegro.', treatment: '### Fórmula ficticia\n1. Conservar **0.25 g** y ½ taza.\n2. Conservar 1–2 veces; 25 minutos.' };
    const before = JSON.stringify({ patient, record });
    const html = renderToStaticMarkup(createElement(View, { patient, record, expanded: true, onToggle() {} }));
    assert.ok(html.includes('<strong>Objetivo ficticio</strong>'));
    assert.ok(html.includes('Nota de visita') && html.includes('Texto de visita íntegro.'));
    assert.ok(!html.includes('Prueba ficticia'), 'visit note retains precedence over intake fallback');
    assert.ok(html.includes('<ol>') && html.includes('<strong>0.25 g</strong>') && html.includes('½ taza') && html.includes('1–2 veces; 25 minutos.'));
    assert.equal(JSON.stringify({ patient, record }), before, 'rendering never mutates data');
    assert.equal(purpose(patient).text, clinicalData['Propósito de Consulta']);
    assert.equal(purpose({ fullNotes: cases[4] }).text, 'Prueba ficticia');
    assert.equal(purpose({ fullNotes: '- Motivo Consulta: Primera línea\nContinúa aquí\n- Alergias: Otro campo' }).text, 'Primera línea\nContinúa aquí');
    assert.equal(purpose({ fullNotes: 'Texto sobre consulta sin campo real.' }), null);
    assert.equal(purpose({ fullNotes: '```md\n- Motivo Consulta: No es un campo\n```' }), null);
    assert.equal(purpose({ fullNotes: '> - Motivo Consulta: No es un campo' }), null);
    assert.equal(purpose({ fullNotes: '- Motivo Consulta:  \n- Alergias: Prueba' }), null);
    const empty = renderToStaticMarkup(createElement(View, { patient: { fullNotes: '' }, expanded: true, onToggle() {} }));
    assert.ok(empty.includes('No hay propósito de consulta registrado') && empty.includes('No hay nota general ni tratamiento indicado'));
    const legacy = renderToStaticMarkup(createElement(View, { patient: { fullNotes: cases[4] }, expanded: true, onToggle() {} }));
    assert.ok(legacy.includes('nota antigua') && legacy.includes('Detalles Dieta'));
    const hostile = render('<script>globalThis.__unsafe = true</script>\n\n<img src=x onerror=unsafe()>\n\n![Imagen ficticia](https://example.invalid/tracker)\n\n[Malicioso](javascript:unsafe())\n\n[Documento](https://example.invalid/documento)');
    assert.ok(!/<(?:script|img|iframe)\b|<[a-z][^>]*\s(?:onerror|href|src)=/.test(hostile));
    assert.ok(hostile.includes('&lt;script&gt;') && hostile.includes('Imagen ficticia') && hostile.includes('Malicioso') && hostile.includes('https://example.invalid/documento'));
    assert.ok(render('| Dato | Cantidad |\n|---|---|\n| Prueba | ½ taza |').includes('<table'));
    console.log('PASS: 12 old/current Markdown cases, exact source and quantities, cross-category references, purpose precedence/absence, nonmutation, tables and inert HTML/URLs/images.');
} finally { await unlink(output).catch(() => {}); }
