// Own the isolated Vite/API stub; never start the real backend. Synthetic fixtures only.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
const { server } = await import('../scripts/test-pdf-preview.mjs');
let browser;
try {
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || puppeteer.executablePath(), headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const external = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().startsWith('https://example.invalid/')) external.push(request.url()); });
    for (const width of [375, 768]) {
        await page.setViewport({ width, height: 860, deviceScaleFactor: 1 });
        await page.goto('http://localhost:4179/tests/consultation-notes-fixture.html', { waitUntil: 'networkidle0' });
        const button = await page.$('button[aria-controls]');
        assert.equal(await button.evaluate(el => el.getAttribute('aria-expanded')), 'false');
        await button.focus();
        await page.keyboard.press('Space');
        assert.equal(await button.evaluate(el => el.getAttribute('aria-expanded')), 'true');
        await page.waitForSelector('details summary');
        assert.ok(await page.$eval('body', el => el.innerText.includes('Objetivo de prueba')));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal page overflow');
        assert.equal(await page.evaluate(() => Boolean(window.__unsafe)), false);
        assert.equal((await page.$$('section img, section script, section iframe, section a')).length, 0);
        const first = await page.$('details');
        assert.equal(await first.evaluate(el => el.open), true);
        await first.$eval('summary', el => el.focus());
        await page.keyboard.press('Enter');
        assert.equal(await first.evaluate(el => el.open), false);
        await page.keyboard.press('Enter');
        assert.equal(await first.evaluate(el => el.open), true);
        assert.ok(await page.$eval('div[id][class*="max-h-"]', el => el.scrollHeight > el.clientHeight), 'long notes scroll');
        await page.screenshot({ path: `/tmp/consultation-notes-${width}.png`, fullPage: true });
        await button.click();
        assert.equal(await button.evaluate(el => el.getAttribute('aria-expanded')), 'false');
    }
    await page.goto('http://localhost:4179/tests/consultation-notes-fixture.html?legacy', { waitUntil: 'networkidle0' });
    await page.click('button[aria-controls]');
    assert.ok(await page.$eval('body', el => el.innerText.includes('Objetivo ficticio conservado.') && el.innerText.includes('nota antigua')));
    await page.goto('http://localhost:4179/tests/consultation-notes-fixture.html?empty', { waitUntil: 'networkidle0' });
    await page.click('button[aria-controls]');
    assert.ok(await page.$eval('body', el => el.innerText.includes('No hay propósito de consulta registrado') && el.innerText.includes('No hay nota general ni tratamiento indicado')));
    // Integration: the actual editor uses the new component and its toggle.
    await page.goto('http://localhost:4179/tests/pdf-fixture.html', { waitUntil: 'networkidle0' });
    await page.click('button[aria-controls]');
    assert.ok(await page.$eval('section[aria-label="Notas de consulta"]', el => el.innerText.includes('Texto de prueba: áéíóú, ñ y enlaces.') && el.innerText.includes('No hay propósito de consulta registrado')));
    const status = await page.evaluate(() => fetch('/__pdf-test-status').then(response => response.json()));
    assert.equal(status.blockedWrites, 0);
    assert.equal(status.printRequests, 0);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    console.log('PASS: 375/768px, keyboard toggles, scrolling, no overflow, legacy/empty purpose, actual editor integration, zero tracking requests, zero API writes/prints, zero page errors.');
    console.log('Screenshots: /tmp/consultation-notes-375.png and /tmp/consultation-notes-768.png');
} finally { await browser?.close(); await server.close(); }
