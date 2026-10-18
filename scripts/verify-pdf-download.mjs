import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const [input, format, outputDir] = process.argv.slice(2);
assert(input && ['desktop', 'mobile'].includes(format) && outputDir,
    'Usage: node scripts/verify-pdf-download.mjs FILE desktop|mobile OUTPUT_DIR');
const bytes = await readFile(input);
assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
assert(bytes.subarray(-1024).toString().includes('%%EOF'), 'PDF must have an end marker');
const parser = new PDFParse({ data: bytes });
try {
    const info = await parser.getInfo({ parsePageInfo: true });
    assert(info.total > 1, 'The synthetic treatment must contain multiple pages');
    const [width, height] = format === 'mobile' ? [120 * 72 / 25.4, 213 * 72 / 25.4] : [595.28, 841.89];
    // Chromium rounds CSS paper dimensions to fractions of a point (<0.18 mm).
    for (const page of info.pages) {
        assert(Math.abs(page.width - width) < 0.5, `Unexpected width: ${page.width}`);
        assert(Math.abs(page.height - height) < 0.5, `Unexpected height: ${page.height}`);
    }
    assert(info.pages.some(page => page.links.some(link => link.url === 'https://example.com/pdf-test')),
        'The treatment link must remain clickable');
    const render = await parser.getScreenshot({ desiredWidth: 1400, imageDataUrl: false });
    assert.equal(render.pages.length, info.total, 'Every page must render');
    await mkdir(outputDir, { recursive: true });
    for (const page of render.pages) {
        assert(page.data.byteLength > 1000, `Empty rendered page ${page.pageNumber}`);
        const image = await loadImage(page.data);
        const sample = createCanvas(256, 256);
        const ctx = sample.getContext('2d');
        ctx.drawImage(image, 0, 0, 256, 256);
        const pixels = ctx.getImageData(0, 0, 256, 256).data;
        let ink = 0;
        for (let index = 0; index < pixels.length; index += 4) {
            if (pixels[index + 3] > 10 && Math.min(pixels[index], pixels[index + 1], pixels[index + 2]) < 235) ink++;
        }
        assert(ink > 4, `Rendered page ${page.pageNumber} is blank`);
        await writeFile(join(outputDir, `page-${page.pageNumber}.png`), page.data);
    }
    const sheet = createCanvas(700 * 2, Math.ceil(render.pages.length / 2) * 1030);
    const sheetCtx = sheet.getContext('2d');
    sheetCtx.fillStyle = '#e7e7e7';
    sheetCtx.fillRect(0, 0, sheet.width, sheet.height);
    for (const [index, page] of render.pages.entries()) {
        const image = await loadImage(page.data);
        const height = Math.min(990, image.height);
        const width = image.width * height / image.height;
        const x = index % 2 * 700;
        const y = Math.floor(index / 2) * 1030;
        sheetCtx.drawImage(image, x + (700 - width) / 2, y, width, height);
        sheetCtx.fillStyle = '#222222';
        sheetCtx.font = '18px sans-serif';
        sheetCtx.fillText(`Página ${page.pageNumber}`, x + 12, y + 1015);
    }
    await writeFile(join(outputDir, 'contact-sheet.png'), await sheet.encode('png'));
    const report = {
        file: basename(input), bytes: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        pages: info.total, format, width, height,
        linkPresent: true, renderedPages: render.pages.length,
        producer: info.info?.Producer,
    };
    await writeFile(join(outputDir, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
} finally {
    await parser.destroy();
}
