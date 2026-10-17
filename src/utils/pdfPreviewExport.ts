import { getFontEmbedCSS, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { collectPdfProtectedRanges, paginatePdfContent } from './pdfPagination';

type Progress = (progress: number, status?: string) => void;

function documentCss(): string {
    return Array.from(document.styleSheets).flatMap(sheet => {
        try {
            return Array.from(sheet.cssRules)
                .filter(rule => rule.type !== CSSRule.IMPORT_RULE)
                .map(rule => rule.cssText);
        } catch {
            // Cross-origin font rules are embedded separately below.
            return [];
        }
    }).join('\n');
}

async function embedImages(root: HTMLElement): Promise<void> {
    await Promise.all(Array.from(root.querySelectorAll('img')).map(async image => {
        if (!image.src.startsWith('data:')) {
            const response = await fetch(image.currentSrc || image.src);
            if (!response.ok) throw new Error('No se pudo cargar una imagen del documento.');
            const blob = await response.blob();
            image.src = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error('No se pudo preparar una imagen del documento.'));
                reader.readAsDataURL(blob);
            });
        }
        image.removeAttribute('srcset');
        await image.decode();
    }));
}

/** Reflow the editor cards at their original type size, sharing available A4 space. */
export async function exportPreviewPdf(container: HTMLElement, onProgress?: Progress): Promise<Uint8Array> {
    const cards = Array.from(container.querySelectorAll<HTMLElement>('.pdf-page'));
    if (!cards.length) throw new Error('No se encontraron páginas para exportar.');
    onProgress?.(15, 'Preparando el diseño de la vista previa...');
    await document.fonts.ready;
    await Promise.all(Array.from(container.querySelectorAll('img')).map(image => image.decode()));
    const width = cards[0].getBoundingClientRect().width;
    if (width <= 0) throw new Error('La vista previa no está lista para exportar.');
    const pageHeight = width * 297 / 210;
    const margin = width * 15 / 210;
    const sideMargin = width * 20 / 210;
    const gap = width * 4 / 210;
    const css = documentCss();
    // Do not use preferredFontFormat: html-to-image's global regex drops
    // alternating font sources, including Mukta Latin 400/600.
    const fontCss = await getFontEmbedCSS(container);
    const viewport = document.createElement('div');
    viewport.setAttribute('aria-hidden', 'true');
    Object.assign(viewport.style, {
        position: 'fixed', left: '0', top: '0', zIndex: '-1', pointerEvents: 'none',
        width: `${width}px`, height: `${pageHeight}px`, overflow: 'hidden', background: '#ffffff',
    });
    const context = container.cloneNode(false) as HTMLElement;
    Object.assign(context.style, {
        display: 'block', position: 'relative', width: `${width}px`, height: `${pageHeight}px`,
        minHeight: '0', maxHeight: 'none', padding: '0', margin: '0', border: '0', gap: '0',
        overflow: 'hidden', transform: 'none', background: '#ffffff', opacity: '1',
    });
    const style = document.createElement('style');
    style.textContent = css + '\n' + fontCss + '\n'
        + '#pdf-content table.pdf-continuation-table { width: 100% !important; margin: 0 !important; }';
    const flowWindow = document.createElement('div');
    Object.assign(flowWindow.style, { position: 'absolute', left: '0', width: `${width}px`, overflow: 'hidden' });
    const flow = document.createElement('div');
    Object.assign(flow.style, { position: 'relative', width: `${width}px`, display: 'flow-root' });
    flowWindow.appendChild(flow);
    const header = cards[0].querySelector<HTMLElement>('.pdf-header-border')?.cloneNode(true) as HTMLElement | undefined;
    const footer = cards[0].querySelector<HTMLElement>('.pdf-footer-border')?.cloneNode(true) as HTMLElement | undefined;
    for (const band of [header, footer]) {
        if (!band) continue;
        Object.assign(band.style, { position: 'absolute', left: `${sideMargin}px`, right: `${sideMargin}px`, margin: '0' });
        context.appendChild(band);
    }
    if (header) header.style.top = `${margin}px`;
    if (footer) footer.style.bottom = `${margin}px`;
    for (const [index, card] of cards.entries()) {
        const clone = card.cloneNode(true) as HTMLElement;
        Object.assign(clone.style, {
            width: `${width}px`, height: 'auto', minHeight: '0', maxHeight: 'none',
            paddingTop: '0', paddingBottom: index === cards.length - 1 ? '0' : `${gap}px`, margin: '0',
            boxShadow: 'none', transform: 'none', justifyContent: 'flex-start',
        });
        clone.querySelectorAll('.pdf-footer-border').forEach(element => element.remove());
        clone.querySelectorAll<HTMLElement>('.pdf-header-border').forEach(sectionHeader => {
            // The first child is the repeated logo. Keep the section metadata:
            // several cards have their only section title in this header.
            if (index === 0) { sectionHeader.remove(); return; }
            sectionHeader.firstElementChild?.remove();
            if (!sectionHeader.textContent?.trim()) { sectionHeader.remove(); return; }
            Object.assign(sectionHeader.style, { padding: '0', border: '0', margin: '0', display: 'block' });
            sectionHeader.classList.add('print-avoid');
            for (const child of Array.from(sectionHeader.children)) {
                if (child instanceof HTMLElement) child.style.textAlign = 'left';
            }
        });
        // Remove presentation-only minimum heights (not image/icon sizes).
        // In particular the recipes placeholder previously reserved 148 mm.
        clone.querySelectorAll<HTMLElement>('div').forEach(element => {
            if (Array.from(element.classList).some(name => name.startsWith('min-h-'))) element.style.minHeight = '0';
            if (element.classList.contains('flex-1')) {
                element.style.flexGrow = '0';
                element.style.flexBasis = 'auto';
            }
        });
        clone.querySelectorAll<HTMLElement>('.pdf-border-card').forEach(element => {
            if (!element.querySelector('table') && element.querySelector('.grid-cols-3')) {
                element.classList.add('print-avoid');
            }
        });
        flow.appendChild(clone);
    }
    context.appendChild(flowWindow);
    viewport.append(style, context);
    document.body.appendChild(viewport);
    try {
        await embedImages(context);
        await document.fonts.ready;
        const headerHeight = header?.getBoundingClientRect().height || 0;
        const footerHeight = footer?.getBoundingClientRect().height || 0;
        const bodyTop = margin + headerHeight + (header ? gap : 0);
        const bodyHeight = pageHeight - bodyTop - margin - footerHeight - (footer ? gap : 0);
        if (bodyHeight <= 0) throw new Error('El encabezado y pie no dejan espacio para el contenido.');
        Object.assign(flowWindow.style, { top: `${bodyTop}px`, height: `${bodyHeight}px` });
        const ranges = collectPdfProtectedRanges(flow);
        const collectLinks = (element: HTMLElement) => {
            const origin = element.getBoundingClientRect();
            return Array.from(element.querySelectorAll<HTMLAnchorElement>('a[href]')).flatMap(anchor =>
                Array.from(anchor.getClientRects()).filter(box => box.width > 0 && box.height > 0).map(box => ({
                    url: anchor.href, left: box.left - origin.left, top: box.top - origin.top,
                    width: box.width, height: box.height,
                })));
        };
        const links = collectLinks(flow);
        const flowRect = flow.getBoundingClientRect();
        const tables = Array.from(flow.querySelectorAll<HTMLTableElement>('table')).flatMap(table => {
            const thead = table.tHead;
            const rows = Array.from(table.tBodies).flatMap(body => Array.from(body.rows));
            if (!thead || !rows.length) return [];
            const tableRect = table.getBoundingClientRect();
            const headRect = thead.getBoundingClientRect();
            const firstRowRect = rows[0].getBoundingClientRect();
            const lastRowRect = rows[rows.length - 1].getBoundingClientRect();
            // Do not leave the original table heading alone at a page end.
            // Exact row edges avoid joining adjacent rows transitively.
            ranges.push({ top: headRect.top - flowRect.top, bottom: firstRowRect.bottom - flowRect.top });
            const repeated = table.cloneNode(false) as HTMLTableElement;
            repeated.removeAttribute('id');
            repeated.classList.add('pdf-continuation-table');
            repeated.style.setProperty('width', '100%', 'important');
            repeated.style.setProperty('margin', '0', 'important');
            repeated.style.tableLayout = 'fixed';
            repeated.style.position = 'static';
            // html-to-image copies computed styles without their !important
            // priorities. Give the 100%-wide table its own measured container
            // so the document's table rule cannot expand it to the A4 width.
            const repeatedWrapper = document.createElement('div');
            Object.assign(repeatedWrapper.style, {
                position: 'absolute', left: `${tableRect.left - flowRect.left}px`,
                top: `${bodyTop}px`, width: `${tableRect.width}px`,
                padding: '0', margin: '0', border: '0', visibility: 'hidden',
            });
            // Preserve the original body-driven column widths when the body
            // is absent from the continuation heading.
            const colgroup = document.createElement('colgroup');
            for (const cell of Array.from(thead.rows[0]?.cells || [])) {
                const columnWidth = cell.getBoundingClientRect().width / cell.colSpan;
                for (let column = 0; column < cell.colSpan; column++) {
                    const col = document.createElement('col');
                    col.style.width = `${columnWidth}px`;
                    colgroup.appendChild(col);
                }
            }
            repeated.append(colgroup, thead.cloneNode(true));
            repeatedWrapper.appendChild(repeated);
            context.appendChild(repeatedWrapper);
            const repeatedHeight = repeatedWrapper.getBoundingClientRect().height;
            const repeatedLinks = collectLinks(repeatedWrapper);
            repeatedWrapper.style.visibility = 'visible';
            repeatedWrapper.style.display = 'none';
            return [{
                repeatedWrapper, repeatedHeight, repeatedLinks,
                left: tableRect.left - flowRect.left,
                bodyTop: firstRowRect.top - flowRect.top,
                bodyBottom: lastRowRect.bottom - flowRect.top,
            }];
        });
        const slices: { top: number; bottom: number; continuation: typeof tables[number] | undefined }[] = [];
        let nextTop = 0;
        while (nextTop < flowRect.height) {
            const continuation = tables.find(table => nextTop >= table.bodyTop - 0.5
                && nextTop < table.bodyBottom - 0.5 && table.repeatedHeight < bodyHeight);
            const availableHeight = bodyHeight - (continuation?.repeatedHeight || 0);
            const shiftedRanges = ranges.filter(range => range.bottom > nextTop)
                .map(range => ({ top: range.top - nextTop, bottom: range.bottom - nextTop }));
            const firstSlice = paginatePdfContent(flowRect.height - nextTop, availableHeight, shiftedRanges)[0];
            slices.push({ top: nextTop, bottom: nextTop + firstSlice.bottom, continuation });
            nextTop += firstSlice.bottom;
        }
        const bandLinks = [header, footer].flatMap(band => {
            if (!band) return [];
            const box = band.getBoundingClientRect();
            const origin = context.getBoundingClientRect();
            return collectLinks(band).map(link => ({ ...link, left: link.left + box.left - origin.left, top: link.top + box.top - origin.top }));
        });
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        for (const [index, slice] of slices.entries()) {
            if (index) pdf.addPage('a4', 'portrait');
            for (const table of tables) table.repeatedWrapper.style.display = table === slice.continuation ? 'block' : 'none';
            const contentTop = bodyTop + (slice.continuation?.repeatedHeight || 0);
            flowWindow.style.top = `${contentTop}px`;
            flow.style.top = `${-slice.top}px`;
            // Clip at the chosen safe boundary, not the full available height,
            // so the next section cannot leak into this page's bottom margin.
            flowWindow.style.height = `${slice.bottom - slice.top}px`;
            onProgress?.(25 + Math.round((index + 1) / slices.length * 65), `Conservando el diseño · página ${index + 1}...`);
            const image = await toJpeg(viewport, {
                width, height: pageHeight, pixelRatio: 2.25, quality: 0.98,
                backgroundColor: '#ffffff', fontEmbedCSS: fontCss,
                style: { position: 'relative', left: '0', top: '0', zIndex: '0' },
            });
            pdf.addImage(image, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
            for (const link of links) {
                const top = Math.max(link.top, slice.top);
                const bottom = Math.min(link.top + link.height, slice.bottom);
                if (bottom <= top) continue;
                pdf.link(link.left / width * 210, (contentTop + top - slice.top) / width * 210,
                    link.width / width * 210, (bottom - top) / width * 210, { url: link.url });
            }
            for (const link of bandLinks) {
                pdf.link(link.left / width * 210, link.top / width * 210,
                    link.width / width * 210, link.height / width * 210, { url: link.url });
            }
            if (slice.continuation) {
                for (const link of slice.continuation.repeatedLinks) {
                    pdf.link((slice.continuation.left + link.left) / width * 210, (bodyTop + link.top) / width * 210,
                        link.width / width * 210, link.height / width * 210, { url: link.url });
                }
            }
        }
        onProgress?.(90, 'PDF listo con el diseño de la vista previa');
        return new Uint8Array(pdf.output('arraybuffer'));
    } finally {
        viewport.remove();
    }
}
