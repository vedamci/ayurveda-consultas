import { useId, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ClipboardList } from 'lucide-react';
import type { PatientDetail } from '../../types/patient';
import { consultationNoteSections, consultationPurpose } from '../../utils/consultationNotes';

/** No raw HTML, remote images, embedded media or active links in clinical notes.
 * React escapes literal HTML; no rehype-raw or dangerouslySetInnerHTML is used.
 * Reference/link text and image alternative text remain readable without fetches.
 */
export function ConsultationNoteMarkdown({ text }: { text: string }) {
    return <div className="consultation-note-markdown min-w-0 text-xs leading-6 text-slate-700 [overflow-wrap:anywhere] [&_p]:my-2 [&_strong]:font-bold [&_strong]:text-slate-900 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-amber-200 [&_blockquote]:pl-3 [&_pre]:whitespace-pre-wrap [&_code]:break-words [&_hr]:my-3 [&_hr]:border-slate-200">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            h1: ({ children }) => <h6 className="mb-2 mt-3 text-sm font-bold text-slate-900">{children}</h6>,
            h2: ({ children }) => <h6 className="mb-2 mt-3 text-sm font-bold text-slate-900">{children}</h6>,
            h3: ({ children }) => <h6 className="mb-2 mt-3 text-xs font-bold text-slate-900">{children}</h6>,
            h4: ({ children }) => <h6 className="mb-2 mt-3 text-xs font-bold text-slate-900">{children}</h6>,
            h5: ({ children }) => <h6 className="mb-2 mt-3 text-xs font-bold text-slate-900">{children}</h6>,
            h6: ({ children }) => <h6 className="mb-2 mt-3 text-xs font-bold text-slate-900">{children}</h6>,
            p: ({ children }) => <p className="whitespace-pre-line">{children}</p>,
            a: ({ children, href }) => <span>{children}{href && <> ({href})</>}</span>,
            img: ({ alt, src }) => <span>{alt}{src && <> ({src})</>}</span>,
            table: ({ children }) => <div className="my-3 max-w-full overflow-x-auto"><table className="w-full border-collapse text-left [&_th]:border [&_th]:border-slate-200 [&_th]:bg-amber-50 [&_th]:p-2 [&_td]:border [&_td]:border-slate-200 [&_td]:p-2">{children}</table></div>,
        }}>{text}</ReactMarkdown>
    </div>;
}

export function ConsultationNotes({ patient, record, expanded, onToggle }: {
    patient: Pick<PatientDetail, 'fullNotes' | 'clinicalData'>;
    record?: { note?: string; treatment?: string } | null;
    expanded: boolean;
    onToggle: () => void;
}) {
    const contentId = useId();
    const hasVisitNote = Boolean(record?.note?.trim());
    const generalNote = hasVisitNote ? record!.note! : patient.fullNotes || '';
    const treatment = record?.treatment || '';
    const groups = useMemo(() => [
        { title: hasVisitNote ? 'Nota general de esta visita' : 'Notas de la ficha de ingreso', text: generalNote, fallback: 'Nota general' },
        { title: 'Tratamiento indicado · registro abierto', text: treatment, fallback: 'Tratamiento indicado' },
    ].filter(group => group.text.trim()).map(group => ({ ...group, sections: consultationNoteSections(group.text, group.fallback) })), [generalNote, treatment, hasVisitNote]);
    const purpose = useMemo(() => consultationPurpose(patient), [patient]);
    return <section className="px-6 pb-3 print:hidden" aria-label="Notas de consulta">
        <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={contentId}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-600">
            <span className="flex items-center gap-2"><ClipboardList size={14} aria-hidden="true" />Notas de consulta</span>
            <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <div id={contentId} hidden={!expanded} className="mt-2 max-h-[min(24rem,45vh)] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 scrollbar-thin">
            <div className="rounded-lg border border-amber-200 bg-white p-3">
                <h5 className="text-xs font-bold text-amber-900">Propósito de la consulta</h5>
                {purpose ? <><p className="mt-1 text-[10px] text-slate-500">{purpose.source}</p><ConsultationNoteMarkdown text={purpose.text} /></> : <p className="mt-2 text-xs text-slate-500">No hay propósito de consulta registrado en la ficha de ingreso.</p>}
            </div>
            {groups.map(group => <div key={group.title} className="space-y-2">
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{group.title}</h5>
                {group.sections.map((section, index) => <details key={index} className="group rounded-lg border border-slate-200 bg-white" open>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 font-semibold text-slate-800 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-600 [&::-webkit-details-marker]:hidden">
                        <div className="min-w-0 flex-1"><ConsultationNoteMarkdown text={section.title} /></div>
                        <ChevronDown size={14} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-slate-100 px-3 py-2"><ConsultationNoteMarkdown text={section.markdown} /></div>
                </details>)}
            </div>)}
            {!groups.length && <p className="py-2 text-center text-xs text-slate-500">No hay nota general ni tratamiento indicado en esta visita.</p>}
        </div>
    </section>;
}
