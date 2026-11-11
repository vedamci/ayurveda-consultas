import type { TreatmentPlan, Visit } from '../types/patient';

type Recommendation = Partial<TreatmentPlan & Visit>;
export interface RecommendationSection { title: string; items: string[] }
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

// Read only saved values: never regenerate a historical prescription from today's catalogue.
export function recommendationSections(record: Recommendation): RecommendationSection[] {
    const sections: RecommendationSection[] = [];
    const add = (title: string, items: unknown[]) => {
        const values = items.map(text).filter(Boolean);
        if (values.length) sections.push({ title, items: values });
    };
    add('Indicaciones', [record.patientTreatment || record.treatment]);
    add('Fórmulas y dosis', (record.herbs || []).map(h => [h.formula, h.suspended ? 'Suspendido' : '', h.dosage, h.purpose, h.instruction].filter(Boolean).join(' · ')));
    add('Alimentación', [record.categories?.join(', '), record.cerealGuidance]);
    if (record.showHealthyEatingGuide !== false) {
        add('Hábitos alimentarios', [record.healthyEatingGuide, ...(record.healthyEatingHabitDetails?.length
            ? record.healthyEatingHabitDetails.map(h => [h.name, h.text].filter(Boolean).join(': ')) : record.healthyEatingHabits || [])]);
    }
    add('Estilo de vida', [record.patientLifestyle || record.lifestyle]);
    add('Receta indicada', [record.cerealRecipe]);
    if (record.showRecipesSection !== false) {
        add('Recetas', (record.recipes || []).map((recipe: unknown) => {
            if (typeof recipe === 'string') return recipe;
            if (!recipe || typeof recipe !== 'object') return '';
            const r = recipe as Record<string, unknown>;
            return [text(r.title) || text(r.id), text(r.text), r.structured ? JSON.stringify(r.structured, null, 2) : ''].filter(Boolean).join('\n');
        }));
    }
    if (record.showTherapiesSection !== false) {
        add('Terapias', [...(record.therapyDetails?.length ? record.therapyDetails.map(t => [t.name, t.text].filter(Boolean).join(': ')) : record.therapies || []),
            record.therapyFrequency && `Frecuencia: ${record.therapyFrequency}`, record.therapyCount && `Sesiones: ${record.therapyCount}`, record.therapyNoteTitle, record.therapyNoteBody]);
    }
    return sections;
}

export function savedRecommendationHistory(plans: TreatmentPlan[], visits: Visit[], date: string, editingVisitId?: string | null) {
    // ISO calendar dates avoid timezone shifts at midnight. Invalid/undated records are not guessed.
    const day = (value?: string) => /^\d{4}-\d{2}-\d{2}/.exec(value || '')?.[0] || '';
    const cutoff = day(date);
    return [
        ...plans.map(record => ({ kind: 'plan' as const, record })),
        ...visits.filter(record => !editingVisitId || record.id !== editingVisitId).map(record => ({ kind: 'visit' as const, record }))
    ].map(({ kind, record }) => ({ kind, record, date: day(('visitDate' in record && record.visitDate) || record.date), sections: recommendationSections(record) }))
        .filter(entry => entry.date && cutoff && entry.date <= cutoff && entry.sections.length)
        .sort((a, b) => b.date.localeCompare(a.date));
}
