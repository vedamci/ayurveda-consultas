// Test-only alias. Compare the SVG's typography against the live browser DOM.
import { toSvg as originalToSvg } from '../node_modules/html-to-image/es/index.js';

export async function toSvg(node: HTMLElement, options: Record<string, unknown> = {}) {
    const encoded = await originalToSvg(node, options);
    const svg = new DOMParser().parseFromString(decodeURIComponent(encoded.slice(encoded.indexOf(',') + 1)), 'image/svg+xml');
    const clonedText = Array.from(svg.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,li'));
    let compared = 0;
    for (const element of Array.from(node.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,li'))) {
        if (!element.textContent?.trim()) continue;
        const cloneIndex = clonedText.findIndex(candidate => candidate.tagName.toLowerCase() === element.tagName.toLowerCase()
            && candidate.textContent === element.textContent);
        const clone = cloneIndex >= 0 ? clonedText.splice(cloneIndex, 1)[0] : undefined;
        if (!clone) throw new Error('La captura perdió un bloque de texto.');
        const expected = getComputedStyle(element);
        if (clone.style.fontSize !== expected.fontSize || clone.style.fontFamily !== expected.fontFamily) {
            throw new Error(`La captura sustituyó la tipografía: ${expected.fontFamily} ${expected.fontSize} -> ${clone.style.fontFamily} ${clone.style.fontSize}`);
        }
        compared++;
    }
    const fonts = Array.from(document.fonts).filter(font => /Eczar|Mukta/.test(font.family))
        .map(font => ({ family: font.family, weight: font.weight, status: font.status }));
    for (const family of ['Eczar', 'Mukta']) {
        if (!fonts.some(font => font.family.includes(family) && font.status === 'loaded')) throw new Error(`Fuente no cargada: ${family}`);
    }
    const fontCss = String(options.fontEmbedCSS || '');
    if (!fontCss.includes('data:') || /https?:/.test(fontCss)) throw new Error('Las fuentes no están incluidas en la captura.');
    let evidence = document.getElementById('pdf-test-evidence');
    if (!evidence) {
        evidence = document.createElement('output');
        evidence.id = 'pdf-test-evidence';
        evidence.hidden = true;
        document.body.appendChild(evidence);
    }
    const previous = JSON.parse(evidence.textContent || '[]');
    evidence.textContent = JSON.stringify([...previous, { compared, fonts, embeddedFonts: true }]);
    return encoded;
}
