export const INTAKE_DRAFT_KEY = 'vedamci-patient-intake-v1';
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const excluded = new Set(['professionalNotes', 'consent', 'dataProtection', 'recordingConsent', 'studentListeners']);
export function encodeIntakeDraft(data: Record<string, unknown>, now = Date.now()) {
    return JSON.stringify({ version: 1, savedAt: now, data: Object.fromEntries(Object.entries(data).filter(([key]) => !excluded.has(key))) });
}
export function decodeIntakeDraft<T extends Record<string, unknown>>(raw: string, defaults: T, now = Date.now()): T | null {
    try {
        const draft = JSON.parse(raw);
        if (draft.version !== 1 || !Number.isFinite(draft.savedAt) || draft.savedAt > now || now - draft.savedAt > DRAFT_MAX_AGE_MS || !draft.data || typeof draft.data !== 'object') return null;
        const restored: Record<string, unknown> = { ...defaults };
        for (const [key, value] of Object.entries(defaults)) {
            const saved = draft.data[key];
            if (excluded.has(key)) continue;
            if (typeof value === 'string' && typeof saved === 'string') restored[key] = saved;
            else if (Array.isArray(value) && Array.isArray(saved) && saved.every(item => typeof item === 'string')) restored[key] = saved;
        }
        const calibrations: Record<string, { frequency: string; intensity: number }> = {};
        for (const symptom of (restored.symptoms as string[] || [])) {
            const cal = draft.data.symptomCalibrations?.[symptom];
            if (cal && ['Diaria', 'Semanal', 'Mensual'].includes(cal.frequency) && Number.isInteger(cal.intensity) && cal.intensity >= 1 && cal.intensity <= 10) {
                Object.defineProperty(calibrations, symptom, { value: {frequency: cal.frequency, intensity: cal.intensity}, enumerable: true });
            }
        }
        restored.symptomCalibrations = calibrations;
        restored.symptoms = (restored.symptoms as string[] || []).filter(symptom => Object.hasOwn(calibrations, symptom));
        return restored as T;
    } catch { return null; }
}
