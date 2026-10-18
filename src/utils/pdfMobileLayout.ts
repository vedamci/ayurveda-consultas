const nextPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** Reflow the actual print DOM into browser columns, one column per PDF page.
 * The browser fragments paragraphs/tables; no giant canvas or arbitrary cuts.
 * The source editor is restored by dispose(), including when export fails.
 */
export async function createMobilePdfLayout(source: HTMLElement) {
    const paperStyle = getComputedStyle(source);
    const backgroundColor = paperStyle.backgroundColor;
    const backgroundImage = paperStyle.backgroundImage;
    const body = source.querySelector<HTMLElement>('td.plt-body');
    const footerSource = source.querySelector<HTMLElement>('.print-flow-footer');
    if (!body || !footerSource) throw new Error('No se encontró la plantilla móvil completa.');

    const originalId = source.id;
    const stage = document.createElement('div');
    Object.assign(stage.style, {
        position: 'fixed', left: '0', top: '0', zIndex: '-2147483647', pointerEvents: 'none',
    });
    const frame = source.cloneNode(false) as HTMLElement;
    frame.classList.remove('hidden');
    frame.dataset.pdfMobilePage = '';
    Object.assign(frame.style, {
        display: 'block', position: 'relative', left: '0', top: '0', zIndex: '0',
        width: '120mm', height: '213mm', minHeight: '0', maxHeight: 'none',
        margin: '0', padding: '0', border: 'none', boxSizing: 'border-box', overflow: 'hidden',
        backgroundColor, backgroundImage, backgroundSize: '100% 100%',
        backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
    });
    const viewport = document.createElement('div');
    viewport.dataset.pdfClip = '';
    Object.assign(viewport.style, {
        position: 'absolute', top: '8mm', left: '8mm', right: '8mm', overflow: 'hidden',
    });
    const flow = document.createElement('div');
    flow.dataset.pdfMobileFlow = '';
    Object.assign(flow.style, { width: '100%', margin: '0', padding: '0', transformOrigin: 'top left' });
    for (const child of Array.from(body.children)) flow.appendChild(child.cloneNode(true));
    const header = flow.querySelector<HTMLElement>('.print-flow-header');
    if (header) header.style.paddingTop = '0'; // The page already has its top margin.
    viewport.appendChild(flow);

    const footer = footerSource.cloneNode(true) as HTMLElement;
    Object.assign(footer.style, {
        position: 'absolute', left: '8mm', right: '8mm', bottom: '6mm', marginTop: '0',
    });
    frame.append(viewport, footer);
    stage.appendChild(frame);
    // Keep the original selectors/tokens on the capture without duplicate IDs.
    source.id = `${originalId}-source`;
    const dispose = () => { stage.remove(); source.id = originalId; };
    try {
        document.body.appendChild(stage);
        await document.fonts.ready;
        await Promise.all(Array.from(frame.querySelectorAll('img')).map(image => image.decode().catch(() => {})));
        await nextPaint();

        const frameRect = frame.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        const footerRect = footer.getBoundingClientRect();
        const contentHeight = footerRect.top - viewportRect.top - 12;
        const contentWidth = viewportRect.width;
        if (contentWidth < 100 || contentHeight < 150) throw new Error('El área móvil no tiene un tamaño imprimible.');
        viewport.style.height = `${contentHeight}px`;
        const columnHeight = contentHeight - 20; // Eczar ascenders extend beyond tight line boxes.

        for (const element of Array.from(flow.querySelectorAll<HTMLElement>('.print-avoid, .print-flow-card, .print-flow-table-card, .print-flow-instruction-block, .print-flow-food-intro, tr, li, img'))) {
            element.style.setProperty('break-inside', element.getBoundingClientRect().height <= columnHeight ? 'avoid-column' : 'auto', 'important');
        }
        for (const card of Array.from(flow.querySelectorAll<HTMLElement>('.print-flow-card, .print-flow-table-card'))) {
            card.style.overflow = 'visible';
            card.style.boxDecorationBreak = 'clone';
        }
        for (const paragraph of Array.from(flow.querySelectorAll<HTMLElement>('p, li'))) {
            paragraph.style.orphans = '3';
            paragraph.style.widows = '3';
        }
        for (const image of Array.from(flow.querySelectorAll<HTMLImageElement>('img'))) {
            image.style.maxWidth = '100%';
            image.style.maxHeight = `${columnHeight}px`;
            image.style.objectFit = 'contain';
            image.style.setProperty('break-inside', 'avoid-column', 'important');
        }
        for (const heading of Array.from(flow.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, .print-flow-title, .print-flow-divider'))) {
            heading.style.setProperty('break-after', 'avoid-column', 'important');
        }
        for (const section of Array.from(flow.querySelectorAll<HTMLElement>('.print-page-break-before'))) {
            section.style.setProperty('break-before', 'column', 'important');
        }
        Object.assign(flow.style, {
            width: `${contentWidth}px`, height: `${contentHeight}px`,
            columnCount: '1', columnGap: '0px', columnFill: 'auto',
            paddingTop: '10px', paddingBottom: '10px', boxSizing: 'border-box',
        });
        await nextPaint();
        const pageCount = Math.max(1, Math.ceil((flow.scrollWidth - 1) / contentWidth));
        if (pageCount > 150) throw new Error('El documento móvil tiene demasiadas páginas.');
        return {
            frame, pageCount, width: Math.ceil(frameRect.width), height: Math.ceil(frameRect.height),
            async showPage(index: number) {
                flow.style.transform = `translateX(${-index * contentWidth}px)`;
                frame.dataset.pdfPageIndex = String(index);
                await nextPaint();
            },
            dispose,
        };
    } catch (error) {
        dispose();
        throw error;
    }
}
