import { useState } from 'react';
import { CalendarDays, ChevronDown, ClipboardList, FileText, History, Leaf, Pill, Utensils, Heart, BookOpen, Sparkles, Info } from 'lucide-react';
import type { TreatmentPlan, Visit } from '../../types/patient';
import { savedRecommendationHistory } from '../../utils/treatmentHistory';

const categoryIcons = {
    'Indicaciones': ClipboardList, 'Fórmulas y dosis': Pill, 'Alimentación': Utensils,
    'Hábitos alimentarios': Leaf, 'Estilo de vida': Heart, 'Receta indicada': BookOpen,
    'Recetas': BookOpen, 'Terapias': Sparkles,
};
const dateLabel = (date: string) => {
    const parsed = new Date(`${date}T12:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat('es-MX', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    }).format(parsed);
};

export function SavedRecommendations({ plans, visits, date, editingVisitId }: {
    plans: TreatmentPlan[]; visits: Visit[]; date: string; editingVisitId?: string | null;
}) {
    const history = savedRecommendationHistory(plans, visits, date, editingVisitId);
    const [selectedKey, setSelectedKey] = useState('');
    const recordKey = (entry: typeof history[number], index: number) => `${entry.kind}-${entry.record.id || `${entry.date}-${index}`}`;
    const selectedIndex = Math.max(0, history.findIndex((entry, index) => recordKey(entry, index) === selectedKey));
    const selected = history[selectedIndex];
    const activeKey = selected ? recordKey(selected, selectedIndex) : '';
    return <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm" aria-label="Tratamientos recomendados anteriormente">
        <div className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4">
            <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><History size={20} aria-hidden="true" /></span>
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Seguimiento del tratamiento</p>
                    <h5 className="mt-0.5 text-base font-bold leading-snug text-slate-900">Lo que recomendaste</h5>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">Consulta las indicaciones previas sin salir de esta visita.</p>
                </div>
            </div>
            {selected && <label className="mt-4 block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><CalendarDays size={14} aria-hidden="true" />Consulta de referencia</span>
                <select aria-label="Consulta de referencia" value={activeKey} onChange={event => setSelectedKey(event.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                    {history.map((entry, index) => <option key={recordKey(entry, index)} value={recordKey(entry, index)}>{dateLabel(entry.date)} · {entry.record.title || (entry.kind === 'plan' ? 'Tratamiento PDF' : 'Visita')}{index === 0 ? ' (más reciente)' : ''}</option>)}
                </select>
            </label>}
        </div>
        {!selected ? <div className="p-5 text-center">
            <ClipboardList className="mx-auto mb-2 text-slate-400" size={24} aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-700">Aún no hay indicaciones previas</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">Aquí aparecerán las recomendaciones guardadas hasta la fecha de esta consulta.</p>
        </div> : <div key={activeKey} className="space-y-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1.5 font-medium text-slate-600"><FileText size={13} aria-hidden="true" />{selected.record.pdfFile ? 'PDF guardado' : 'Indicaciones guardadas'}</span>
                <span className="text-slate-500">{selected.sections.length} apartados · Solo lectura</span>
            </div>
            {selected.sections.map(section => {
                const Icon = categoryIcons[section.title as keyof typeof categoryIcons] || ClipboardList;
                return <details key={section.title} open={section.title === 'Indicaciones' || section.title === 'Fórmulas y dosis'} className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-3 py-3 text-sm font-semibold text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 [&::-webkit-details-marker]:hidden">
                        <Icon size={17} className="shrink-0 text-emerald-600" aria-hidden="true" />
                        <span className="min-w-0 flex-1">{section.title}</span>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">{section.items.length}</span>
                        <ChevronDown size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <ul className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-3 text-sm leading-relaxed text-slate-700">{section.items.map((item, index) => <li key={index} className="whitespace-pre-wrap break-words rounded-lg border border-slate-100 bg-white p-3 [overflow-wrap:anywhere]">{item}</li>)}</ul>
                </details>;
            })}
        </div>}
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
            <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>Referencia histórica, no una prescripción nueva. No se copia ni renueva automáticamente. Las tablas completas se consultan en el PDF original.</p>
        </div>
    </section>;
}
