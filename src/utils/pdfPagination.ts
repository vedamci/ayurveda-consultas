export interface PdfVerticalRange {
    top: number;
    bottom: number;
}

// Los bloques mayores que una hoja se dividen por sus líneas, nunca se
// empujan enteros a la siguiente página. Cada tramo cubre contenido nuevo.
export function paginatePdfContent(
    contentHeight: number,
    pageHeight: number,
    protectedRanges: PdfVerticalRange[],
    firstPageHeight: number = pageHeight
): PdfVerticalRange[] {
    if (!Number.isFinite(contentHeight) || !Number.isFinite(pageHeight)
        || !Number.isFinite(firstPageHeight)
        || contentHeight <= 0 || pageHeight <= 0 || firstPageHeight <= 0) {
        throw new Error('Las dimensiones del contenido PDF no son válidas.');
    }
    const ranges = protectedRanges.filter(range => Number.isFinite(range.top)
        && Number.isFinite(range.bottom) && range.bottom > range.top
        && range.bottom - range.top <= pageHeight);
    const pages: PdfVerticalRange[] = [];
    let top = 0;
    while (top < contentHeight) {
        const limit = Math.min(top + (pages.length === 0 ? firstPageHeight : pageHeight), contentHeight);
        let bottom = limit;
        if (bottom < contentHeight) {
            let previous: number;
            do {
                previous = bottom;
                for (const range of ranges) {
                    if (range.top < bottom && range.bottom > bottom) {
                        bottom = Math.min(bottom, range.top);
                    }
                }
            } while (bottom < previous && bottom > top);
        }
        // Protección contra intervalos superpuestos que abarcan más de una hoja.
        if (bottom <= top) bottom = limit;
        pages.push({ top, bottom });
        top = bottom;
    }
    return pages;
}

export function collectPdfProtectedRanges(root: HTMLElement): PdfVerticalRange[] {
    const rootTop = root.getBoundingClientRect().top;
    const ranges: PdfVerticalRange[] = [];
    const textLines: { node: Node; rect: DOMRect }[] = [];
    const addRect = (rect: DOMRect, padding = 1) => {
        if (rect.width > 0 && rect.height > 0) {
            ranges.push({ top: Math.max(0, rect.top - rootTop - padding), bottom: rect.bottom - rootTop + padding });
        }
    };
    // Range devuelve un rectángulo por línea, incluso dentro de párrafos largos.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node: Node | null;
    while ((node = walker.nextNode())) {
        if (!node.textContent?.trim()) continue;
        range.selectNodeContents(node);
        Array.from(range.getClientRects()).forEach(rect => {
            addRect(rect);
            if (rect.width > 0 && rect.height > 0) textLines.push({ node: node!, rect });
        });
    }
    // Keep a heading with the first visible line that follows it, including
    // when wrappers or decorative elements sit between the two. Protecting
    // just this first line still lets an oversized paragraph split normally.
    root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, .pdf-header-border').forEach(heading => {
        const headingRect = heading.getBoundingClientRect();
        if (headingRect.width <= 0 || headingRect.height <= 0) return;
        const nextLine = textLines.find(line => !heading.contains(line.node)
            && Boolean(heading.compareDocumentPosition(line.node) & Node.DOCUMENT_POSITION_FOLLOWING)
            && line.rect.top >= headingRect.bottom - 1);
        if (nextLine) {
            ranges.push({
                top: Math.max(0, headingRect.top - rootTop - 1),
                bottom: nextLine.rect.bottom - rootTop + 1,
            });
        }
    });
    root.querySelectorAll<HTMLElement>('img, svg, .pdf-chip, h1, h2, h3, h4, h5, h6, p, tr, li, .print-avoid, .print-flow-footer')
        .forEach(element => {
            // La tabla exterior es el documento completo, no una fila de datos.
            if (element.matches('.print-layout-table > tbody > tr, .print-layout-table > tfoot > tr')) return;
            // Adjacent table rows share an edge. Padding would overlap their
            // ranges and force the whole table onto the following sheet.
            addRect(element.getBoundingClientRect(), element.matches('tr') ? 0 : 1);
        });
    return ranges;
}

// Serializar el DOM con su CSS conserva las medidas y fuentes usadas para
// paginar. Una captura que recalcula los estilos puede cambiar los saltos.
export async function rasterizePdfViewport(viewport: HTMLElement, width: number, height: number): Promise<string> {
    const clone = viewport.cloneNode(true) as HTMLElement;
    Object.assign(clone.style, { position: 'relative', left: '0', top: '0', zIndex: '0' });
    const html = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * 2.25);
    canvas.height = Math.ceil(height * 2.25);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la página del PDF.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.98);
}
