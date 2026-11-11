import type { TreatmentPlan, Visit } from '../../types/patient';
import { savedRecommendationHistory } from '../../utils/treatmentHistory';

export function SavedRecommendations({ plans, visits, date, editingVisitId }: {
    plans: TreatmentPlan[]; visits: Visit[]; date: string; editingVisitId?: string | null;
}) {
    const history = savedRecommendationHistory(plans, visits, date, editingVisitId);
    return <section className="rounded-xl border border-emerald-200 bg-white p-3 space-y-3" aria-label="Tratamientos recomendados anteriormente">
        <h5 className="font-bold text-sm text-emerald-900">Tratamientos recomendados anteriormente</h5>
        <p className="text-xs text-slate-600">Recomendaciones guardadas hasta la fecha de esta consulta. Solo referencia: no se copian ni se renuevan automáticamente.</p>
        {!history.length && <p className="text-sm text-slate-500">No hay recomendaciones anteriores guardadas para esta fecha.</p>}
        {history.map(({ record, kind, date: savedDate, sections }, index) => <details key={`${kind}-${record.id || index}`} open={index === 0} className="rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">{savedDate.split('-').reverse().join('/')} · {record.title || (kind === 'plan' ? 'Tratamiento PDF' : 'Visita')}{record.pdfFile ? ' · PDF guardado' : ' · Recomendaciones guardadas'}</summary>
            <div className="mt-3 space-y-3">
                {sections.map(section => <div key={section.title}>
                    <h6 className="text-xs font-bold uppercase text-emerald-800">{section.title}</h6>
                    <ul className="mt-1 space-y-2 text-sm text-slate-700">{section.items.map((item, i) => <li key={i} className="whitespace-pre-wrap break-words">{item}</li>)}</ul>
                </div>)}
            </div>
        </details>)}
        {!!history.length && <p className="text-xs text-slate-500">Las categorías se muestran como se guardaron. Para comprobar el diseño y las tablas completas, consulta el PDF original en el historial.</p>}
    </section>;
}
