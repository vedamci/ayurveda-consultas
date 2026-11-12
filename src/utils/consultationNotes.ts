import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { PatientDetail } from '../types/patient';

const parser = unified().use(remarkParse).use(remarkGfm);
export type ConsultationNoteSection = { title: string; markdown: string; source: string };

/** Presentation only: slice the original Markdown at real, top-level headings.
 * Legacy intake notes use bold labels, sometimes followed by a colon/value.
 * Never split inside code, lists, quotes or tables; never classify clinical prose.
 * Keep definitions in every slice so references across categories still resolve.
 */
export function consultationNoteSections(text: string, fallback = 'Nota general'): ConsultationNoteSection[] {
    if (!text.trim()) return [];
    const tree = parser.parse(text);
    const definitions = tree.children.filter(node => node.type === 'definition')
        .map(node => text.slice(node.position!.start.offset, node.position!.end.offset)).join('\n');
    const boundaries: { start: number; contentStart: number; title: string }[] = [];
    for (const node of tree.children) {
        if (node.type === 'heading') {
            const first = node.children[0], last = node.children.at(-1);
            if (first && last) boundaries.push({ start: node.position!.start.offset!, contentStart: node.position!.end.offset!, title: text.slice(first.position!.start.offset, last.position!.end.offset) });
        } else if (node.type === 'paragraph' && node.children[0]?.type === 'strong') {
            const label = node.children[0];
            const after = text.slice(label.position!.end.offset, node.position!.end.offset);
            // A bold phrase within a sentence is emphasis, not a category.
            if (!after || /^[ \t]*(?:\r?\n|$)/.test(after) || /^[ \t]*:/.test(after) || /:[*_]{2}$/.test(text.slice(label.position!.start.offset, label.position!.end.offset))) {
                boundaries.push({ start: node.position!.start.offset!, contentStart: label.position!.end.offset! + (after.match(/^[ \t]*:[ \t]*/)?.[0].length || 0), title: text.slice(label.position!.start.offset! + 2, label.position!.end.offset! - 2) });
            }
        }
    }
    if (!boundaries.length || text.slice(0, boundaries[0].start).trim()) boundaries.unshift({ start: 0, contentStart: 0, title: fallback });
    else boundaries[0].start = 0;
    return boundaries.map((boundary, index) => ({
        title: boundary.title + (definitions ? `\n\n${definitions}` : ''),
        // Original slices allow checking exact preservation; headings are displayed in the summary.
        source: text.slice(boundary.start, boundaries[index + 1]?.start ?? text.length),
        markdown: text.slice(boundary.contentStart, boundaries[index + 1]?.start ?? text.length) + (definitions ? `\n\n${definitions}` : ''),
    }));
}

export function consultationPurpose(patient: Pick<PatientDetail, 'clinicalData' | 'fullNotes'>): { text: string; source: string } | null {
    const value = patient.clinicalData?.['Propósito de Consulta'];
    if (value?.trim()) return { text: value, source: 'Ficha de ingreso · Propósito de Consulta' };
    // Read only the legacy top-level list field written by formatSummary.
    // AST parsing avoids mistaking an example inside a code block/quote for data.
    for (const node of parser.parse(patient.fullNotes || '').children) {
        if (node.type !== 'list') continue;
        for (const item of node.children) {
            const paragraph = item.children[0];
            if (paragraph?.type !== 'paragraph') continue;
            const raw = (patient.fullNotes || '').slice(paragraph.position!.start.offset, paragraph.position!.end.offset);
            const legacy = raw.match(/^Motivo Consulta:[ \t]*([\s\S]*)/)?.[1];
            if (legacy?.trim()) return { text: legacy, source: 'Ficha de ingreso · Motivo Consulta (nota antigua)' };
        }
    }
    return null;
}
