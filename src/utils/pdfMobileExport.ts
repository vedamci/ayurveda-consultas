import { embedPdfFonts, loadPdfFonts } from './pdfFonts';
import { jsPDF } from 'jspdf';
import { createMobilePdfLayout } from './pdfMobileLayout';
import { capturePdfPage, assertCapturedPageHasInk } from './pdfRaster';

/** Export the styled mobile template, keeping physical pages and clickable links. */
export async function exportMobilePdf(
    source: HTMLElement,
    onProgress?: (progress: number, status?: string) => void,
): Promise<Uint8Array> {
    onProgress?.(15, 'Preparando el diseño para móvil...');
    await loadPdfFonts();
    const layout = await createMobilePdfLayout(source);
    try {
        const fontEmbedCSS = await embedPdfFonts();
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [120, 213], compress: true });
        for (let index = 0; index < layout.pageCount; index++) {
            if (index) pdf.addPage([120, 213], 'portrait');
            await layout.showPage(index);
            onProgress?.(25 + Math.round((index + 1) / layout.pageCount * 65), `Conservando el diseño móvil · página ${index + 1}...`);
            const image = await capturePdfPage(layout.frame, {
                width: layout.width, height: layout.height, pixelRatio: 2.25,
                quality: 0.98, backgroundColor: '#ffffff', fontEmbedCSS,
            });
            await assertCapturedPageHasInk(image);
            pdf.addImage(image, 'JPEG', 0, 0, 120, 213, undefined, 'FAST');
            const origin = layout.frame.getBoundingClientRect();
            for (const anchor of Array.from(layout.frame.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
                if (!/^(https?:|mailto:|tel:)/i.test(anchor.href)) continue;
                for (const rect of Array.from(anchor.getClientRects())) {
                    const left = Math.max(0, rect.left - origin.left);
                    const top = Math.max(0, rect.top - origin.top);
                    const right = Math.min(origin.width, rect.right - origin.left);
                    const bottom = Math.min(origin.height, rect.bottom - origin.top);
                    if (right <= left || bottom <= top) continue;
                    pdf.link(left / origin.width * 120, top / origin.height * 213,
                        (right - left) / origin.width * 120, (bottom - top) / origin.height * 213,
                        { url: anchor.href });
                }
            }
        }
        return new Uint8Array(pdf.output('arraybuffer'));
    } finally {
        layout.dispose();
    }
}
