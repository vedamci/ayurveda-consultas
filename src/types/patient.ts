export interface SymptomCalibration {
    symptom: string;
    frequency: string; // 'Diaria' | 'Semanal' | 'Mensual'
    intensity: number; // 1-3 o 1-10, según el intensityScale del paciente
    intensityLabel?: string;
    note?: string;
}

export interface Visit {
    id?: string;
    title?: string;
    date: string;
    note: string;
    diagnosis?: string;
    treatment?: string;
    lifestyle?: string;
    tongue?: string;
    patientDiagnosis?: string;
    patientTreatment?: string;
    patientLifestyle?: string;
    cerealGuidance?: string;
    cerealRecipe?: string;
    dosha?: string;
    symptoms: Record<string, { frequency: string; intensity: number; note?: string }>;
    herbs?: Array<{ formula: string; dosage: string; purpose?: string; instruction?: string }>;
    categories?: string[];
    recipes?: any[];
    adherence?: TreatmentAdherence;
    pdfFile?: string;
    mdFile?: string;
    subtitle?: string;
    pdfFontSize?: string;
    isFollowUp?: boolean;
    visitNumber?: string | number;
    showLifestylePage?: boolean;
    showDigestiveRecoveryPage?: boolean;
    showDiagnosis?: boolean;
    showHealthyEatingGuide?: boolean;
    showRecipesSection?: boolean;
    showTherapiesSection?: boolean;
    healthyEatingGuide?: string;
    healthyEatingHabits?: string[];
    healthyEatingHabitDetails?: HealthyEatingHabitDetail[];
    therapies?: string[];
    therapyDetails?: TherapyDetail[];
    therapyFrequency?: string;
    therapyCount?: string | number;
    therapyNoteTitle?: string;
    therapyNoteBody?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface TreatmentPlan {
    id?: string;
    title?: string;
    date: string;
    visitDate?: string;
    diagnosis: string;
    treatment: string;
    lifestyle: string;
    tongue?: string;
    patientDiagnosis?: string;
    patientTreatment?: string;
    patientLifestyle?: string;
    cerealGuidance?: string;
    cerealRecipe?: string;
    dosha: string;
    herbs: Array<{ formula: string; dosage: string; purpose?: string; instruction?: string }>;
    categories: string[];
    recipes?: any[];
    adherence?: TreatmentAdherence;
    pdfFile?: string;
    subtitle?: string;
    pdfFontSize?: string;
    isFollowUp?: boolean;
    visitNumber?: string | number;
    showLifestylePage?: boolean;
    showDigestiveRecoveryPage?: boolean;
    showDiagnosis?: boolean;
    showHealthyEatingGuide?: boolean;
    showRecipesSection?: boolean;
    showTherapiesSection?: boolean;
    healthyEatingGuide?: string;
    healthyEatingHabits?: string[];
    healthyEatingHabitDetails?: HealthyEatingHabitDetail[];
    therapies?: string[];
    therapyDetails?: TherapyDetail[];
    therapyFrequency?: string;
    therapyCount?: string | number;
    therapyNoteTitle?: string;
    therapyNoteBody?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface TreatmentAdherenceItem {
    name: string;
    status: 'done' | 'partial' | 'not_done' | 'unknown';
    note?: string;
}

export interface TreatmentAdherence {
    categories?: TreatmentAdherenceItem[];
    herbs?: TreatmentAdherenceItem[];
    lifestyle?: TreatmentAdherenceItem[];
    healthyHabits?: TreatmentAdherenceItem[];
    generalNote?: string;
    updatedAt?: string;
}

export interface HealthyEatingHabitDetail {
    name: string;
    text?: string;
}

export interface TherapyDetail {
    id?: string;
    name: string;
    emoji?: string;
    text?: string;
}

export interface DoctorNote {
    id: string;
    text: string;
    createdAt: string;
    createdBy: string;
}

export interface TonguePhoto {
    id: string;
    originalName: string;
    filename: string;
    mimeType: string;
    size: number;
    note?: string;
    url: string;
    createdAt: string;
    updatedAt?: string;
}

export interface PulsePositionReading {
    side: 'right' | 'left';
    sideLabel: string;
    point: 'V' | 'P' | 'K';
    number: '1' | '2' | '3';
    superficialOrgan: string;
    deepOrgan: string;
    superficialStatus: string;
    deepStatus: string;
}

export interface PulseReading {
    id: string;
    date: string;
    positions: PulsePositionReading[];
    notes?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface ContextDocument {
    id: string;
    originalName: string;
    filename: string;
    mimeType: string;
    size: number;
    note?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface AiDiagnosisRecord {
    id: string;
    diagnosis: string;
    dosha?: string;
    provider?: string;
    model?: string;
    createdAt: string;
}

export interface PatientDetail {
    id?: string;
    name: string;
    age: string;
    email: string;
    phone?: string;
    dosha: string;
    fullNotes: string;
    symptomCalibrations: SymptomCalibration[];
    plainSymptoms: string[];
    // Escala de intensidad usada para calibrar los síntomas de este paciente (por
    // defecto 3 = escala clásica Suave/Moderado/Fuerte). Es una preferencia por
    // paciente, editable desde "Editar Caso"; al cambiarla se reescala el historial.
    intensityScale?: 3 | 10;
    clinicalData?: Record<string, string>;
    visits: Visit[];
    treatmentPlans?: TreatmentPlan[];
    tonguePhotos?: TonguePhoto[];
    pulseReadings?: PulseReading[];
    contextDocuments?: ContextDocument[];
    aiDiagnoses?: AiDiagnosisRecord[];
    createdAt?: string;
}
