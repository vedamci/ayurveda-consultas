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
    Object.assign(flow.style, { width: '100%', margin: '0', padding: '0', transformOrigin: 'top left', overflowWrap: 'break-word' });
    for (const child of Array.from(body.children)) flow.appendChild(child.cloneNode(true));
    const header = flow.querySelector<HTMLElement>('.print-flow-header');
    if (header) header.style.paddingTop = '0'; // The page already has its top margin.
    viewport.appendChild(flow);

    const footer = footerSource.cloneNode(true) as HTMLElement;
    Object.assign(footer.style, {
        position: 'absolute', left: '8mm', right: '8mm', bottom: '6mm', marginTop: '0',
    });
    const fullFooter = Array.from(footer.childNodes);
    const contactLink = footer.querySelector<HTMLAnchorElement>('a[href]');
    const compactContact = contactLink?.cloneNode(false) as HTMLAnchorElement | undefined
        ?? document.createElement('span');
    compactContact.textContent = footer.dataset.pdfContactLabel || 'Contacto';
    compactContact.classList.add('font-semibold', 'pdf-c-gold-dark');
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
        // A physical gutter prevents paint from a neighbouring fragment
        // (borders, rounded cards) from bleeding into the current page.
        const contentWidth = viewportRect.width;
        const columnGap = 24;
        const pageStride = contentWidth + columnGap;
        if (contentWidth < 100 || contentHeight < 150) throw new Error('El área móvil no tiene un tamaño imprimible.');
        viewport.style.height = `${contentHeight}px`;

        // A tall name can turn the cover into a nearly empty first page.
        // Constrain only that heading, preserving the chosen body text size.
        const coverName = flow.querySelector<HTMLElement>('.print-flow-hero .pdf-hero-name');
        if (coverName && coverName.getBoundingClientRect().height > 112) {
            coverName.dataset.pdfMobileCompact = '';
        }
        const columnHeight = contentHeight - 20; // Eczar ascenders extend beyond tight line boxes.

        // Let content start in the space below the header instead of moving a
        // whole section to the next page. Keep only individual items together.
        const containers = '.print-flow-section, .print-flow-card, .print-flow-table-card, .print-flow-instruction-block, .print-flow-food-intro';
        for (const container of Array.from(flow.querySelectorAll<HTMLElement>(containers))) {
            container.style.setProperty('break-inside', 'auto', 'important');
        }
        for (const element of Array.from(flow.querySelectorAll<HTMLElement>('.print-avoid, tr, li, img, [data-pdf-mobile-keep]'))) {
            if (element.matches(containers) || element.hasAttribute('data-pdf-mobile-split')) continue;
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
        for (const heading of Array.from(flow.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, [data-pdf-mobile-keep-with-next]'))) {
            heading.style.setProperty('break-after', 'avoid-column', 'important');
            if (!heading.matches('.print-flow-title')) continue;
            const divider = heading.nextElementSibling;
            if (!(divider instanceof HTMLElement) || !divider.matches('.print-flow-divider')) continue;
            // Fragment title and rule as a unit. Otherwise the diamond can be
            // split between the bottom of one page and the top of the next.
            const headingGroup = document.createElement('div');
            headingGroup.style.setProperty('break-inside', 'avoid-column', 'important');
            headingGroup.style.setProperty('break-after', 'avoid-column', 'important');
            heading.before(headingGroup);
            headingGroup.append(heading, divider);
        }
        for (const section of Array.from(flow.querySelectorAll<HTMLElement>('.print-page-break-before'))) {
            section.style.setProperty('break-before', 'column', 'important');
        }
        Object.assign(flow.style, {
            width: `${contentWidth}px`, height: `${contentHeight}px`,
            // An explicit column width also triggers fragmentation in older WebKit.
            columnWidth: `${contentWidth}px`, columnGap: `${columnGap}px`, columnFill: 'auto',
            paddingTop: '10px', paddingBottom: '10px', boxSizing: 'border-box',
        });
        await nextPaint();
        const pageCount = Math.max(1, Math.ceil((flow.scrollWidth + columnGap - 1) / pageStride));
        if (pageCount > 150) throw new Error('El documento móvil tiene demasiadas páginas.');
        return {
            frame, viewport, pageCount, width: Math.ceil(frameRect.width), height: Math.ceil(frameRect.height),
            async showPage(index: number) {
                flow.style.transform = `translateX(${-index * pageStride}px)`;
                frame.dataset.pdfPageIndex = String(index);
                // Reserve the full footer's height on every page so text never
                // reflows or overlaps when switching between footer versions.
                if (index === 0 || index === pageCount - 1) {
                    footer.replaceChildren(...fullFooter);
                } else {
                    footer.replaceChildren(compactContact);
                }
                await nextPaint();
            },
            dispose,
        };
    } catch (error) {
        dispose();
        throw error;
    }
}
