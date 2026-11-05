import { toSvg } from 'html-to-image';
import { PDF_FONT_WEIGHTS } from './pdfFonts';

const svgNamespace = 'http://www.w3.org/2000/svg';
const fontSampleWidth = 28;
const fontStripHeight = 24;

// WebKit can decode the outer SVG before it paints the embedded fonts.
// Keep these samples outside the exported page and wait for each face to paint.
async function decodePdfImage(svg: Document, width: number, height: number): Promise<HTMLImageElement> {
    const root = svg.documentElement;
    root.setAttribute('height', String(height + fontStripHeight));
    root.setAttribute('viewBox', `0 0 ${width} ${height + fontStripHeight}`);
    svg.querySelector('foreignObject')?.setAttribute('height', String(height));
    PDF_FONT_WEIGHTS.forEach(({ family, weight }, index) => {
        const sample = svg.createElementNS(svgNamespace, 'text');
        sample.setAttribute('x', String(index * fontSampleWidth));
        sample.setAttribute('y', String(height + 18));
        sample.setAttribute('style', `font-family:${family};font-weight:${weight};font-size:16px;fill:black`);
        sample.textContent = 'M';
        root.appendChild(sample);
    });

    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = PDF_FONT_WEIGHTS.length * fontSampleWidth;
    canvas.height = fontStripHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('No se pudo comprobar la tipografía del PDF.');

    const deadline = performance.now() + 1500;
    do {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, height, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const visibleFaces = new Set<number>();
        for (let index = 3; index < pixels.length; index += 4) {
            if (pixels[index] <= 180) continue;
            const x = Math.floor(index / 4) % canvas.width;
            visibleFaces.add(Math.floor(x / fontSampleWidth));
        }
        if (visibleFaces.size === PDF_FONT_WEIGHTS.length) return image;
        await new Promise<void>(resolve => setTimeout(resolve, 16));
    } while (performance.now() < deadline);
    throw new Error('No se pudo dibujar todo el texto del PDF. Vuelve a intentar la descarga.');
}

// html-to-image 1.11 floors every font-size and subtracts 0.1px while cloning.
// That changes wrapping (and column pagination). Inline the exact computed
// sizes, omit the library's font-size conversion, then restore the editor.
// Restore natural paragraph heights in the SVG clone: freezing the used height
// changes margin collapsing around images and fragmented paragraphs.
export async function capturePdfPage(node: HTMLElement, options: NonNullable<Parameters<typeof toSvg>[1]> = {}): Promise<string> {
    const elements = [node, ...Array.from(node.querySelectorAll('*'))]
        .filter((element): element is HTMLElement | SVGElement => 'style' in element);
    const originals = elements.map(element => ({
        element,
        value: element.style.getPropertyValue('font-size'),
        priority: element.style.getPropertyPriority('font-size'),
        computed: getComputedStyle(element).fontSize,
    }));
    const properties = Array.from(getComputedStyle(node)).filter(name => !['font-size', 'font'].includes(name));
    try {
        originals.forEach(({ element, computed }) => element.style.setProperty('font-size', computed));
        const encoded = await toSvg(node, { ...options, includeStyleProperties: properties });
        const svg = new DOMParser().parseFromString(decodeURIComponent(encoded.slice(encoded.indexOf(',') + 1)), 'image/svg+xml');
        if (svg.querySelector('parsererror')) throw new Error('No se pudo preparar la captura del PDF.');
        svg.querySelectorAll('foreignObject p').forEach(paragraph => {
            const element = paragraph as HTMLElement;
            element.style.height = 'auto';
            element.style.blockSize = 'auto';
        });
        // A flex row's text wrapper normally sizes itself from its contents.
        // Freezing its used width (rounded to 1/64 px) can wrap the last glyph
        // in SVG and overlap the next row. Let those inline text wrappers lay
        // themselves out again; retain explicit widths and structural boxes.
        svg.querySelectorAll('foreignObject div, foreignObject span').forEach(node => {
            const element = node as HTMLElement;
            const parent = element.parentElement;
            if (!parent || !['flex', 'inline-flex'].includes(parent.style.display)
                || !element.textContent?.trim()
                || Array.from(element.classList).some(name => /^(w-|min-w-|max-w-)/.test(name))
                || Array.from(element.children).some(child => !['inline', 'inline-block'].includes((child as HTMLElement).style.display))) return;
            element.style.width = 'auto';
            element.style.inlineSize = 'auto';
            element.style.height = 'auto';
            element.style.blockSize = 'auto';
        });
        // Older WebKit can omit HTML images inside the SVG. The equivalent
        // SVG image keeps the embedded bytes and the already computed box.
        svg.querySelectorAll('foreignObject img').forEach(element => {
            const src = element.getAttribute('src');
            if (!src?.startsWith('data:image/')) return;
            const inline = svg.createElementNS(svgNamespace, 'svg');
            const picture = svg.createElementNS(svgNamespace, 'image');
            picture.setAttributeNS('http://www.w3.org/1999/xlink', 'href', src);
            picture.setAttribute('width', '100%');
            picture.setAttribute('height', '100%');
            inline.setAttribute('style', element.getAttribute('style') || '');
            inline.appendChild(picture);
            element.replaceWith(inline);
        });
        const imageWidth = Number(svg.documentElement.getAttribute('width'));
        const imageHeight = Number(svg.documentElement.getAttribute('height'));
        const ratio = options.pixelRatio || window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        canvas.width = (options.canvasWidth || imageWidth) * ratio;
        canvas.height = (options.canvasHeight || imageHeight) * ratio;
        if (!canvas.width || !canvas.height || canvas.width > 16384 || canvas.height > 16384 || canvas.width * canvas.height > 50_000_000) {
            throw new Error('La página supera el tamaño de captura permitido.');
        }
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No se pudo crear la captura del PDF.');
        const image = await decodePdfImage(svg, imageWidth, imageHeight);
        context.fillStyle = options.backgroundColor || '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, imageWidth, imageHeight, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', options.quality || 1);
    } finally {
        originals.forEach(({ element, value, priority }) => {
            if (value) element.style.setProperty('font-size', value, priority);
            else element.style.removeProperty('font-size');
        });
    }
}

// Some engines return a valid white JPEG instead of rejecting an SVG capture.
// Reject that result before packaging and downloading an apparently valid PDF.
export async function assertCapturedPageHasInk(dataUrl: string): Promise<void> {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo comprobar la captura del PDF.');
    context.drawImage(image, 0, 0, 256, 256);
    const pixels = context.getImageData(0, 0, 256, 256).data;
    let ink = 0;
    for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] > 10 && Math.min(pixels[index], pixels[index + 1], pixels[index + 2]) < 235) ink++;
    }
    if (ink <= 4) throw new Error('La captura de una página del PDF salió vacía.');
}
