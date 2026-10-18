import { toSvg } from 'html-to-image';

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
        const image = new Image();
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
        await image.decode();
        const ratio = options.pixelRatio || window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        canvas.width = (options.canvasWidth || Number(svg.documentElement.getAttribute('width'))) * ratio;
        canvas.height = (options.canvasHeight || Number(svg.documentElement.getAttribute('height'))) * ratio;
        if (!canvas.width || !canvas.height || canvas.width > 16384 || canvas.height > 16384 || canvas.width * canvas.height > 50_000_000) {
            throw new Error('La página supera el tamaño de captura permitido.');
        }
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No se pudo crear la captura del PDF.');
        context.fillStyle = options.backgroundColor || '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
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
