// Pure intake validation: no network, patient records or credentials are accessed.
export function validateIntake(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'La ficha debe ser un objeto válido.' };
    for (const field of ['patientName', 'email', 'phone']) {
        if (typeof body[field] !== 'string' || !body[field].trim()) return { error: 'Completa nombre, correo y teléfono.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return { error: 'Ingresa un correo válido.' };
    const digits = body.phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return { error: 'Ingresa un teléfono válido.' };
    if (body.consent !== true || body.dataProtection !== true) return { error: 'Es necesario aceptar el consentimiento informado y la protección de datos.' };
    // Unversioned clients use the historical 1–3 scale; never infer 10 from a value.
    const scale = body.intensityScale === undefined ? 3 : body.intensityScale;
    if (scale !== 3 && scale !== 10) return { error: 'Escala de intensidad inválida.' };
    const calibrations = body.symptomCalibrations ?? {};
    if (!calibrations || typeof calibrations !== 'object' || Array.isArray(calibrations)) return { error: 'La calibración de síntomas no es válida.' };
    for (const [symptom, cal] of Object.entries(calibrations)) {
        if (!symptom.trim() || !cal || typeof cal !== 'object' || !Number.isInteger(cal.intensity) || cal.intensity < 1 || cal.intensity > scale || !['Diaria', 'Semanal', 'Mensual'].includes(cal.frequency)) {
            return { error: `Revisa la frecuencia y la intensidad de los síntomas (1 a ${scale}).` };
        }
    }
    return { value: { ...body, patientName: body.patientName.trim(), email: body.email.trim(), phone: body.phone.trim(), intensityScale: scale } };
}

export function intakeScaleFromNotes(notes = '') {
    const match = notes.match(/^Escala de intensidad de ingreso: (3|10)$/m);
    return match ? Number(match[1]) : 3;
}

// Once Notion has committed, a failed local cache must not invite a second submission.
export async function cacheCreatedIntakeScale(id, scale, save, warn = () => {}) {
    try {
        await save(id, scale);
        return true;
    } catch {
        warn('La ficha se guardó en Notion; no se pudo guardar la escala en la caché local.');
        return false;
    }
}
