// ReactMarkdown className fix applied
import { useState, useEffect, useMemo, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Calendar, Brain, Sparkles, Send, Loader2, ClipboardCheck, History, Activity, StickyNote, Plus, Clock, Printer, Phone, MapPin, Briefcase, Leaf, Heart, UtensilsCrossed, Dumbbell, Pill, AlertCircle, ShieldCheck, Mic, FileText, Info, Thermometer, Moon, Droplets, Scale, MessageCircle, FolderOpen, Maximize2, Columns2, Save, Camera, Upload, Trash2, ExternalLink, Copy, Check, ChevronDown, LayoutGrid, List, ClipboardPaste } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '../ui/Badge';
import { TreatmentPDFModal } from './TreatmentPDFModal';
import { SpeechTextarea } from '../ui/SpeechTextarea';
import { buildWhatsAppUrl } from '../../utils/whatsapp';
import herbsList from '../../data/herb.json';
import { useAutosave } from '../../hooks/useAutosave';
import { AutosaveIndicator } from '../ui/AutosaveIndicator';
import { useDraftPersist, readDraft, clearDraft } from '../../hooks/useDraftPersist';

const FOOD_CATEGORIES = [
    'Cereales', 'Lácteos', 'Endulzantes', 'Aceites', 'Frutas',
    'Hortalizas', 'Nueces', 'Carnes', 'Legumbres', 'Especias',
    'Condimentos', 'Bebidas'
];
const HERB_SUGGESTIONS: string[] = Array.from(
    new Set((herbsList as Array<{ name?: string }>).map(h => (h?.name || '').trim()).filter(Boolean))
).sort((a, b) => a.localeCompare(b, 'es'));

// Mapa nombre (en minúsculas) -> dosis/uso, tomado de la base de datos de fórmulas
// (src/data/herb.json, que incluye tanto hierbas como fórmulas personalizadas).
// Se usa para autocompletar la dosis cuando se elige una fórmula ya conocida.
const HERB_USAGE_MAP: Record<string, string> = {};
// Mapa nombre (en minúsculas) -> para qué sirve (preview), tomado de la base de datos.
const HERB_PURPOSE_MAP: Record<string, string> = {};

(herbsList as Array<{ name?: string; usage?: string; preview?: string }>).forEach(h => {
    const name = (h?.name || '').trim().toLowerCase();
    if (name) {
        if (h?.usage) {
            HERB_USAGE_MAP[name] = h.usage;
        }
        if (h?.preview) {
            HERB_PURPOSE_MAP[name] = h.preview;
        }
    }
});

const lookupHerbUsage = (name: string): string | undefined => {
    return HERB_USAGE_MAP[name.trim().toLowerCase()];
};

const lookupHerbPurpose = (name: string): string | undefined => {
    return HERB_PURPOSE_MAP[name.trim().toLowerCase()];
};

const mapHerbsWithPurpose = (herbsArray: Array<{ formula: string; dosage: string; purpose?: string }>) => {
    return (herbsArray || []).map(h => {
        const formulaName = h.formula || '';
        const purpose = h.purpose || lookupHerbPurpose(formulaName) || '';
        return {
            ...h,
            purpose
        };
    });
};

// Conteo local (por dispositivo) de cuántas veces se agregó cada fórmula, para
// mostrar un accesos rápidos de "Fórmulas más usadas" al editar un caso.
const FORMULA_USAGE_STORAGE_KEY = 'vedamci-formula-usage-counts';

const readFormulaUsageCounts = (): Record<string, { name: string; count: number }> => {
    try {
        const raw = localStorage.getItem(FORMULA_USAGE_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const recordFormulaUsage = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
        const counts = readFormulaUsageCounts();
        const key = trimmed.toLowerCase();
        const existing = counts[key];
        counts[key] = { name: existing?.name || trimmed, count: (existing?.count || 0) + 1 };
        localStorage.setItem(FORMULA_USAGE_STORAGE_KEY, JSON.stringify(counts));
    } catch {
        // localStorage puede fallar (modo privado, cuota); no es crítico.
    }
};

// Categorías para agrupar la ficha de ingreso que llenó el paciente, mostrada en modo
// toggle/acordeón dentro de "Editar Caso". Los nombres de campo coinciden con las
// llaves que arma el servidor en clinicalData (server/index.js, addField(...)).
const INTAKE_CATEGORIES: { key: string; title: string; fields: string[] }[] = [
    { key: 'sintomas', title: 'Síntomas', fields: ['Síntomas', 'Otros Síntomas', 'Propósito de Consulta'] },
    { key: 'enfermedades', title: 'Enfermedades y Antecedentes', fields: ['Enfermedades Previas', 'Hospitalizaciones', 'Cirugías', 'Embarazo', 'Sustancias', 'Alergias'] },
    { key: 'estiloVida', title: 'Estilo de Vida', fields: ['Ejercicio', 'Energía (1-10)', 'Sueño', 'Temperatura Corporal', 'Sudor'] },
    { key: 'alimentacion', title: 'Alimentación', fields: ['Desayuno', 'Comida', 'Cena', 'Horarios Regulares', 'Comidas al Día', 'Hábitos Alimenticios', 'Suplementos'] },
    { key: 'perfilAyurvedico', title: 'Perfil Ayurvédico', fields: ['Apetito', 'Tendencia de Peso', 'Menstruación'] },
    { key: 'personal', title: 'Datos Personales', fields: ['Dirección', 'Ciudad', 'Edad', 'Estado Civil', 'Hijos', 'Contacto Emergencia', 'Profesión', 'Peso', 'Altura'] },
    { key: 'admin', title: 'Administrativo', fields: ['Profesional', 'Grabación Educativa', 'Consentimiento', 'Observaciones', 'Notas del Profesional'] },
];

import { type PatientDetail, type DoctorNote, type TreatmentPlan, type Visit, type TonguePhoto, type PulseReading, type PulsePositionReading, type SymptomCalibration, type TreatmentAdherence, type TreatmentAdherenceItem, type ContextDocument, type AiDiagnosisRecord } from '../../types/patient';

const getStoredTherapyNames = (record: TreatmentPlan | Visit) => {
    const details = new Map((record.therapyDetails || []).flatMap(detail => {
        const keys = [detail.id, detail.name].filter(Boolean).map(key => normalizeTrackingName(key || ''));
        return keys.map(key => [key, detail.name] as const);
    }));
    return (record.therapies || [])
        .map(item => details.get(normalizeTrackingName(item)) || item)
        .filter(Boolean);
};

const getStoredHealthyHabitNames = (record: TreatmentPlan | Visit) => {
    const details = new Map((record.healthyEatingHabitDetails || []).map(detail => [normalizeTrackingName(detail.name), detail.name] as const));
    return (record.healthyEatingHabits || [])
        .map(item => details.get(normalizeTrackingName(item)) || item)
        .filter(Boolean);
};

interface Props {
    patientId: string | null;
    onClose: () => void;
}

const PULSE_SCHEMA: PulsePositionReading[] = [
    { side: 'right', sideLabel: 'Derecha', point: 'V', number: '1', superficialOrgan: 'Colon', deepOrgan: 'Pulmón', superficialStatus: '', deepStatus: '' },
    { side: 'right', sideLabel: 'Derecha', point: 'P', number: '2', superficialOrgan: 'Vesícula biliar', deepOrgan: 'Hígado', superficialStatus: '', deepStatus: '' },
    { side: 'right', sideLabel: 'Derecha', point: 'K', number: '3', superficialOrgan: 'Pericardio', deepOrgan: 'Circulación Vata/Pitta/Kapha', superficialStatus: '', deepStatus: '' },
    { side: 'left', sideLabel: 'Izquierda', point: 'K', number: '3', superficialOrgan: 'Vejiga', deepOrgan: 'Riñón', superficialStatus: '', deepStatus: '' },
    { side: 'left', sideLabel: 'Izquierda', point: 'P', number: '2', superficialOrgan: 'Estómago', deepOrgan: 'Bazo', superficialStatus: '', deepStatus: '' },
    { side: 'left', sideLabel: 'Izquierda', point: 'V', number: '1', superficialOrgan: 'Intestino delgado', deepOrgan: 'Corazón', superficialStatus: '', deepStatus: '' }
];

const PULSE_STATUS_OPTIONS = [
    { value: '', label: 'Sin marcar' },
    { value: 'normal', label: 'Normal' },
    { value: 'strong', label: 'Fuerte' },
    { value: 'weak', label: 'Débil' },
    { value: 'absent', label: 'No perceptible' }
];

const normalizeTrackingName = (value = '') => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const getRecordDateValue = (record: TreatmentPlan | Visit) => (
    ('visitDate' in record ? record.visitDate : '') || record.date || record.createdAt || ''
);

const createAdherenceItem = (name: string): TreatmentAdherenceItem => ({
    name,
    status: 'unknown',
    note: ''
});

const mergeAdherenceItems = (current: TreatmentAdherenceItem[] = [], names: string[] = []) => {
    const byName = new Map(current.map(item => [normalizeTrackingName(item.name), item]));
    return names
        .filter(Boolean)
        .map(name => byName.get(normalizeTrackingName(name)) || createAdherenceItem(name));
};

const getAdherenceClass = (status?: TreatmentAdherenceItem['status']) => {
    if (status === 'done') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'partial') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (status === 'not_done') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-slate-50 text-slate-500 border-slate-200';
};

const getFrequencyScore = (frequency = '') => {
    const normalized = frequency.toLowerCase();
    if (normalized.startsWith('superad') || normalized.startsWith('ningun')) return 0;
    if (normalized.startsWith('diaria') || normalized === 'd') return 3;
    if (normalized.startsWith('semanal') || normalized === 's') return 2;
    if (normalized.startsWith('mensual') || normalized === 'm') return 1;
    return 0;
};

const getSymptomScore = (value?: { frequency: string; intensity: number } | null) => {
    if (!value) return null;
    return getFrequencyScore(value.frequency) * Math.max(1, Number(value.intensity) || 1);
};

const getTrendMeta = (delta: number) => {
    if (delta < 0) return { label: 'Mejor', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', color: '#059669' };
    if (delta > 0) return { label: 'Peor', className: 'bg-red-50 text-red-700 border-red-200', color: '#dc2626' };
    return { label: 'Igual', className: 'bg-slate-50 text-slate-600 border-slate-200', color: '#64748b' };
};

// Nota de una foto de lengua ya existente: edita un campo de un registro que ya
// vive en el backend (PATCH por id), así que es un candidato seguro para autosave
// continuo. Se aísla en su propio componente para poder usar el hook de autosave
// por cada foto dentro de un .map() sin romper las reglas de hooks.
const TonguePhotoNoteEditor = ({
    initialNote,
    onSave
}: {
    initialNote: string;
    onSave: (note: string) => Promise<void>;
}) => {
    const [value, setValue] = useState(initialNote);
    const status = useAutosave(value, onSave, { delay: 900 });

    return (
        <div className="space-y-1.5">
            <SpeechTextarea
                value={value}
                onValueChange={setValue}
                rows={2}
                placeholder="Nota de la lengua: color, saburra, marcas, grietas..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] resize-none focus:ring-2 focus:ring-primary/15 focus:border-primary/30 outline-none"
            />
            <AutosaveIndicator status={status} />
        </div>
    );
};

const convertIntensityScaleValue = (value: number, fromScale: number, toScale: number): number => {
    const from = Number(fromScale) || 3;
    const to = Number(toScale) || 3;
    const v = Math.max(1, Math.min(from, Number(value) || 1));
    if (from === to) return v;
    const ratio = (v - 1) / (from - 1 || 1);
    return Math.max(1, Math.min(to, Math.round(1 + ratio * (to - 1))));
};

const getIntensityLabelText = (val: number, scale: number): string => {
    if (scale <= 3) {
        return { 1: 'Suave', 2: 'Moderado', 3: 'Fuerte' }[val] || 'Moderado';
    }
    const ratio = (val - 1) / (scale - 1 || 1);
    if (ratio <= 1 / 3) return 'Suave';
    if (ratio <= 2 / 3) return 'Moderado';
    return 'Fuerte';
};

export const PatientDetailPanel = ({ patientId, onClose }: Props) => {
    const [patient, setPatient] = useState<PatientDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [diagnosis, setDiagnosis] = useState<string | null>(null);
    const [chatMessage, setChatMessage] = useState('');
    const [chatHistory, setChatHistory] = useState<{ role: 'ai' | 'user', text: string }[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [aiProvider, setAiProvider] = useState<'gemini' | 'deepseek'>('deepseek');
    const [aiModel, setAiModel] = useState<string>('deepseek-v4-flash');
    const [isPanelFullScreen, setIsPanelFullScreen] = useState(false);

    // Treatment PDF Modal State
    const [isTreatmentModalOpen, setIsTreatmentModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<{ type: 'plan' | 'visit'; record: any } | null>(null);
    const [activeTreatmentPatientId, setActiveTreatmentPatientId] = useState<string | null>(null);

    // Doctor notes state
    const [doctorNotes, setDoctorNotes] = useState<DoctorNote[]>([]);
    const [newNotes, setNewNotes] = useState<Record<string, string>>({});
    const [savingNote, setSavingNote] = useState(false);
    const [noteError, setNoteError] = useState(''); // feedback de error al guardar nota (fix #11)
    const [uploadingTonguePhoto, setUploadingTonguePhoto] = useState(false);
    const [tonguePhotoError, setTonguePhotoError] = useState('');
    const [pulseDate, setPulseDate] = useState(new Date().toISOString().split('T')[0]);
    const [pulsePositions, setPulsePositions] = useState<PulsePositionReading[]>(PULSE_SCHEMA);
    const [pulseNotes, setPulseNotes] = useState('');
    const [savingPulseReading, setSavingPulseReading] = useState(false);
    const [pulseError, setPulseError] = useState('');
    const [activeTonguePhoto, setActiveTonguePhoto] = useState<TonguePhoto | null>(null);
    const [uploadingContextDoc, setUploadingContextDoc] = useState(false);
    const [contextDocError, setContextDocError] = useState('');
    // Importación de síntomas desde .txt (fix #8/#9)
    const [importingSymptoms, setImportingSymptoms] = useState(false);
    const [symptomImportMsg, setSymptomImportMsg] = useState('');
    // Pegar tabla de síntomas (cualquier formato: Excel/Word/Markdown/CSV) para autorellenar
    const [showSymptomPasteBox, setShowSymptomPasteBox] = useState(false);
    const [pasteSymptomTableText, setPasteSymptomTableText] = useState('');

    // Grouping and active sub-tabs state
    const [activeUploadGroupDate, setActiveUploadGroupDate] = useState<string | null>(null);
    const [addingPulseGroupId, setAddingPulseGroupId] = useState<string | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [activeVisitTabs, setActiveVisitTabs] = useState<Record<string, 'treatment' | 'pulse' | 'tongue' | 'notes' | 'symptoms' | 'ficha'>>({});

    // Visit state
    const [isAddingVisit, setIsAddingVisit] = useState(false);
    const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
    // Modo "Editar Caso" usando la interfaz de Nueva Visita (fix #12). Cuando está
    // activo, el guardado actualiza la consulta inicial del paciente (ficha + plan
    // base) en lugar de crear una visita de seguimiento.
    const [editCaseMode, setEditCaseMode] = useState(false);
    // Vista aparte de "Seguimiento terapéutico": resumen acumulado de todas las
    // visitas y tratamientos (se abre con el botón junto a "Editar Caso").
    const [showTrackingView, setShowTrackingView] = useState(false);
    const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
    const [visitNote, setVisitNote] = useState('');
    const [visitDiagnosis, setVisitDiagnosis] = useState('');
    const [visitTreatment, setVisitTreatment] = useState('');
    const [visitLifestyle, setVisitLifestyle] = useState('');
    const [visitTongue, setVisitTongue] = useState(''); // Observaciones de lengua (fix #14)
    const [visitTonguePhotos, setVisitTonguePhotos] = useState<TonguePhoto[]>([]); // Fotos de lengua de esta consulta
    const [visitSymptoms, setVisitSymptoms] = useState<Record<string, { frequency: string; intensity: number; note?: string }>>({});
    const [visitAdherence, setVisitAdherence] = useState<TreatmentAdherence>({ categories: [], herbs: [], generalNote: '' });
    const [visitTrackedCategories, setVisitTrackedCategories] = useState<string[]>([]);
    const [visitTrackedHerbs, setVisitTrackedHerbs] = useState<any[]>([]);
    const [newVisitSymptomName, setNewVisitSymptomName] = useState('');
    const [newRecordSymptomName, setNewRecordSymptomName] = useState('');
    const [newVisitHerbName, setNewVisitHerbName] = useState('');
    const [newVisitHerbDosage, setNewVisitHerbDosage] = useState('');
    // Se incrementa cada vez que se registra el uso de una fórmula, para refrescar
    // el listado de "Fórmulas más usadas" leído desde localStorage.
    const [formulaUsageVersion, setFormulaUsageVersion] = useState(0);
    const mostUsedFormulas = useMemo(() => {
        const counts = readFormulaUsageCounts();
        const list = Object.values(counts)
            .sort((a, b) => b.count - a.count)
            .map(c => c.name);
        // Mientras se acumula uso real (el conteo se guarda por dispositivo y arranca
        // vacío), se completa con las fórmulas personalizadas ya creadas en la base de
        // datos (herb.json / custom_formulas.json), para que el selector no aparezca
        // vacío desde el primer momento.
        if (list.length < 8) {
            const fallback = (herbsList as Array<{ name?: string; isCustom?: boolean }>)
                .filter(h => h.isCustom && h.name)
                .map(h => (h.name || '').trim());
            for (const name of fallback) {
                if (list.length >= 8) break;
                if (name && !list.some(n => n.toLowerCase() === name.toLowerCase())) {
                    list.push(name);
                }
            }
        }
        return list.slice(0, 8);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formulaUsageVersion]);

    // Edit Case States
    const [isEditingCase, setIsEditingCase] = useState(false);
    const [editName, setEditName] = useState('');
    const [editAge, setEditAge] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editDosha, setEditDosha] = useState('');
    const [editSymptomCalibrations, setEditSymptomCalibrations] = useState<SymptomCalibration[]>([]);
    const [editPlainSymptoms, setEditPlainSymptoms] = useState<string[]>([]);
    const [newEditSymptomName, setNewEditSymptomName] = useState('');
    const [savingCase, setSavingCase] = useState(false);
    const [caseError, setCaseError] = useState('');
    const [editIntensityScale, setEditIntensityScale] = useState<3 | 10>(3);
    const [visitIntensityScale, setVisitIntensityScale] = useState<3 | 10>(3);

    // Ficha del paciente dentro de "Editar Caso" (fix: ver lo que llenó el paciente,
    // categorizado y en vista toggle, sin salir del modal de edición del caso).
    const [showIntakeSummary, setShowIntakeSummary] = useState(false);
    const [intakeViewMode, setIntakeViewMode] = useState<'categorized' | 'list'>('categorized');
    const [openIntakeCategories, setOpenIntakeCategories] = useState<Record<string, boolean>>({ sintomas: true });

    const [savingVisit, setSavingVisit] = useState(false);
    const [visitAutosaveError, setVisitAutosaveError] = useState('');
    const [savingRecordId, setSavingRecordId] = useState<string | null>(null);
    const [openRecord, setOpenRecord] = useState<{ type: 'plan'; record: TreatmentPlan } | { type: 'visit'; record: Visit } | null>(null);
    const [recordEditorMode, setRecordEditorMode] = useState<'full' | 'half'>('full');
    const [recordSaveError, setRecordSaveError] = useState('');

    // View modes for markdown previews in editable overlays
    const [diagnosisViewMode, setDiagnosisViewMode] = useState<'edit' | 'preview'>('edit');
    // Modo de edición del informe diagnóstico generado por IA (antes de guardarlo).
    const [aiDiagnosisViewMode, setAiDiagnosisViewMode] = useState<'edit' | 'preview'>('preview');
    // Historial de diagnósticos generados con IA (desplegable).
    const [aiHistoryOpen, setAiHistoryOpen] = useState(false);
    const [expandedAiDiagnosisId, setExpandedAiDiagnosisId] = useState<string | null>(null);
    const [deletingAiDiagnosisId, setDeletingAiDiagnosisId] = useState<string | null>(null);
    const [treatmentViewMode, setTreatmentViewMode] = useState<'edit' | 'preview'>('edit');
    const [lifestyleViewMode, setLifestyleViewMode] = useState<'edit' | 'preview'>('edit');

    useEffect(() => {
        setDiagnosisViewMode('edit');
        setTreatmentViewMode('edit');
        setLifestyleViewMode('edit');
        setRecordSaveError('');
    }, [openRecord?.record.id]);

    useEffect(() => {
        if (isAddingVisit) setVisitAutosaveError('');
    }, [isAddingVisit]);



    useEffect(() => {
        if (patientId) {
            fetchPatientDetails();
            fetchDoctorNotes();
            // Reset AI and visit states when switching patients
            setDiagnosis(null);
            setChatHistory([]);
            setExpandedGroups({});
            setActiveVisitTabs({});
            setAddingPulseGroupId(null);
            setActiveUploadGroupDate(null);
            // Las notas nuevas y la lectura de pulso son registros que se CREAN (no se
            // editan en sitio), así que no se autoguardan contra el servidor tecla a
            // tecla — eso duplicaría entradas. En su lugar, restauramos aquí el
            // borrador local (si el profesional cerró el panel a medio escribir) y
            // se sigue guardando de verdad solo con el botón "Guardar".
            const notesDraft = readDraft(`draft:notes:${patientId}`);
            setNewNotes(notesDraft ? JSON.parse(notesDraft) : {});
            const pulseDraft = readDraft(`draft:pulse:${patientId}`);
            if (pulseDraft) {
                try {
                    const parsed = JSON.parse(pulseDraft);
                    setPulseNotes(parsed.notes || '');
                    if (Array.isArray(parsed.positions) && parsed.positions.length === PULSE_SCHEMA.length) {
                        setPulsePositions(parsed.positions);
                    }
                } catch {
                    // borrador corrupto: se ignora
                }
            } else {
                setPulseNotes('');
                setPulsePositions(PULSE_SCHEMA);
            }
        }
    }, [patientId]);

    // Borradores locales (no van al servidor) para las cajas de "nueva nota" y
    // "nueva lectura de pulso": protegen contra pérdida de texto si cierras el
    // panel antes de darle clic a Guardar, sin crear entradas duplicadas.
    useDraftPersist(patientId ? `draft:notes:${patientId}` : null, JSON.stringify(newNotes));
    useDraftPersist(
        patientId ? `draft:pulse:${patientId}` : null,
        (pulseNotes.trim() || pulsePositions.some(p => p.superficialStatus || p.deepStatus))
            ? JSON.stringify({ notes: pulseNotes, positions: pulsePositions })
            : ''
    );

    const fetchPatientDetails = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/patients/${patientId}`);
            const data = await res.json();
            if (data.success) {
                setPatient(data.patient);
            }
        } catch (error) {
            console.error('Error fetching patient details:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDoctorNotes = async () => {
        try {
            const res = await fetch(`/api/patients/${patientId}/notes`);
            const data = await res.json();
            if (data.success) {
                setDoctorNotes(data.notes);
            }
        } catch (error) {
            console.error('Error fetching doctor notes:', error);
        }
    };

    const visitGroups = useMemo(() => {
        if (!patient) return [];

        let initialDate: string = patient.createdAt || '';
        if (!initialDate) {
            const dates = [
                ...(patient.treatmentPlans || []).map(p => p.date || p.createdAt),
                ...(patient.pulseReadings || []).map(p => p.date || p.createdAt),
                ...(patient.tonguePhotos || []).map(p => p.createdAt),
                ...(patient.visits || []).map(p => p.date),
                ...doctorNotes.map(n => n.createdAt)
            ].filter((d): d is string => !!d);
            
            if (dates.length > 0) {
                dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                initialDate = dates[0];
            } else {
                initialDate = new Date().toISOString();
            }
        }

        const initialGroup = {
            id: 'initial',
            type: 'initial' as const,
            label: 'Consulta inicial',
            date: initialDate,
            pulseReadings: [] as PulseReading[],
            tonguePhotos: [] as TonguePhoto[],
            notes: [] as DoctorNote[],
            treatmentPlans: [] as TreatmentPlan[],
            visitRecord: undefined as Visit | undefined,
            symptoms: {
                type: 'initial' as const,
                data: patient.symptomCalibrations || []
            }
        };

        const sortedVisits = [...(patient.visits || [])].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const followupGroups = sortedVisits.map((visit, index) => {
            const visitNumber = index + 2;
            return {
                id: visit.id || `visit-${index}`,
                type: 'followup' as const,
                label: `Visita de seguimiento ${visitNumber}`,
                date: visit.date,
                pulseReadings: [] as PulseReading[],
                tonguePhotos: [] as TonguePhoto[],
                notes: [] as DoctorNote[],
                treatmentPlans: [] as TreatmentPlan[],
                visitRecord: visit,
                symptoms: {
                    type: 'followup' as const,
                    data: visit.symptoms || {}
                }
            };
        });

        const allGroups = [initialGroup, ...followupGroups];

        const findClosestGroup = (dateStr?: string) => {
            if (!dateStr) return initialGroup;
            const time = new Date(dateStr).getTime();
            let closest: typeof initialGroup | typeof followupGroups[number] = initialGroup;
            let minDiff = Math.abs(new Date(initialGroup.date).getTime() - time);

            for (const group of followupGroups) {
                const diff = Math.abs(new Date(group.date).getTime() - time);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = group;
                }
            }
            return closest;
        };

        for (const pulse of patient.pulseReadings || []) {
            const group = findClosestGroup(pulse.date || pulse.createdAt);
            group.pulseReadings.push(pulse);
        }

        for (const photo of patient.tonguePhotos || []) {
            const group = findClosestGroup(photo.createdAt);
            group.tonguePhotos.push(photo);
        }

        for (const note of doctorNotes || []) {
            const group = findClosestGroup(note.createdAt);
            group.notes.push(note);
        }

        for (const plan of patient.treatmentPlans || []) {
            const group = findClosestGroup(plan.visitDate || plan.date || plan.createdAt);
            group.treatmentPlans.push(plan);
        }

        // Sort descending (newest first)
        allGroups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return allGroups;
    }, [patient, doctorNotes]);

    const therapeuticSummary = useMemo(() => {
        const records = [
            ...((patient?.treatmentPlans || []).map(record => ({ type: 'plan' as const, record }))),
            ...((patient?.visits || []).map(record => ({ type: 'visit' as const, record })))
        ].sort((a, b) => new Date(getRecordDateValue(b.record)).getTime() - new Date(getRecordDateValue(a.record)).getTime());

        type RecordRef = { type: 'plan' | 'visit'; id: string };
        type Occurrence = { title: string; date: string };
        const categories = new Map<string, { name: string; count: number; lastDate: string; lastRecency: number; lastStatus?: TreatmentAdherenceItem['status']; notes: string[]; lastRecordRef?: RecordRef; lastRecordTitle?: string; occurrences: Occurrence[] }>();
        const herbs = new Map<string, { name: string; count: number; lastDate: string; lastRecency: number; lastStatus?: TreatmentAdherenceItem['status']; notes: string[]; lastRecordRef?: RecordRef; lastRecordTitle?: string; occurrences: Occurrence[] }>();
        const therapies = new Map<string, { name: string; count: number; lastDate: string; lastRecency: number; lastStatus?: TreatmentAdherenceItem['status']; notes: string[]; lastRecordRef?: RecordRef; lastRecordTitle?: string; occurrences: Occurrence[] }>();
        const healthyHabits = new Map<string, { name: string; count: number; lastDate: string; lastRecency: number; lastStatus?: TreatmentAdherenceItem['status']; notes: string[]; lastRecordRef?: RecordRef; lastRecordTitle?: string; occurrences: Occurrence[] }>();
        let reviewedCount = 0;

        const isMeaningfulStatus = (status?: TreatmentAdherenceItem['status']) => !!status && status !== 'unknown';
        const recencyOf = (record: TreatmentPlan | Visit) =>
            new Date(record.updatedAt || getRecordDateValue(record) || record.createdAt || 0).getTime();

        const touch = (
            map: typeof categories,
            name: string,
            date: string,
            recency: number,
            adherence?: TreatmentAdherenceItem,
            recordRef?: RecordRef,
            recordTitle?: string
        ) => {
            const key = normalizeTrackingName(name);
            if (!key) return;
            const existing = map.get(key) || { name, count: 0, lastDate: '', lastRecency: -Infinity, notes: [], occurrences: [] };
            existing.count += 1;
            existing.occurrences.push({ title: recordTitle || '', date });
            const status = adherence?.status;
            // Prefer the most recently updated record. On a tie (same timestamp, e.g. a
            // duplicate visit on the same day), prefer a record that actually has a
            // reviewed status over an unreviewed ("Sin revisar") one.
            const isNewer = recency > existing.lastRecency;
            const isTieButMeaningful = recency === existing.lastRecency
                && isMeaningfulStatus(status) && !isMeaningfulStatus(existing.lastStatus);
            if (existing.lastRecency === -Infinity || isNewer || isTieButMeaningful) {
                existing.lastRecency = recency;
                existing.lastDate = date;
                existing.lastStatus = status;
                existing.lastRecordRef = recordRef;
                existing.lastRecordTitle = recordTitle;
            }
            if (adherence?.note?.trim()) existing.notes.push(adherence.note.trim());
            map.set(key, existing);
        };

        records.forEach(({ type, record }) => {
            const date = getRecordDateValue(record);
            const recency = recencyOf(record);
            const adherence = record.adherence || {};
            const recordRef: RecordRef | undefined = record.id ? { type, id: record.id } : undefined;
            const recordTitle = record.title?.trim() || (type === 'plan' ? 'Tratamiento' : 'Visita');
            if (
                (adherence.categories || []).some(item => item.status && item.status !== 'unknown') ||
                (adherence.herbs || []).some(item => item.status && item.status !== 'unknown') ||
                adherence.generalNote?.trim()
            ) {
                reviewedCount += 1;
            }

            (record.categories || []).forEach(name => {
                const item = (adherence.categories || []).find(entry => normalizeTrackingName(entry.name) === normalizeTrackingName(name));
                touch(categories, name, date, recency, item, recordRef, recordTitle);
            });

            (record.herbs || []).forEach(herb => {
                const item = (adherence.herbs || []).find(entry => normalizeTrackingName(entry.name) === normalizeTrackingName(herb.formula));
                touch(herbs, herb.formula, date, recency, item, recordRef, recordTitle);
            });

            // Sólo cuentan las terapias/hábitos cuya sección se incluyó realmente en el
            // PDF. Registros antiguos guardaban la lista completa de hábitos aunque la
            // sección estuviera apagada (showHealthyEatingGuide: false).
            if (record.showTherapiesSection !== false) {
                getStoredTherapyNames(record).forEach(name => {
                    touch(therapies, name, date, recency, undefined, recordRef, recordTitle);
                });
            }

            if (record.showHealthyEatingGuide !== false) {
                getStoredHealthyHabitNames(record).forEach(name => {
                    const item = (adherence.healthyHabits || []).find(entry => normalizeTrackingName(entry.name) === normalizeTrackingName(name));
                    touch(healthyHabits, name, date, recency, item, recordRef, recordTitle);
                });
            }
        });

        return {
            records,
            reviewedCount,
            categories: Array.from(categories.values()),
            herbs: Array.from(herbs.values()),
            therapies: Array.from(therapies.values()),
            healthyHabits: Array.from(healthyHabits.values())
        };
    }, [patient]);

    const symptomEvolution = useMemo(() => {
        if (!patient) {
            return { labels: [] as string[], symptoms: [] as Array<{ name: string; values: Array<number | null>; delta: number; first: number; last: number }>, averageDelta: 0 };
        }

        const chronologicalVisits = [...(patient.visits || [])].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const labels = [
            'Inicial',
            ...chronologicalVisits.map((_, index) => `V${index + 2}`),
            ...(isAddingVisit ? ['Nueva visita'] : [])
        ];

        const allSymptoms = new Set<string>();
        patient.symptomCalibrations.forEach(item => allSymptoms.add(item.symptom));
        chronologicalVisits.forEach(visit => {
            Object.keys(visit.symptoms || {}).forEach(symptom => allSymptoms.add(symptom));
        });
        Object.keys(isAddingVisit ? visitSymptoms : {}).forEach(symptom => allSymptoms.add(symptom));
        patient.plainSymptoms.forEach(symptom => allSymptoms.add(symptom));

        const symptoms = Array.from(allSymptoms).map(name => {
            const initial = patient.symptomCalibrations.find(item => item.symptom === name);
            const values = [
                getSymptomScore(initial ? { frequency: initial.frequency, intensity: initial.intensity } : null),
                ...chronologicalVisits.map(visit => getSymptomScore(visit.symptoms?.[name] || null)),
                ...(isAddingVisit ? [getSymptomScore(visitSymptoms[name] || null)] : [])
            ];
            const validValues = values.filter((value): value is number => value !== null);
            const first = validValues[0] ?? 0;
            const last = validValues[validValues.length - 1] ?? first;

            return { name, values, first, last, delta: last - first };
        });

        const tracked = symptoms.filter(item => item.values.filter(value => value !== null).length >= 2);
        const averageDelta = tracked.length
            ? tracked.reduce((sum, item) => sum + item.delta, 0) / tracked.length
            : 0;

        return { labels, symptoms, averageDelta };
    }, [patient, isAddingVisit, visitSymptoms]);

    const getLatestTreatmentForVisit = (excludeId?: string) => {
        if (!patient) return null;

        const records = [
            ...(patient.treatmentPlans || []).map(record => ({ type: 'plan' as const, record })),
            ...(patient.visits || []).map(record => ({ type: 'visit' as const, record }))
        ]
            .filter(({ record }) => !excludeId || record.id !== excludeId)
            .filter(({ record }) => (record.categories || []).length > 0 || (record.herbs || []).length > 0)
            .sort((a, b) => new Date(getRecordDateValue(b.record)).getTime() - new Date(getRecordDateValue(a.record)).getTime());

        return records[0]?.record || null;
    };

    // Combina los nombres ya presentes en un checklist de adherencia con los del
    // tratamiento de referencia, para no perder ítems ya marcados ni ítems nuevos.
    const unionAdherenceNames = (current: TreatmentAdherenceItem[] = [], extraNames: string[] = []) => {
        const names = new Map<string, string>();
        current.forEach(item => {
            const key = normalizeTrackingName(item.name);
            if (key) names.set(key, item.name);
        });
        extraNames.forEach(name => {
            const key = normalizeTrackingName(name);
            if (key && !names.has(key)) names.set(key, name);
        });
        return Array.from(names.values());
    };

    const buildNewVisitAdherence = (record: TreatmentPlan | Visit | null): TreatmentAdherence => ({
        categories: mergeAdherenceItems([], record?.categories || []),
        herbs: mergeAdherenceItems([], (record?.herbs || []).map(herb => herb.formula)),
        generalNote: '',
        updatedAt: new Date().toISOString()
    });

    const openNewVisitModal = () => {
        setIsAddingVisit(true);
        setEditingVisitId(null);
        setVisitDate(new Date().toISOString().split('T')[0]);
        setVisitIntensityScale(patient?.intensityScale || 3);
        setVisitNote('');
        // Prepobla el diagnóstico de la visita con el generado por IA (o el último
        // diagnóstico local) para no tener que copiarlo a mano (fix #10).
        const aiDiagnosis = diagnosis && diagnosis.trim() && !diagnosis.startsWith('Error') ? diagnosis : '';
        setVisitDiagnosis(aiDiagnosis || getLatestLocalDiagnosis() || '');
        setVisitTreatment('');
        setVisitLifestyle('');
        setVisitTongue('');
        setVisitTonguePhotos([]);
        setNewVisitHerbName('');
        setNewVisitHerbDosage('');

        const latestSymptoms: Record<string, { frequency: string; intensity: number; note?: string }> = {};
        patient?.symptomCalibrations.forEach(s => {
            latestSymptoms[s.symptom] = { frequency: s.frequency, intensity: s.intensity };
        });
        patient?.plainSymptoms?.forEach(s => {
            if (s && !latestSymptoms[s]) {
                latestSymptoms[s] = { frequency: 'Semanal', intensity: 2 };
            }
        });
        [...(patient?.visits || [])].reverse().forEach(v => {
            if (v.symptoms) {
                Object.assign(latestSymptoms, v.symptoms);
            }
        });
        setVisitSymptoms(latestSymptoms);

        const latestTreatment = getLatestTreatmentForVisit();
        // La selección de categorías/fórmulas para ESTA visita empieza vacía: solo lo
        // que el profesional elija aquí se guarda en la visita y aparece en el PDF.
        // La adherencia ("qué hizo el paciente") sí se siembra con el tratamiento
        // anterior para poder revisarlo.
        setVisitTrackedCategories([]);
        setVisitTrackedHerbs([]);
        setVisitAdherence(buildNewVisitAdherence(latestTreatment));
    };

    const openEditVisitModal = (visit: Visit) => {
        if (!visit?.id) return;
        setIsAddingVisit(true);
        setEditingVisitId(visit.id);
        setVisitDate((visit.date || new Date().toISOString()).slice(0, 10));
        setVisitIntensityScale(patient?.intensityScale || 3);
        setVisitNote(visit.note || '');
        setVisitDiagnosis(visit.diagnosis || '');
        setVisitTreatment(visit.treatment || '');
        setVisitLifestyle(visit.lifestyle || '');
        setVisitTongue(visit.tongue || '');
        setVisitTonguePhotos(
            (patient?.tonguePhotos || []).filter(p => (p.createdAt || '').slice(0, 10) === (visit.date || '').slice(0, 10))
        );
        setVisitSymptoms({ ...(visit.symptoms || {}) });
        setVisitTrackedCategories([...(visit.categories || [])]);
        setVisitTrackedHerbs(mapHerbsWithPurpose(visit.herbs || []));
        // Reconstruye el checklist combinando lo ya guardado en esta visita con el
        // tratamiento previo (excluyendo la propia visita). Así, si esta visita se
        // guardó antes de que existiera el checklist (o el profesional agregó
        // categorías nuevas al tratamiento previo después), los ítems reaparecen
        // listos para marcar en vez de mostrarse vacíos.
        const previousTreatment = getLatestTreatmentForVisit(visit.id);
        const existingCategories = visit.adherence?.categories || [];
        const existingHerbs = visit.adherence?.herbs || [];
        const categoryNames = unionAdherenceNames(existingCategories, previousTreatment?.categories || []);
        const herbNames = unionAdherenceNames(existingHerbs, (previousTreatment?.herbs || []).map(herb => herb.formula));
        setVisitAdherence({
            categories: mergeAdherenceItems(existingCategories, categoryNames),
            herbs: mergeAdherenceItems(existingHerbs, herbNames),
            lifestyle: visit.adherence?.lifestyle ? [...visit.adherence.lifestyle] : [],
            generalNote: visit.adherence?.generalNote || '',
            updatedAt: visit.adherence?.updatedAt
        });
        setNewVisitHerbName('');
        setNewVisitHerbDosage('');
        setNewVisitSymptomName('');
    };

    useEffect(() => {
        if (visitGroups.length > 0) {
            const firstGroupId = visitGroups[0].id;
            setExpandedGroups(prev => {
                if (Object.keys(prev).length === 0) {
                    return { [firstGroupId]: true };
                }
                return prev;
            });
        }
    }, [visitGroups]);

    const handleSaveNote = async (groupId: string, customText?: string | null) => {
        const textToSave = typeof customText === 'string' ? customText : (newNotes[groupId] || '');
        if (!textToSave.trim()) return;
        setSavingNote(true);
        setNoteError('');
        try {
            const group = visitGroups.find(g => g.id === groupId);
            const date = group ? group.date : new Date().toISOString();

            const res = await fetch(`/api/patients/${patientId}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textToSave, date })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setDoctorNotes(prev => [...prev, data.note]);
                if (typeof customText !== 'string') {
                    // El estado newNotes ya queda sin este grupo; el borrador local se
                    // re-escribe solo (con debounce) reflejando ese mismo estado.
                    setNewNotes(prev => ({ ...prev, [groupId]: '' }));
                }
            } else {
                // Antes el fallo era silencioso: el profesional no sabía por qué no
                // se guardaba la nota (típico en casos de Notion). Ahora se avisa (fix #11).
                setNoteError(data.error || 'No se pudo guardar la nota. Verifica la conexión con Notion.');
            }
        } catch (error) {
            console.error('Error saving note:', error);
            setNoteError(error instanceof Error ? error.message : 'No se pudo guardar la nota.');
        } finally {
            setSavingNote(false);
        }
    };

    const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(file);
    });

    const handleTonguePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !patientId) return;

        setTonguePhotoError('');
        const isHeicFile = /\.(heic|heif)$/i.test(file.name);
        if (!file.type.startsWith('image/') && !isHeicFile) {
            setTonguePhotoError('Selecciona una imagen válida: PNG, JPG, WEBP, HEIC o HEIF.');
            return;
        }
        if (file.size > 12 * 1024 * 1024) {
            setTonguePhotoError('La foto supera el límite de 12 MB.');
            return;
        }

        setUploadingTonguePhoto(true);
        try {
            const dataUrl = await readFileAsDataUrl(file);
            const res = await fetch(`/api/patients/${patientId}/tongue-photos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: file.name,
                    type: file.type,
                    dataUrl,
                    date: activeUploadGroupDate
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'No se pudo guardar la foto.');
            }
            setPatient(prev => prev ? {
                ...prev,
                tonguePhotos: [data.photo, ...(prev.tonguePhotos || [])]
            } : prev);
        } catch (error) {
            setTonguePhotoError(error instanceof Error ? error.message : 'No se pudo guardar la foto.');
        } finally {
            setUploadingTonguePhoto(false);
        }
    };

    // Subir foto de lengua desde el formulario de Nueva Visita / Editar Caso (fix #14).
    // Usa la fecha de la consulta y la observación de lengua como nota de la foto.
    const handleVisitTonguePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        const uploadPatientId = patientId || patient?.id;
        if (!uploadPatientId) return;

        setTonguePhotoError('');
        const isHeicFile = /\.(heic|heif)$/i.test(file.name);
        if (!file.type.startsWith('image/') && !isHeicFile) {
            setTonguePhotoError('Selecciona una imagen válida: PNG, JPG, WEBP, HEIC o HEIF.');
            return;
        }
        if (file.size > 12 * 1024 * 1024) {
            setTonguePhotoError('La foto supera el límite de 12 MB.');
            return;
        }

        setUploadingTonguePhoto(true);
        try {
            const dataUrl = await readFileAsDataUrl(file);
            const res = await fetch(`/api/patients/${uploadPatientId}/tongue-photos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: file.name,
                    type: file.type,
                    dataUrl,
                    date: visitDate,
                    note: visitTongue || ''
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'No se pudo guardar la foto.');
            }
            setPatient(prev => prev ? {
                ...prev,
                tonguePhotos: [data.photo, ...(prev.tonguePhotos || [])]
            } : prev);
            setVisitTonguePhotos(prev => [data.photo, ...prev]);
        } catch (error) {
            setTonguePhotoError(error instanceof Error ? error.message : 'No se pudo guardar la foto.');
        } finally {
            setUploadingTonguePhoto(false);
        }
    };

    const handleUpdateTonguePhotoNote = async (photo: TonguePhoto, note: string) => {
        if (!patientId) return;
        setTonguePhotoError('');
        try {
            const res = await fetch(`/api/patients/${patientId}/tongue-photos/${photo.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'No se pudo guardar la nota.');
            }
            setPatient(prev => prev ? {
                ...prev,
                tonguePhotos: (prev.tonguePhotos || []).map(item =>
                    item.id === photo.id ? { ...item, note, updatedAt: data.photo?.updatedAt } : item
                )
            } : prev);
        } catch (error) {
            setTonguePhotoError(error instanceof Error ? error.message : 'No se pudo guardar la nota.');
            throw error;
        }
    };

    const handleDeleteTonguePhoto = async (photo: TonguePhoto) => {
        if (!patientId) return;
        setTonguePhotoError('');
        try {
            const res = await fetch(`/api/patients/${patientId}/tongue-photos/${photo.id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'No se pudo borrar la foto.');
            }
            setPatient(prev => prev ? {
                ...prev,
                tonguePhotos: (prev.tonguePhotos || []).filter(item => item.id !== photo.id)
            } : prev);
        } catch (error) {
            setTonguePhotoError(error instanceof Error ? error.message : 'No se pudo borrar la foto.');
        }
    };

    const readFileAsText = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
        reader.readAsText(file);
    });

    const handleContextDocUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        if (!patientId || files.length === 0) return;

        setContextDocError('');
        const allowed = ['txt', 'md', 'markdown', 'csv', 'tsv', 'text'];
        setUploadingContextDoc(true);
        try {
            for (const file of files) {
                const ext = (file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]) || '';
                if (!allowed.includes(ext)) {
                    setContextDocError('Solo se permiten archivos de texto: .txt, .md, .csv o .tsv.');
                    continue;
                }
                if (file.size > 2 * 1024 * 1024) {
                    setContextDocError(`"${file.name}" supera el límite de 2 MB.`);
                    continue;
                }
                const content = await readFileAsText(file);
                const res = await fetch(`/api/patients/${patientId}/context-docs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: file.name, content })
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.error || 'No se pudo guardar el documento.');
                }
                setPatient(prev => prev ? {
                    ...prev,
                    contextDocuments: [data.document, ...(prev.contextDocuments || [])]
                } : prev);
            }
        } catch (error) {
            setContextDocError(error instanceof Error ? error.message : 'No se pudo guardar el documento.');
        } finally {
            setUploadingContextDoc(false);
        }
    };

    const handleDeleteContextDoc = async (doc: ContextDocument) => {
        if (!patientId) return;
        setContextDocError('');
        try {
            const res = await fetch(`/api/patients/${patientId}/context-docs/${doc.id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'No se pudo borrar el documento.');
            }
            setPatient(prev => prev ? {
                ...prev,
                contextDocuments: (prev.contextDocuments || []).filter(item => item.id !== doc.id)
            } : prev);
        } catch (error) {
            setContextDocError(error instanceof Error ? error.message : 'No se pudo borrar el documento.');
        }
    };

    const updatePulsePosition = (index: number, field: 'superficialStatus' | 'deepStatus', value: string) => {
        setPulsePositions(prev => prev.map((position, positionIndex) =>
            positionIndex === index ? { ...position, [field]: value } : position
        ));
    };

    const handleSavePulseReading = async () => {
        if (!patientId) return;
        setPulseError('');
        setSavingPulseReading(true);
        try {
            const res = await fetch(`/api/patients/${patientId}/pulse-readings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: pulseDate,
                    positions: pulsePositions,
                    notes: pulseNotes
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'No se pudo guardar el pulso.');
            }
            setPatient(prev => prev ? {
                ...prev,
                pulseReadings: [data.reading, ...(prev.pulseReadings || [])]
            } : prev);
            setPulsePositions(PULSE_SCHEMA);
            setPulseNotes('');
            setPulseDate(new Date().toISOString().split('T')[0]);
            clearDraft(`draft:pulse:${patientId}`);
        } catch (error) {
            setPulseError(error instanceof Error ? error.message : 'No se pudo guardar el pulso.');
        } finally {
            setSavingPulseReading(false);
        }
    };

    const handleDeletePulseReading = async (reading: PulseReading) => {
        if (!patientId) return;
        setPulseError('');
        try {
            const res = await fetch(`/api/patients/${patientId}/pulse-readings/${reading.id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'No se pudo borrar la lectura.');
            }
            setPatient(prev => prev ? {
                ...prev,
                pulseReadings: (prev.pulseReadings || []).filter(item => item.id !== reading.id)
            } : prev);
        } catch (error) {
            setPulseError(error instanceof Error ? error.message : 'No se pudo borrar la lectura.');
        }
    };

    const handleDiagnose = async () => {
        if (!patient) return;
        setAiLoading(true);
        try {
            const res = await fetch('/api/ai/diagnose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientData: patient.fullNotes,
                    patient: patient,
                    provider: aiProvider,
                    model: aiProvider === 'deepseek' ? aiModel : undefined
                })
            });
            const data = await res.json();
            if (data.success) {
                setDiagnosis(data.diagnosis);
                if (data.dosha && !patient.dosha?.trim()) {
                    setPatient(prev => prev ? { ...prev, dosha: data.dosha } : null);
                }
                if (data.savedAiDiagnosis) {
                    setPatient(prev => prev ? {
                        ...prev,
                        aiDiagnoses: [data.savedAiDiagnosis, ...(prev.aiDiagnoses || [])]
                    } : prev);
                }
            } else {
                setDiagnosis(`Error: ${data.error || 'No se pudo generar el diagnóstico.'}`);
            }
        } catch (error) {
            console.error('AI Diagnosis error:', error);
            setDiagnosis('Error de conexión al generar el diagnóstico.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleDeleteAiDiagnosis = async (entry: AiDiagnosisRecord) => {
        if (!patientId) return;
        setDeletingAiDiagnosisId(entry.id);
        try {
            const res = await fetch(`/api/patients/${patientId}/ai-diagnoses/${entry.id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'No se pudo borrar el diagnóstico.');
            }
            setPatient(prev => prev ? {
                ...prev,
                aiDiagnoses: (prev.aiDiagnoses || []).filter(item => item.id !== entry.id)
            } : prev);
            setExpandedAiDiagnosisId(prev => prev === entry.id ? null : prev);
        } catch (error) {
            console.error('Error deleting AI diagnosis:', error);
        } finally {
            setDeletingAiDiagnosisId(null);
        }
    };

    const patchPatientPlan = (planId: string, updates: Partial<TreatmentPlan>) => {
        setPatient(prev => prev ? {
            ...prev,
            treatmentPlans: (prev.treatmentPlans || []).map(plan =>
                plan.id === planId ? { ...plan, ...updates } : plan
            )
        } : prev);
        setOpenRecord(prev => prev?.type === 'plan' && prev.record.id === planId
            ? { type: 'plan', record: { ...prev.record, ...updates } }
            : prev
        );
    };

    const patchPatientVisit = (visitId: string, updates: Partial<Visit>) => {
        setPatient(prev => prev ? {
            ...prev,
            visits: prev.visits.map(visit =>
                visit.id === visitId ? { ...visit, ...updates } : visit
            )
        } : prev);
        setOpenRecord(prev => prev?.type === 'visit' && prev.record.id === visitId
            ? { type: 'visit', record: { ...prev.record, ...updates } }
            : prev
        );
    };

    const handleSaveDiagnosisLocal = async () => {
        if (!patientId || !diagnosis?.trim()) return;

        setSavingRecordId('new-diagnosis');
        try {
            const res = await fetch(`/api/patients/${patientId}/treatment-plans`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: new Date().toISOString(),
                    visitDate: new Date().toISOString().split('T')[0],
                    title: getNextLocalRecordTitle(),
                    patientName: patient?.name || '',
                    diagnosis,
                    treatment: '',
                    lifestyle: '',
                    dosha: patient?.dosha || ''
                })
            });
            const data = await res.json();
            if (data.success) {
                await fetchPatientDetails();
                setOpenRecord({ type: 'plan', record: data.plan });
            }
        } catch (error) {
            console.error('Error saving local diagnosis:', error);
        } finally {
            setSavingRecordId(null);
        }
    };

    const handleUpdateTreatmentPlan = async (plan: TreatmentPlan) => {
        if (!patientId || !plan.id) return;

        setSavingRecordId(plan.id);
        try {
            const res = await fetch(`/api/patients/${patientId}/treatment-plans/${plan.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: plan.date,
                    title: plan.title,
                    visitDate: plan.visitDate,
                    diagnosis: plan.diagnosis,
                    treatment: plan.treatment,
                    lifestyle: plan.lifestyle,
                    patientDiagnosis: plan.patientDiagnosis,
                    patientTreatment: plan.patientTreatment,
                    patientLifestyle: plan.patientLifestyle,
                    cerealGuidance: plan.cerealGuidance,
                    cerealRecipe: plan.cerealRecipe,
                    dosha: plan.dosha,
                    herbs: mapHerbsWithPurpose(plan.herbs),
                    categories: plan.categories,
                    recipes: plan.recipes,
                    adherence: plan.adherence
                })
            });
            const data = await res.json();
            if (data.success) {
                setRecordSaveError('');
                patchPatientPlan(plan.id, data.plan);
                setOpenRecord({ type: 'plan', record: data.plan });
            } else {
                throw new Error(data.error || 'No se pudo guardar el tratamiento.');
            }
        } catch (error) {
            console.error('Error updating local treatment plan:', error);
            setRecordSaveError(error instanceof Error ? error.message : 'No se pudo guardar el tratamiento.');
            throw error;
        } finally {
            setSavingRecordId(null);
        }
    };

    const handleUpdateVisitRecord = async (visit: Visit, options: { silent?: boolean } = {}) => {
        if (!patientId || !visit.id) return;

        setSavingRecordId(visit.id);
        try {
            const res = await fetch(`/api/patients/${patientId}/visits/${visit.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientName: patient?.name || '',
                    date: visit.date,
                    title: visit.title,
                    note: visit.note,
                    diagnosis: visit.diagnosis,
                    treatment: visit.treatment,
                    lifestyle: visit.lifestyle,
                    dosha: visit.dosha,
                    symptoms: visit.symptoms,
                    patientDiagnosis: visit.patientDiagnosis,
                    patientTreatment: visit.patientTreatment,
                    patientLifestyle: visit.patientLifestyle,
                    cerealGuidance: visit.cerealGuidance,
                    cerealRecipe: visit.cerealRecipe,
                    herbs: mapHerbsWithPurpose(visit.herbs || []),
                    categories: visit.categories,
                    recipes: visit.recipes,
                    adherence: visit.adherence
                })
            });
            const data = await res.json();
            if (data.success) {
                setRecordSaveError('');
                patchPatientVisit(visit.id, data.visit);
                setOpenRecord({ type: 'visit', record: data.visit });
            } else {
                throw new Error(data.error || 'No se pudo guardar la visita. Intenta de nuevo.');
            }
        } catch (error: any) {
            console.error('Error updating local visit:', error);
            const message = error?.message || 'No se pudo guardar la visita. Revisa tu conexión e intenta de nuevo.';
            if (options.silent) {
                setRecordSaveError(message);
            } else {
                alert(message);
            }
            throw error;
        } finally {
            setSavingRecordId(null);
        }
    };

    // Si el usuario escribió un síntoma nuevo en el campo "Agregar síntoma nuevo..."
    // pero nunca le dio clic a "Agregar" (ni Enter), ese texto nunca entraba a
    // visitSymptoms y "Guardar" lo descartaba en silencio. Esta función lo incluye
    // igual, para que Guardar nunca pierda lo que el usuario acaba de escribir.
    // El autosave (silent) pasa includePending=false: si lo incluyera, una pausa
    // breve mientras se escribe el nombre del síntoma lo guardaría a medias.
    const resolveVisitSymptomsForSave = (includePending = true): Record<string, { frequency: string; intensity: number; note?: string }> => {
        if (!includePending) return visitSymptoms;
        const pendingName = normalizeSymptomName(newVisitSymptomName);
        if (!pendingName) return visitSymptoms;
        return {
            ...visitSymptoms,
            [pendingName]: visitSymptoms[pendingName] || { frequency: 'Diaria', intensity: 1 }
        };
    };

    // Guarda el "Editar Caso" (modo Nueva Visita) en la consulta inicial del paciente:
    // actualiza la ficha (calibración de síntomas) sin perder lo demás, y guarda los
    // campos clínicos en el plan base (PATCH si existe, POST si no). (fix #12)
    const handleSaveCaseFromVisit = async (options: { openPdf?: boolean; silent?: boolean } = {}) => {
        const targetPatientId = patientId || patient?.id;
        if (!targetPatientId || !patient) return null;
        setSavingVisit(true);
        try {
            const token = localStorage.getItem('token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            // 1) Ficha del paciente: actualizar síntomas calibrados conservando datos.
            const includePending = !options.silent;
            const hadPendingSymptom = includePending && !!normalizeSymptomName(newVisitSymptomName);
            const resolvedSymptoms = resolveVisitSymptomsForSave(includePending);
            const calibrations = Object.entries(resolvedSymptoms).map(([symptom, d]) => ({
                symptom, frequency: d.frequency, intensity: d.intensity, note: d.note
            }));
            const plain = Object.keys(resolvedSymptoms);
            const patientRes = await fetch(`/api/patients/${targetPatientId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    name: patient.name,
                    age: patient.age,
                    email: patient.email,
                    phone: patient.phone,
                    dosha: patient.dosha,
                    symptomCalibrations: calibrations,
                    plainSymptoms: plain,
                    intensityScale: visitIntensityScale
                })
            });
            const patientData = await patientRes.json().catch(() => ({}));
            if (!patientRes.ok || !patientData.success) {
                throw new Error(patientData.error || 'No se pudo guardar la ficha del paciente (síntomas).');
            }
            setVisitSymptoms(resolvedSymptoms);
            if (hadPendingSymptom) setNewVisitSymptomName('');

            // 2) Campos clínicos en el plan base (consulta inicial).
            const initial = getInitialPlan();
            const planBody: Record<string, unknown> = {
                diagnosis: visitDiagnosis,
                treatment: visitTreatment,
                lifestyle: visitLifestyle,
                tongue: visitTongue,
                dosha: patient.dosha,
                herbs: mapHerbsWithPurpose(visitTrackedHerbs),
                categories: visitTrackedCategories,
                patientTreatment: visitNote
            };
            const hasClinical = `${visitDiagnosis}${visitTreatment}${visitLifestyle}${visitTongue}`.trim().length > 0
                || visitTrackedHerbs.length > 0 || visitTrackedCategories.length > 0;

            let planRecord: TreatmentPlan | null = initial;
            if (initial?.id) {
                const res = await fetch(`/api/patients/${targetPatientId}/treatment-plans/${initial.id}`, {
                    method: 'PATCH', headers, body: JSON.stringify(planBody)
                });
                const data = await res.json().catch(() => ({}));
                if (data.success) planRecord = data.plan as TreatmentPlan;
            } else if (hasClinical) {
                const res = await fetch(`/api/patients/${targetPatientId}/treatment-plans`, {
                    method: 'POST', headers,
                    body: JSON.stringify({
                        ...planBody,
                        date: new Date().toISOString(),
                        visitDate,
                        title: getNextLocalRecordTitle(visitDate),
                        patientName: patient.name
                    })
                });
                const data = await res.json().catch(() => ({}));
                if (data.success) planRecord = data.plan as TreatmentPlan;
            }

            // El autosave (silent) refresca los datos del paciente (para que la
            // consulta inicial recién creada quede disponible como PATCH la próxima
            // vez) pero NO cierra el modal ni borra lo que el profesional sigue
            // editando, y tampoco abre el PDF.
            await fetchPatientDetails();
            setVisitAutosaveError('');
            if (!options.silent) {
                setIsAddingVisit(false);
                setEditCaseMode(false);
                setVisitNote(''); setVisitDiagnosis(''); setVisitTreatment(''); setVisitLifestyle(''); setVisitTongue('');
                setVisitTonguePhotos([]);
                setVisitSymptoms({}); setVisitAdherence({ categories: [], herbs: [], generalNote: '' });
                setVisitTrackedCategories([]); setVisitTrackedHerbs([]);

                if (options.openPdf && planRecord) {
                    openTreatmentPDFEditor(planRecord.diagnosis || visitDiagnosis || getLatestLocalDiagnosis(), { type: 'plan', record: planRecord });
                }
            }
        } catch (error: any) {
            console.error('Error saving case:', error);
            const message = error?.message || 'No se pudo guardar el caso. Revisa tu conexión e intenta de nuevo.';
            if (options.silent) {
                setVisitAutosaveError(message);
            } else {
                alert(message);
            }
            if (options.silent) throw error;
        } finally {
            setSavingVisit(false);
        }
        return null;
    };

    const handleSaveVisit = async (options: { openPdf?: boolean; silent?: boolean } = {}) => {
        if (editCaseMode) {
            return handleSaveCaseFromVisit(options);
        }
        if (!patient || !visitDate) {
            return null;
        }
        setSavingVisit(true);
        try {
            // La adherencia ya viene correctamente mantenida en visitAdherence (sembrada
            // del tratamiento ANTERIOR y actualizada ítem por ítem vía
            // patchNewVisitAdherence). Antes aquí se volvía a filtrar contra
            // visitTrackedCategories/visitTrackedHerbs —las categorías/fórmulas NUEVAS
            // elegidas para esta visita, casi nunca los mismos nombres— lo que borraba
            // todo lo marcado como "hizo/no hizo" al guardar.
            const nextAdherence = {
                ...visitAdherence,
                updatedAt: new Date().toISOString()
            };
            const isEditing = Boolean(editingVisitId);
            const url = isEditing
                ? `/api/patients/${patientId}/visits/${editingVisitId}`
                : `/api/patients/${patientId}/visits`;
            const resolvedSymptoms = resolveVisitSymptomsForSave(!options.silent);
            const payload: Record<string, unknown> = {
                date: visitDate,
                patientName: patient.name,
                note: visitNote,
                diagnosis: visitDiagnosis,
                treatment: visitTreatment,
                lifestyle: visitLifestyle,
                tongue: visitTongue,
                dosha: patient.dosha,
                symptoms: resolvedSymptoms,
                categories: visitTrackedCategories,
                herbs: mapHerbsWithPurpose(visitTrackedHerbs),
                adherence: nextAdherence
            };
            if (!isEditing) {
                // Keep the auto-generated title only when creating. When editing we
                // omit it so the server preserves the existing title.
                payload.title = getNextLocalRecordTitle(visitDate);
            }
            const res = await fetch(url, {
                method: isEditing ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setVisitAutosaveError('');
                if (options.silent) {
                    // Autosave: si esta visita se acaba de crear (aún no tenía id),
                    // seguimos editando el mismo registro con PATCH en el próximo
                    // autosave en vez de crear una visita nueva cada vez.
                    if (!isEditing && data.visit?.id) {
                        setEditingVisitId(data.visit.id);
                    }
                    // Refresca la lista de visitas del paciente en segundo plano, sin
                    // tocar los campos que el profesional sigue editando.
                    fetchPatientDetails();
                    return data.visit as Visit;
                }
                // Refresh patient data to see the new/updated visit
                await fetchPatientDetails();
                setIsAddingVisit(false);
                setEditingVisitId(null);
                setVisitNote('');
                setVisitDiagnosis('');
                setVisitTreatment('');
                setVisitLifestyle('');
                setVisitTongue('');
                setVisitTonguePhotos([]);
                setVisitSymptoms({});
                setVisitAdherence({ categories: [], herbs: [], generalNote: '' });
                setVisitTrackedCategories([]);
                setVisitTrackedHerbs([]);
                if (options.openPdf) {
                    const visitRecord = data.visit as Visit;
                    openTreatmentPDFEditor(visitRecord.diagnosis || diagnosis || getLatestLocalDiagnosis(), { type: 'visit', record: visitRecord });
                }
                return data.visit as Visit;
            } else {
                const message = data.error || 'No se pudo guardar la visita. Intenta de nuevo.';
                if (options.silent) {
                    setVisitAutosaveError(message);
                    throw new Error(message);
                }
                alert(message);
            }
        } catch (error: any) {
            console.error('Error saving visit:', error);
            const message = error?.message || 'No se pudo guardar la visita. Revisa tu conexión e intenta de nuevo.';
            if (options.silent) {
                setVisitAutosaveError(message);
                throw error;
            }
            alert(message);
        } finally {
            setSavingVisit(false);
        }
        return null;
    };

    // Autosave en segundo plano del formulario "Nueva Visita / Editar Caso". Los
    // botones explícitos (que además generan el PDF y cierran el modal) se
    // mantienen, pero así no se pierde nada si el profesional cierra el modal con
    // "Cancelar"/la X sin haber llegado a darle clic a un botón de guardado.
    const visitFormFingerprint = useMemo(() => JSON.stringify({
        visitDate, visitNote, visitDiagnosis, visitTreatment, visitLifestyle, visitTongue,
        visitSymptoms, visitTrackedCategories, visitTrackedHerbs, visitAdherence
    }), [visitDate, visitNote, visitDiagnosis, visitTreatment, visitLifestyle, visitTongue, visitSymptoms, visitTrackedCategories, visitTrackedHerbs, visitAdherence]);

    const visitAutosaveStatus = useAutosave(
        visitFormFingerprint,
        () => handleSaveVisit({ silent: true }),
        { enabled: isAddingVisit, delay: 1500 }
    );

    const handleDeleteVisit = async (visit: Visit) => {
        if (!patientId || !visit?.id) return;
        const visitName = getRecordTitle(visit, 'visit');
        const confirmed = window.confirm(
            `¿Seguro que quieres borrar esta visita de seguimiento?\n\n"${visitName}"\n\nSe eliminará la visita y su archivo. Esta acción no se puede deshacer.`
        );
        if (!confirmed) return;

        setSavingRecordId(visit.id);
        try {
            const token = localStorage.getItem('token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/patients/${patientId}/visits/${visit.id}`, {
                method: 'DELETE',
                headers
            });
            const data = await res.json().catch(() => ({}));
            // 404 means it's already gone (e.g. stale list / double click) — treat as success.
            if (data.success || res.status === 404) {
                if (openRecord?.type === 'visit' && openRecord.record.id === visit.id) {
                    setOpenRecord(null);
                }
                if (editingVisitId === visit.id) {
                    setIsAddingVisit(false);
                    setEditingVisitId(null);
                }
                await fetchPatientDetails();
            } else {
                window.alert(`No se pudo borrar la visita.${data.error ? `\n\n${data.error}` : ''}`);
            }
        } catch (error) {
            console.error('Error deleting visit:', error);
            window.alert('Ocurrió un error al borrar la visita.');
        } finally {
            setSavingRecordId(null);
        }
    };

    const buildRecordAdherence = (record: TreatmentPlan | Visit): TreatmentAdherence => ({
        ...(record.adherence || {}),
        categories: mergeAdherenceItems(record.adherence?.categories, record.categories || []),
        herbs: mergeAdherenceItems(record.adherence?.herbs, (record.herbs || []).map(herb => herb.formula)),
        healthyHabits: mergeAdherenceItems(record.adherence?.healthyHabits, getStoredHealthyHabitNames(record)),
        updatedAt: record.adherence?.updatedAt
    });

    const patchOpenRecordAdherence = (
        section: 'categories' | 'herbs',
        itemName: string,
        updates: Partial<TreatmentAdherenceItem>
    ) => {
        if (!openRecord) return;
        const adherence = buildRecordAdherence(openRecord.record);
        const items = mergeAdherenceItems(
            adherence[section],
            section === 'categories'
                ? (openRecord.record.categories || [])
                : (openRecord.record.herbs || []).map(herb => herb.formula)
        ).map(item => normalizeTrackingName(item.name) === normalizeTrackingName(itemName)
            ? { ...item, ...updates }
            : item
        );
        const nextAdherence = {
            ...adherence,
            [section]: items,
            updatedAt: new Date().toISOString()
        };

        if (openRecord.type === 'plan') {
            patchPatientPlan(openRecord.record.id || '', { adherence: nextAdherence });
        } else {
            patchPatientVisit(openRecord.record.id || '', { adherence: nextAdherence });
        }
    };

    const patchOpenRecordAdherenceNote = (generalNote: string) => {
        if (!openRecord) return;
        const nextAdherence = {
            ...buildRecordAdherence(openRecord.record),
            generalNote,
            updatedAt: new Date().toISOString()
        };
        if (openRecord.type === 'plan') {
            patchPatientPlan(openRecord.record.id || '', { adherence: nextAdherence });
        } else {
            patchPatientVisit(openRecord.record.id || '', { adherence: nextAdherence });
        }
    };

    // Marca/desmarca "hizo/no hizo" directamente desde el panel de Seguimiento
    // Terapéutico (resumen acumulado de todas las visitas). Escribe en el registro
    // (plan o visita) que dio el último estado de ese ítem, sin forzar la apertura
    // de su panel de detalle: actualiza el estado local (se refleja al toque en
    // Seguimiento y en la visita/plan si ya está abierto) y persiste en el backend.
    const patchTherapeuticSummaryAdherence = (
        section: 'categories' | 'herbs' | 'healthyHabits',
        item: { name: string; lastRecordRef?: { type: 'plan' | 'visit'; id: string } },
        updates: Partial<TreatmentAdherenceItem>
    ) => {
        const ref = item.lastRecordRef;
        if (!ref || !patientId) {
            window.alert(`No se pudo ubicar el registro de origen de "${item.name}" para guardar el cambio.`);
            return;
        }
        const sourceRecord = ref.type === 'plan'
            ? (patient?.treatmentPlans || []).find(p => p.id === ref.id)
            : (patient?.visits || []).find(v => v.id === ref.id);
        if (!sourceRecord) {
            window.alert(`No se pudo ubicar el registro de origen de "${item.name}" para guardar el cambio.`);
            return;
        }

        const adherence = buildRecordAdherence(sourceRecord);
        const names = section === 'categories'
            ? (sourceRecord.categories || [])
            : section === 'herbs'
            ? (sourceRecord.herbs || []).map(herb => herb.formula)
            : getStoredHealthyHabitNames(sourceRecord);
        const items = mergeAdherenceItems(adherence[section], names).map(entry =>
            normalizeTrackingName(entry.name) === normalizeTrackingName(item.name)
                ? { ...entry, ...updates }
                : entry
        );
        const nextAdherence = {
            ...adherence,
            [section]: items,
            updatedAt: new Date().toISOString()
        };

        // Además de guardar en adherence.updatedAt, tocamos el updatedAt del propio
        // registro: el resumen de Seguimiento elige, para cada categoría/fórmula/
        // hábito, el registro con el updatedAt más reciente. Si no lo actualizamos
        // aquí, un registro más viejo con el mismo ítem podría "ganarle" a este
        // cambio recién hecho y el estado marcado no se vería reflejado.
        const recordUpdatedAt = new Date().toISOString();

        if (ref.type === 'plan') {
            patchPatientPlan(ref.id, { adherence: nextAdherence, updatedAt: recordUpdatedAt });
        } else {
            patchPatientVisit(ref.id, { adherence: nextAdherence, updatedAt: recordUpdatedAt });
        }

        const endpoint = ref.type === 'plan'
            ? `/api/patients/${patientId}/treatment-plans/${ref.id}`
            : `/api/patients/${patientId}/visits/${ref.id}`;
        fetch(endpoint, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adherence: nextAdherence })
        }).catch(error => console.error('Error saving adherence from tracking view:', error));
    };

    const patchNewVisitAdherence = (
        section: 'categories' | 'herbs',
        itemName: string,
        updates: Partial<TreatmentAdherenceItem>
    ) => {
        setVisitAdherence(prev => {
            // La checklist de adherencia se siembra desde el tratamiento ANTERIOR
            // (visitAdherence), no desde las categorías/fórmulas elegidas para la
            // visita nueva. Por eso aquí preservamos la lista existente y sólo
            // actualizamos el ítem que el profesional tocó. Antes se reconstruía
            // con los nombres de la visita nueva, lo que descartaba todos los
            // ítems que no coincidían y hacía "desaparecer" los demás (bug #1).
            const existing = prev[section] || [];
            const items = existing.map(item =>
                normalizeTrackingName(item.name) === normalizeTrackingName(itemName)
                    ? { ...item, ...updates }
                    : item
            );

            return {
                ...prev,
                [section]: items,
                updatedAt: new Date().toISOString()
            };
        });
    };

    const normalizeSymptomName = (value: string) => value.trim().replace(/\s+/g, ' ');

    const handleAddVisitSymptom = () => {
        const symptomName = normalizeSymptomName(newVisitSymptomName);
        if (!symptomName) return;

        setVisitSymptoms(prev => ({
            ...prev,
            [symptomName]: prev[symptomName] || { frequency: 'Diaria', intensity: 1 }
        }));
        setNewVisitSymptomName('');
    };

    // Convierte el texto de un .txt en una lista de síntomas (fix #8). Acepta listas
    // con viñetas, numeración o separadas por comas/punto y coma. Descarta líneas vacías,
    // encabezados (terminados en ":") y párrafos largos (probablemente prosa, no síntomas).
    const parseSymptomsFromText = (text: string): string[] => {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        let candidates: string[];
        if (lines.length <= 1 && /[,;]/.test(text)) {
            candidates = text.split(/[,;]/);
        } else {
            candidates = lines.flatMap(line => /[,;]/.test(line) && !/^[-*•·]/.test(line) ? line.split(/[,;]/) : [line]);
        }
        const seen = new Set<string>();
        const result: string[] = [];
        for (const raw of candidates) {
            const cleaned = normalizeSymptomName(raw.replace(/^[-*•·–—\d.)\]\s]+/, ''));
            if (!cleaned) continue;
            if (cleaned.length > 80) continue; // prosa, no un síntoma
            if (/[:：]$/.test(cleaned)) continue; // encabezado tipo "Síntomas:"
            const key = cleaned.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            result.push(cleaned);
        }
        return result;
    };

    // Reconoce palabras de frecuencia/intensidad en español (y variantes cortas) para
    // poder autorellenar la calibración al pegar una tabla de síntomas.
    const mapFrequencyWord = (raw: string): string | undefined => {
        const v = raw.trim().toLowerCase();
        if (!v) return undefined;
        if (/^d(iaria|iario)?$/.test(v) || /diari/.test(v) || /cada d[ií]a/.test(v) || /todos.*d[ií]as/.test(v)) return 'Diaria';
        if (/^s(emanal)?$/.test(v) || /seman/.test(v)) return 'Semanal';
        if (/^m(ensual)?$/.test(v) || /mensual|\bmes\b|ocasional|rara vez|espor[aá]dic/.test(v)) return 'Mensual';
        return undefined;
    };

    const mapIntensityValue = (raw: string): number | undefined => {
        const v = raw.trim().toLowerCase();
        if (!v) return undefined;
        if (/^1$/.test(v) || /leve|ligera|baja|mild|low/.test(v)) return 1;
        if (/^2$/.test(v) || /moderad|media|medium/.test(v)) return 2;
        if (/^3$/.test(v) || /severa|fuerte|alta|intensa|severe|high/.test(v)) return 3;
        const num = parseFloat(v.replace(',', '.'));
        if (!Number.isNaN(num)) {
            if (num <= 3) return Math.max(1, Math.round(num));
            if (num <= 10) return num <= 4 ? 1 : (num <= 7 ? 2 : 3); // escala 1-10 aproximada
        }
        return undefined;
    };

    const isMarkdownSeparatorRow = (cells: string[]) => cells.length > 0 && cells.every(c => /^:?-{2,}:?$/.test(c.trim()));

    // Detecta el delimitador de una tabla pegada (tab de Excel/Word, pipes de Markdown,
    // punto y coma o coma de CSV) y separa cada fila en celdas.
    const splitTableRow = (line: string, delimiter: 'tab' | 'pipe' | 'semicolon' | 'csv'): string[] => {
        if (delimiter === 'tab') return line.split('\t');
        if (delimiter === 'pipe') return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
        if (delimiter === 'semicolon') return line.split(';');
        return line.split(',');
    };

    // Convierte una tabla pegada (en CUALQUIER formato: Excel, Word, Markdown o CSV) en
    // una lista de síntomas con su frecuencia/intensidad detectadas cuando existan.
    // Si no hay columnas reconocibles, cae de vuelta al parser de lista simple.
    const parseSymptomsTable = (text: string): Array<{ name: string; frequency?: string; intensity?: number }> => {
        const rawLines = text.split(/\r?\n/).map(l => l.replace(/\s+$/, '')).filter(l => l.trim().length > 0);
        if (rawLines.length === 0) return [];

        const sample = rawLines.slice(0, 5);
        const countOf = (ch: string) => sample.reduce((acc, l) => acc + (l.split(ch).length - 1), 0);
        const tabCount = countOf('\t');
        const pipeCount = countOf('|');
        const semicolonCount = countOf(';');
        const commaCount = countOf(',');

        let delimiter: 'tab' | 'pipe' | 'semicolon' | 'csv' | 'none' = 'none';
        if (tabCount >= sample.length) delimiter = 'tab';
        else if (pipeCount >= sample.length * 2) delimiter = 'pipe';
        else if (semicolonCount >= sample.length) delimiter = 'semicolon';
        else if (commaCount >= sample.length) delimiter = 'csv';

        if (delimiter === 'none') {
            return parseSymptomsFromText(text).map(name => ({ name }));
        }

        const rows: string[][] = [];
        for (const line of rawLines) {
            const cells = splitTableRow(line, delimiter).map(c => c.trim());
            if (isMarkdownSeparatorRow(cells)) continue; // fila separadora de tabla Markdown (---|---)
            if (cells.every(c => !c)) continue;
            rows.push(cells);
        }
        if (rows.length === 0) return [];

        // Descarta una posible fila de encabezado ("Síntoma", "Frecuencia", "Intensidad"...).
        const headerWordRe = /^(s[ií]ntomas?|nombre|name|symptom)$/i;
        const startIdx = headerWordRe.test(rows[0][0] || '') ? 1 : 0;

        const seen = new Set<string>();
        const result: Array<{ name: string; frequency?: string; intensity?: number }> = [];
        for (let i = startIdx; i < rows.length; i++) {
            const cells = rows[i];
            const nameCell = (cells[0] || '').replace(/^[-*•·–—\d.)\]\s]+/, '');
            const name = normalizeSymptomName(nameCell);
            if (!name || name.length > 80) continue;
            const key = name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);

            let frequency: string | undefined;
            let intensity: number | undefined;
            for (const cell of cells.slice(1)) {
                if (!frequency) {
                    const f = mapFrequencyWord(cell);
                    if (f) { frequency = f; continue; }
                }
                if (!intensity) {
                    const n = mapIntensityValue(cell);
                    if (n) intensity = n;
                }
            }
            result.push({ name, frequency, intensity });
        }
        return result;
    };

    // Aplica una tabla de síntomas pegada (Ctrl+V) directamente en el textarea: detecta
    // columnas de nombre/frecuencia/intensidad en cualquier formato y autorellena la
    // calibración, fusionando con los síntomas ya presentes en la visita sin duplicar.
    const handleApplySymptomsPaste = (textOverride?: string) => {
        const text = textOverride !== undefined ? textOverride : pasteSymptomTableText;
        const parsedRows = parseSymptomsTable(text);
        if (parsedRows.length === 0) {
            setSymptomImportMsg('No se detectaron síntomas en el texto pegado.');
            return;
        }

        let added = 0;
        let updated = 0;
        setVisitSymptoms(prev => {
            const next = { ...prev };
            for (const row of parsedRows) {
                const existing = next[row.name];
                if (!existing) {
                    next[row.name] = {
                        frequency: row.frequency || 'Semanal',
                        intensity: row.intensity || 2
                    };
                    added += 1;
                } else if (row.frequency || row.intensity) {
                    next[row.name] = {
                        ...existing,
                        frequency: row.frequency || existing.frequency,
                        intensity: row.intensity || existing.intensity
                    };
                    updated += 1;
                }
            }
            return next;
        });

        setSymptomImportMsg(`${added} síntoma(s) agregado(s)${updated > 0 ? `, ${updated} actualizado(s)` : ''} desde la tabla pegada.`);
        setPasteSymptomTableText('');
        setShowSymptomPasteBox(false);
    };

    // Importa síntomas desde un .txt: los fusiona en la consulta en curso sin duplicar
    // (fix #8) y guarda el archivo en la carpeta del paciente como documento (fix #9).
    const handleImportVisitSymptoms = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setSymptomImportMsg('');
        const ext = (file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]) || '';
        if (!['txt', 'md', 'markdown', 'csv', 'tsv', 'text'].includes(ext)) {
            setSymptomImportMsg('Solo se permiten archivos de texto: .txt, .md, .csv o .tsv.');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setSymptomImportMsg(`"${file.name}" supera el límite de 2 MB.`);
            return;
        }

        setImportingSymptoms(true);
        try {
            const content = await readFileAsText(file);
            const parsed = parseSymptomsFromText(content);

            let added = 0;
            if (parsed.length > 0) {
                setVisitSymptoms(prev => {
                    const next = { ...prev };
                    for (const name of parsed) {
                        if (!next[name]) {
                            next[name] = { frequency: 'Semanal', intensity: 2 };
                            added += 1;
                        }
                    }
                    return next;
                });
            }

            // Guardar el archivo en la carpeta del paciente (fix #9), best-effort.
            let saved = false;
            if (patientId) {
                try {
                    const res = await fetch(`/api/patients/${patientId}/context-docs`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: file.name, content })
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                        saved = true;
                        setPatient(prev => prev ? {
                            ...prev,
                            contextDocuments: [data.document, ...(prev.contextDocuments || [])]
                        } : prev);
                    }
                } catch { /* no bloquear la importación si falla el guardado */ }
            }

            if (parsed.length === 0) {
                setSymptomImportMsg('No se detectaron síntomas en el archivo.');
            } else {
                setSymptomImportMsg(`${added} síntoma(s) importado(s)${added !== parsed.length ? `, ${parsed.length - added} ya existían` : ''}${saved ? ' · archivo guardado en el paciente' : ''}.`);
            }
        } catch (error) {
            setSymptomImportMsg(error instanceof Error ? error.message : 'No se pudo leer el archivo.');
        } finally {
            setImportingSymptoms(false);
        }
    };

    const toggleVisitCategory = (cat: string) => {
        setVisitTrackedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    // Al escribir/elegir el nombre de una fórmula, si coincide exactamente con una
    // fórmula de la base de datos (herb.json) y todavía no se escribió una dosis,
    // se autocompleta la dosis con la de la base de datos. Si se borra el nombre
    // por completo, la dosis se borra también (para no dejar una dosis "huérfana").
    const handleVisitHerbNameChange = (val: string) => {
        setNewVisitHerbName(val);
        if (!val.trim()) {
            setNewVisitHerbDosage('');
            return;
        }
        const dbUsage = lookupHerbUsage(val);
        if (dbUsage && !newVisitHerbDosage.trim()) {
            setNewVisitHerbDosage(dbUsage);
        }
    };

        const handleAddVisitHerb = () => {
        const formula = newVisitHerbName.trim();
        if (!formula) return;
        const dosage = (newVisitHerbDosage.trim()) || lookupHerbUsage(formula) || '';
        const purpose = lookupHerbPurpose(formula) || '';
        setVisitTrackedHerbs(prev => {
            if (prev.some(h => (h.formula || '').trim().toLowerCase() === formula.toLowerCase())) {
                return prev.map(h =>
                    (h.formula || '').trim().toLowerCase() === formula.toLowerCase()
                        ? { ...h, dosage: dosage || h.dosage, purpose: purpose || h.purpose }
                        : h
                );
            }
            return [...prev, { formula, dosage, purpose }];
        });
        recordFormulaUsage(formula);
        setFormulaUsageVersion(v => v + 1);
        setNewVisitHerbName('');
        setNewVisitHerbDosage('');
    };

    // Agrega una fórmula directamente desde el listado de "Más usadas" (sin pasar
    // por los campos de texto), autocompletando la dosis desde la base de datos.
    const handleQuickAddFormula = (name: string) => {
        const formula = name.trim();
        if (!formula) return;
        const dosage = lookupHerbUsage(formula) || '';
        const purpose = lookupHerbPurpose(formula) || '';
        setVisitTrackedHerbs(prev => {
            if (prev.some(h => (h.formula || '').trim().toLowerCase() === formula.toLowerCase())) {
                return prev;
            }
            return [...prev, { formula, dosage, purpose }];
        });
        recordFormulaUsage(formula);
        setFormulaUsageVersion(v => v + 1);
    };

    const removeVisitHerb = (formula: string) => {
        setVisitTrackedHerbs(prev => prev.filter(h => h.formula !== formula));
    };

    const handleAddRecordSymptom = () => {
        if (!openRecord || openRecord.type !== 'visit') return;

        const symptomName = normalizeSymptomName(newRecordSymptomName);
        if (!symptomName) return;

        const currentSymptoms = openRecord.record.symptoms || {};
        patchPatientVisit(openRecord.record.id || '', {
            symptoms: {
                ...currentSymptoms,
                [symptomName]: currentSymptoms[symptomName] || { frequency: 'Diaria', intensity: 1 }
            }
        });
        setNewRecordSymptomName('');
    };

    // Igual que resolveVisitSymptomsForSave: si el usuario escribió un síntoma en el
    // registro abierto (openRecord) y le dio directo a "Guardar" sin clic en
    // "Agregar", lo incluimos igual para no perder lo que acaba de escribir.
    const handleSaveOpenRecord = async (options: { silent?: boolean; includePendingSymptom?: boolean } = {}) => {
        if (!openRecord) return;
        if (openRecord.type === 'plan') {
            await handleUpdateTreatmentPlan(openRecord.record);
            return;
        }
        // El autosave (silent) NO incluye el texto de síntoma todavía a medio escribir:
        // si lo hiciera, una pausa breve mientras el usuario está escribiendo un nombre
        // de síntoma lo guardaría incompleto. Ese "no perder lo que escribiste" queda
        // reservado para el guardado explícito (Enter/clic en "Agregar").
        const pendingName = options.includePendingSymptom === false ? '' : normalizeSymptomName(newRecordSymptomName);
        if (pendingName) {
            const currentSymptoms = openRecord.record.symptoms || {};
            const mergedSymptoms = {
                ...currentSymptoms,
                [pendingName]: currentSymptoms[pendingName] || { frequency: 'Diaria', intensity: 1 }
            };
            setNewRecordSymptomName('');
            await handleUpdateVisitRecord({ ...openRecord.record, symptoms: mergedSymptoms }, options);
            return;
        }
        await handleUpdateVisitRecord(openRecord.record, options);
    };

    // Autosave del registro abierto (consulta inicial o visita ya guardada). Solo
    // observa los campos editables (nunca pdfFile/mdFile, que pueden pesar varios MB
    // en base64) para no recalcular ni guardar de más en cada tecla.
    const openRecordFingerprint = useMemo(() => {
        if (!openRecord) return '';
        const r = openRecord.record;
        const date = openRecord.type === 'plan' ? openRecord.record.visitDate : openRecord.record.date;
        const note = openRecord.type === 'visit' ? openRecord.record.note : undefined;
        const symptoms = openRecord.type === 'visit' ? openRecord.record.symptoms : undefined;
        return JSON.stringify({
            title: r.title,
            date,
            note,
            diagnosis: r.diagnosis,
            treatment: r.treatment,
            lifestyle: r.lifestyle,
            tongue: r.tongue,
            dosha: r.dosha,
            symptoms,
            herbs: r.herbs,
            categories: r.categories,
            recipes: r.recipes,
            patientDiagnosis: r.patientDiagnosis,
            patientTreatment: r.patientTreatment,
            patientLifestyle: r.patientLifestyle,
            cerealGuidance: r.cerealGuidance,
            cerealRecipe: r.cerealRecipe,
            adherence: r.adherence
        });
    }, [openRecord]);

    const openRecordAutosaveStatus = useAutosave(
        openRecordFingerprint,
        () => handleSaveOpenRecord({ silent: true, includePendingSymptom: false }),
        { enabled: !!openRecord, delay: 1200 }
    );

    const patientFirstName = patient?.name ? patient.name.trim().split(/\s+/)[0] : '';
    const patientWhatsAppUrl = patient?.phone
        ? buildWhatsAppUrl(patient.phone, patientFirstName ? `Hola ${patientFirstName} soy Krishna cómo estás, te paso tu tratamiento` : `Hola, soy Krishna cómo estás, te paso tu tratamiento`)
        : '';


    const getLatestLocalDiagnosis = () => {
        if (!patient) return '';
        const localRecords = [
            ...(patient.treatmentPlans || []),
            ...patient.visits
        ].filter(record => record.diagnosis?.trim());

        localRecords.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt || a.date || '').getTime();
            const dateB = new Date(b.updatedAt || b.createdAt || b.date || '').getTime();
            return dateB - dateA;
        });

        if (localRecords[0]?.diagnosis) return localRecords[0].diagnosis;

        // Sin diagnóstico en planes/visitas: usamos el más reciente del historial IA,
        // para que el diagnóstico generado con IA llegue al PDF sin pasos manuales.
        const aiRecords = [...(patient.aiDiagnoses || [])].sort((a, b) =>
            new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
        );
        return aiRecords[0]?.diagnosis || '';
    };

    const getNextLocalRecordTitle = (date = new Date().toISOString()) => {
        const totalRecords = (patient?.treatmentPlans?.length || 0) + (patient?.visits?.length || 0);
        const patientName = patient?.name || 'Paciente';
        if (totalRecords === 0) {
            return `Consulta inicial - ${patientName}`;
        }
        return `Consulta seguimiento - ${patientName} - ${new Date(date).toLocaleDateString('es-MX')}`;
    };

    const getRecordTitle = (record: TreatmentPlan | Visit, type: 'plan' | 'visit') => {
        if (record.title?.trim()) return record.title;
        if (type === 'visit') {
            return `Consulta seguimiento - ${patient?.name || 'Paciente'} - ${new Date(record.date).toLocaleDateString('es-MX')}`;
        }
        return `Consulta inicial - ${patient?.name || 'Paciente'}`;
    };

    const openTreatmentPDFEditor = (diag: string, recordToEdit: { type: 'plan' | 'visit'; record: any } | null = null) => {
        setActiveTreatmentPatientId(patientId || patient?.id || null);
        setDiagnosis(diag || null);
        setEditingRecord(recordToEdit);
        setIsTreatmentModalOpen(true);
    };

    // Reabre el PDF guardado de una visita de seguimiento. El contenido del PDF
    // puede vivir en el propio registro de la visita (treatment/herbs/etc.) o,
    // según el flujo con que se generó, en un "plan de tratamiento" asociado a
    // la misma visita por cercanía de fecha. Aquí elegimos el registro que sí
    // tiene el contenido guardado para que NO se abra una plantilla en blanco.
    const reopenVisitTreatmentPdf = (
        visit: Visit,
        relatedPlans: TreatmentPlan[] = []
    ) => {
        const visitHasOwnPdf = Boolean(
            visit.pdfFile ||
            (visit.treatment && visit.treatment.trim()) ||
            (visit.herbs && visit.herbs.length > 0)
        );
        if (visitHasOwnPdf) {
            openTreatmentPDFEditor(visit.diagnosis || '', { type: 'visit', record: visit });
            return;
        }
        // Buscar el plan asociado más reciente que tenga contenido real de PDF.
        const planWithContent = [...relatedPlans]
            .filter(p => p.pdfFile || (p.treatment && p.treatment.trim()) || (p.herbs && p.herbs.length > 0))
            .sort((a, b) =>
                new Date(b.updatedAt || b.visitDate || b.date || 0).getTime() -
                new Date(a.updatedAt || a.visitDate || a.date || 0).getTime()
            )[0];
        if (planWithContent) {
            openTreatmentPDFEditor(planWithContent.diagnosis || visit.diagnosis || '', { type: 'plan', record: planWithContent });
            return;
        }
        // Sin PDF previo: abrir la visita para crear uno nuevo.
        openTreatmentPDFEditor(visit.diagnosis || '', { type: 'visit', record: visit });
    };

    const handleOpenTreatmentFromLocalDiagnosis = () => {
        // Prioriza el diagnóstico IA visible en el editor (recién generado o editado);
        // solo si no hay uno válido caemos al último diagnóstico guardado.
        const aiDiagnosis = diagnosis && diagnosis.trim() && !diagnosis.startsWith('Error') ? diagnosis : '';
        openTreatmentPDFEditor(aiDiagnosis || getLatestLocalDiagnosis(), null);
    };

    const handleOpenPdfFromRecord = () => {
        if (!openRecord?.record.diagnosis?.trim()) return;
        const diag = openRecord.record.diagnosis;
        const rec = openRecord;
        setOpenRecord(null);
        openTreatmentPDFEditor(diag, rec);
    };

    const downloadSavedPdf = async (recordId: string, titleText: string) => {
        const targetPatientId = patientId || patient?.id;
        if (!targetPatientId) return;
        try {
            const token = localStorage.getItem('token');
            const headers: Record<string, string> = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const res = await fetch(`/api/patients/${targetPatientId}/pdf/${recordId}`, {
                headers
            });
            if (!res.ok) throw new Error('No se pudo encontrar o descargar el archivo PDF guardado.');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeTitle = (titleText || 'Tratamiento').replace(/\s+/g, '_');
            a.download = `Tratamiento_${patient?.name?.replace(/\s+/g, '_') || 'Paciente'}_${safeTitle}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            alert(err.message || 'Error al descargar el PDF.');
        }
    };

    const handleOpenPatientFolder = async () => {
        const targetPatientId = patientId || patient?.id;
        if (!targetPatientId) return;
        try {
            const token = localStorage.getItem('token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const res = await fetch(`/api/patients/${targetPatientId}/open-folder`, {
                method: 'POST',
                headers
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'No se pudo abrir la carpeta.');
            }
        } catch (err: any) {
            alert(err.message || 'Error al abrir la carpeta del paciente.');
        }
    };

    // Consulta inicial = el tratamiento base más antiguo del paciente (si existe).
    const getInitialPlan = (): TreatmentPlan | null => {
        const plans = [...(patient?.treatmentPlans || [])].sort(
            (a, b) => new Date(a.date || a.createdAt || '').getTime() - new Date(b.date || b.createdAt || '').getTime()
        );
        return plans[0] || null;
    };

    /*
    const openEditProfileModal = () => {
        if (!patient) return;
        setEditName(patient.name || '');
        setEditAge(patient.age || '');
        setEditEmail(patient.email || '');
        setEditPhone(patient.phone || '');
        setEditDosha(patient.dosha || '');
        setEditIntensityScale(patient.intensityScale || 3);
        setEditSymptomCalibrations([...(patient.symptomCalibrations || [])]);
        setEditPlainSymptoms([...(patient.plainSymptoms || [])]);
        setNewEditSymptomName('');
        setCaseError('');
        setIsEditingCase(true);
    };
    */

    // "Editar Caso" abre la MISMA interfaz de Nueva Visita (fix #12), precargada con
    // lo que el paciente ya llenó (síntomas calibrados) y con la consulta inicial.
    const openEditCaseModal = () => {
        if (!patient) return;
        setEditCaseMode(true);
        setEditingVisitId(null);
        setIsAddingVisit(true);
        setVisitDate(new Date().toISOString().split('T')[0]);
        setVisitIntensityScale(patient.intensityScale || 3);

        // Síntomas: lo que el paciente ya llenó (calibración + síntomas simples).
        const sympt: Record<string, { frequency: string; intensity: number; note?: string }> = {};
        (patient.symptomCalibrations || []).forEach(s => {
            sympt[s.symptom] = { frequency: s.frequency, intensity: s.intensity, note: s.note };
        });
        (patient.plainSymptoms || []).forEach(s => {
            if (s && !sympt[s]) sympt[s] = { frequency: 'Semanal', intensity: 2 };
        });
        setVisitSymptoms(sympt);

        // Campos clínicos: desde la consulta inicial si existe; el diagnóstico cae al
        // de IA / último local para no perder lo generado.
        const initial = getInitialPlan();
        const aiDiagnosis = diagnosis && diagnosis.trim() && !diagnosis.startsWith('Error') ? diagnosis : '';
        setVisitNote(initial?.patientTreatment || '');
        setVisitDiagnosis(initial?.diagnosis || aiDiagnosis || getLatestLocalDiagnosis() || '');
        setVisitTreatment(initial?.treatment || '');
        setVisitLifestyle(initial?.lifestyle || '');
        setVisitTongue(initial?.tongue || '');
        setVisitTonguePhotos([...(patient.tonguePhotos || [])]);
        setVisitTrackedCategories([...(initial?.categories || [])]);
        setVisitTrackedHerbs(mapHerbsWithPurpose(initial?.herbs || []));
        setVisitAdherence({ categories: [], herbs: [], generalNote: '' });
        setNewVisitHerbName('');
        setNewVisitHerbDosage('');
        setNewVisitSymptomName('');
    };

    const handleToggleIntensityScale = async (newScale: 3 | 10) => {
        const oldScale = visitIntensityScale;
        if (oldScale === newScale) return;
        setVisitIntensityScale(newScale);

        // Convert intensity for all symptoms currently in visitSymptoms
        setVisitSymptoms(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(key => {
                next[key] = {
                    ...next[key],
                    intensity: convertIntensityScaleValue(next[key].intensity, oldScale, newScale)
                };
            });
            return next;
        });

        // Persist intensity scale preference to patient details immediately
        const targetPatientId = patientId || patient?.id;
        if (!targetPatientId || !patient) return;
        try {
            const token = localStorage.getItem('token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/patients/${targetPatientId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    name: patient.name,
                    age: patient.age,
                    email: patient.email,
                    phone: patient.phone,
                    dosha: patient.dosha,
                    intensityScale: newScale
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    // Update patient data locally in background
                    fetchPatientDetails();
                }
            }
        } catch (error) {
            console.error('Error persisting intensity scale:', error);
        }
    };

    const handleToggleEditIntensityScale = (newScale: 3 | 10) => {
        const oldScale = editIntensityScale;
        if (oldScale === newScale) return;
        setEditIntensityScale(newScale);

        // Convert intensity for all symptom calibrations in editSymptomCalibrations
        setEditSymptomCalibrations(prev =>
            prev.map(item => {
                const newIntensity = convertIntensityScaleValue(item.intensity, oldScale, newScale);
                return {
                    ...item,
                    intensity: newIntensity,
                    intensityLabel: getIntensityLabelText(newIntensity, newScale)
                };
            })
        );
    };

    const handleSaveCase = async () => {
        const targetPatientId = patientId || patient?.id;
        if (!targetPatientId) return;

        setSavingCase(true);
        setCaseError('');
        try {
            const token = localStorage.getItem('token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(`/api/patients/${targetPatientId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    name: editName,
                    age: editAge,
                    email: editEmail,
                    phone: editPhone,
                    dosha: editDosha,
                    symptomCalibrations: editSymptomCalibrations,
                    plainSymptoms: editPlainSymptoms,
                    intensityScale: editIntensityScale
                })
            });

            const data = await res.json();
            if (data.success) {
                await fetchPatientDetails();
                setIsEditingCase(false);
            } else {
                setCaseError(data.error || 'No se pudo guardar la información del caso.');
            }
        } catch (err: any) {
            setCaseError(err.message || 'Error al conectar con el servidor.');
        } finally {
            setSavingCase(false);
        }
    };

    const handleSendMessage = async () => {
        if (!chatMessage.trim() || !patient) return;

        const userMsg = chatMessage;
        setChatMessage('');
        setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsThinking(true);

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg,
                    context: patient.fullNotes,
                    patient: patient,
                    provider: aiProvider,
                    model: aiProvider === 'deepseek' ? aiModel : undefined,
                    history: chatHistory,
                    chatType: 'diagnosis',
                    currentDiagnosis: diagnosis
                })
            });
            const data = await res.json();
            if (data.success) {
                setChatHistory(prev => [...prev, { role: 'ai', text: data.reply }]);
                if (data.updatedDiagnosis) {
                    setDiagnosis(data.updatedDiagnosis);
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
        } finally {
            setIsThinking(false);
        }
    };

    const parseNotes = (notes: string) => {
        if (!notes) return [];
        const sections = notes.split(/\n(?=\*\*)/);
        return sections.map(section => {
            const titleMatch = section.match(/^\*\*(.*?)\*\*/);
            const title = titleMatch ? titleMatch[1] : 'Información';
            const content = section.replace(/^\*\*.*?\*\*\n?/, '').trim();
            return { title, content };
        });
    };

    const getFrequencyBadge = (frequency: string) => {
        if (/^superad|^ningun/i.test(frequency || '')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        const styles: Record<string, string> = {
            'Diaria': 'bg-blue-50 text-blue-600 border-blue-100',
            'Semanal': 'bg-emerald-50 text-emerald-600 border-emerald-100',
            'Mensual': 'bg-slate-50 text-slate-500 border-slate-100',
        };
        return styles[frequency] || styles['Diaria'];
    };

    const getFrequencyShort = (frequency: string) =>
        /^superad|^ningun/i.test(frequency || '') ? '✓' : (frequency || '').charAt(0);

    const isSuperado = (frequency: string) => /^superad|^ningun/i.test(frequency || '');

    const getIntensityBadge = (intensity: number) => {
        const styles: Record<number, string> = {
            1: 'bg-emerald-50 text-emerald-600 border-emerald-100',
            2: 'bg-amber-50 text-amber-600 border-amber-100',
            3: 'bg-red-50 text-red-600 border-red-100',
        };
        return styles[intensity] || styles[1];
    };

    const getPulseStatusLabel = (status: string) => (
        PULSE_STATUS_OPTIONS.find(option => option.value === status)?.label || 'Sin marcar'
    );

    const getPulseStatusClass = (status: string) => {
        const styles: Record<string, string> = {
            strong: 'bg-emerald-50 text-emerald-700 border-emerald-100',
            weak: 'bg-red-50 text-red-600 border-red-100',
            normal: 'bg-sky-50 text-sky-600 border-sky-100',
            absent: 'bg-slate-100 text-slate-500 border-slate-200'
        };
        return styles[status] || 'bg-slate-50 text-slate-400 border-slate-100';
    };

    const formatNoteDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    // Clinical data field icon/color mapping
    const getClinicalFieldColor = (key: string) => {
        const k = key.toLowerCase();
        if (k.includes('tel') || k.includes('celular') || k.includes('phone') || k.includes('contacto')) return { bg: 'rgba(14,165,233,0.12)', icon: 'sky' };
        if (k.includes('direcci') || k.includes('ciudad') || k.includes('pa\u00eds')) return { bg: 'rgba(168,85,247,0.1)', icon: 'purple' };
        if (k.includes('profesi') || k.includes('ocup')) return { bg: 'rgba(249,115,22,0.1)', icon: 'orange' };
        if (k.includes('prop\u00f3sito') || k.includes('motivo') || k.includes('consulta')) return { bg: 'rgba(239,68,68,0.1)', icon: 'red' };
        if (k.includes('s\u00edntoma')) return { bg: 'rgba(239,68,68,0.1)', icon: 'red' };
        if (k.includes('dieta') || k.includes('desayuno') || k.includes('cena') || k.includes('comida') || k.includes('h\u00e1bito') || k.includes('horario')) return { bg: 'rgba(234,179,8,0.1)', icon: 'yellow' };
        if (k.includes('ejercicio') || k.includes('energ\u00eda')) return { bg: 'rgba(34,197,94,0.1)', icon: 'green' };
        if (k.includes('suplemento') || k.includes('hierba') || k.includes('sustanc')) return { bg: 'rgba(20,184,166,0.1)', icon: 'teal' };
        if (k.includes('sue\u00f1o') || k.includes('temperatura') || k.includes('sudor')) return { bg: 'rgba(99,102,241,0.1)', icon: 'indigo' };
        if (k.includes('menstruaci') || k.includes('embarazo')) return { bg: 'rgba(236,72,153,0.1)', icon: 'pink' };
        if (k.includes('enfermedad') || k.includes('hospitaliz') || k.includes('cirug')) return { bg: 'rgba(239,68,68,0.08)', icon: 'red' };
        if (k.includes('consentimiento') || k.includes('protecci') || k.includes('grabaci')) return { bg: 'rgba(100,116,139,0.1)', icon: 'slate' };
        if (k.includes('observaci') || k.includes('anotaci')) return { bg: 'rgba(245,158,11,0.1)', icon: 'amber' };
        if (k.includes('peso') || k.includes('altura') || k.includes('talla') || k.includes('tendencia')) return { bg: 'rgba(14,165,233,0.1)', icon: 'sky' };
        if (k.includes('apetito') || k.includes('alergia')) return { bg: 'rgba(234,179,8,0.1)', icon: 'yellow' };
        if (k.includes('estado civil') || k.includes('hijos') || k.includes('edad')) return { bg: 'rgba(168,85,247,0.08)', icon: 'purple' };
        return { bg: 'rgba(148,163,184,0.1)', icon: 'slate' };
    };

    const getClinicalFieldIcon = (key: string, color: string) => {
        const k = key.toLowerCase();
        const cls = `w-3.5 h-3.5 text-${color}-600`;
        if (k.includes('tel') || k.includes('celular') || k.includes('phone') || k.includes('contacto')) return <Phone className={cls} />;
        if (k.includes('direcci') || k.includes('ciudad') || k.includes('pa\u00eds')) return <MapPin className={cls} />;
        if (k.includes('profesi') || k.includes('ocup')) return <Briefcase className={cls} />;
        if (k.includes('prop\u00f3sito') || k.includes('motivo') || k.includes('consulta')) return <AlertCircle className={cls} />;
        if (k.includes('s\u00edntoma')) return <Activity className={cls} />;
        if (k.includes('dieta') || k.includes('desayuno') || k.includes('cena') || k.includes('comida') || k.includes('apetito') || k.includes('alergia') || k.includes('h\u00e1bito') || k.includes('horario')) return <UtensilsCrossed className={cls} />;
        if (k.includes('ejercicio') || k.includes('energ\u00eda')) return <Dumbbell className={cls} />;
        if (k.includes('suplemento') || k.includes('sustanc')) return <Pill className={cls} />;
        if (k.includes('sue\u00f1o')) return <Moon className={cls} />;
        if (k.includes('temperatura')) return <Thermometer className={cls} />;
        if (k.includes('sudor')) return <Droplets className={cls} />;
        if (k.includes('peso') || k.includes('altura') || k.includes('tendencia')) return <Scale className={cls} />;
        if (k.includes('menstruaci') || k.includes('embarazo')) return <Heart className={cls} />;
        if (k.includes('enfermedad') || k.includes('hospitaliz') || k.includes('cirug')) return <Heart className={cls} />;
        if (k.includes('consentimiento') || k.includes('protecci')) return <ShieldCheck className={cls} />;
        if (k.includes('grabaci')) return <Mic className={cls} />;
        if (k.includes('observaci') || k.includes('anotaci')) return <Info className={cls} />;
        if (k.includes('dosha') || k.includes('ayurv') || k.includes('hierba')) return <Leaf className={cls} />;
        if (k.includes('estado civil') || k.includes('hijos') || k.includes('edad')) return <User className={cls} />;
        return <FileText className={cls} />;
    };

    // Icono representativo de cada categoría de la ficha del paciente (vista toggle en Editar Caso).
    const getIntakeCategoryIcon = (categoryKey: string) => {
        const icons: Record<string, ReturnType<typeof getClinicalFieldIcon>> = {
            sintomas: <Activity size={14} />,
            enfermedades: <Heart size={14} />,
            estiloVida: <Dumbbell size={14} />,
            alimentacion: <UtensilsCrossed size={14} />,
            perfilAyurvedico: <Leaf size={14} />,
            personal: <User size={14} />,
            admin: <ShieldCheck size={14} />,
        };
        return icons[categoryKey] || <Info size={14} />;
    };

    const toggleIntakeCategory = (categoryKey: string) => {
        setOpenIntakeCategories(prev => ({ ...prev, [categoryKey]: !prev[categoryKey] }));
    };

    // Campos de clinicalData que llenó el paciente y que no caen en ninguna categoría conocida.
    const getUncategorizedIntakeFields = (): Array<[string, string]> => {
        if (!patient?.clinicalData) return [];
        const known = new Set(INTAKE_CATEGORIES.flatMap(c => c.fields));
        return Object.entries(patient.clinicalData).filter(([key, value]) => !known.has(key) && value && value.trim());
    };

    const hasAnyIntakeData = !!(
        (patient?.clinicalData && Object.keys(patient.clinicalData).length > 0) ||
        (patient?.symptomCalibrations && patient.symptomCalibrations.length > 0) ||
        (patient?.plainSymptoms && patient.plainSymptoms.length > 0) ||
        (patient?.fullNotes && patient.fullNotes.trim())
    );

    return (
        <AnimatePresence>
            {patientId && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className={`fixed bg-[#F4F6F9] shadow-2xl z-[70] overflow-hidden flex flex-col transition-all duration-300 ${
                            isPanelFullScreen
                                ? 'inset-3 md:inset-6 rounded-2xl'
                                : 'right-0 top-0 bottom-0 w-full max-w-2xl'
                        }`}
                    >
                        {/* Header */}
                        <div className="px-6 py-6 border-b border-white/10 shrink-0 relative overflow-hidden"
                            style={{
                                background: 'linear-gradient(135deg, #0d1a13 0%, #132e1d 50%, #1a3a25 100%)',
                            }}
                        >
                            <div className="absolute top-0 right-0 w-40 h-40 opacity-10"
                                style={{ background: 'radial-gradient(circle, #D4A853 0%, transparent 70%)' }}
                            />
                            <div className="relative z-10 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold overflow-hidden border border-white/10"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(212,168,83,0.15))'
                                        }}
                                    >
                                        {patient?.name ? (
                                            <span className="text-white">{patient.name.charAt(0).toUpperCase()}</span>
                                        ) : (
                                            <User size={24} className="text-white/60" />
                                        )}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">{patient?.name || 'Cargando...'}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="gradient" className="bg-white/10 text-emerald-300 border-white/10 font-bold uppercase tracking-wider text-[10px]">
                                                Paciente App
                                            </Badge>
                                            <span className="text-white/40 text-xs flex items-center gap-1">
                                                <Calendar size={12} />
                                                Ficha enviada
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <motion.button
                                        whileHover={{ scale: 1.06 }}
                                        whileTap={{ scale: 0.94 }}
                                        onClick={openEditCaseModal}
                                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors text-white text-xs font-bold flex items-center gap-1.5 border border-white/10"
                                        title="Editar información del caso y calibrar síntomas"
                                    >
                                        <Sparkles size={16} className="text-amber-300" />
                                        <span>Editar Caso</span>
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.06 }}
                                        whileTap={{ scale: 0.94 }}
                                        onClick={() => setShowTrackingView(true)}
                                        className="p-2 bg-teal-800 hover:bg-teal-700 rounded-xl transition-colors text-white text-xs font-bold flex items-center gap-1.5 border border-white/10"
                                        title="Ver el seguimiento terapéutico acumulado de todas las visitas"
                                    >
                                        <ClipboardCheck size={16} className="text-teal-300" />
                                        <span>Seguimiento</span>
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.06 }}
                                        whileTap={{ scale: 0.94 }}
                                        onClick={handleOpenPatientFolder}
                                        className="p-2 bg-emerald-700 hover:bg-emerald-600 rounded-xl transition-colors text-white text-xs font-bold flex items-center gap-1.5 border border-white/10"
                                        title="Abrir carpeta local del paciente en Finder"
                                    >
                                        <FolderOpen size={16} />
                                        <span>Abrir Carpeta</span>
                                    </motion.button>
                                     <motion.button
                                         whileHover={{ scale: 1.06 }}
                                         whileTap={{ scale: 0.94 }}
                                         onClick={() => setIsPanelFullScreen(prev => !prev)}
                                         className="p-2.5 hover:bg-white/10 rounded-xl transition-colors text-white/50 hover:text-white"
                                         title={isPanelFullScreen ? 'Volver a panel lateral' : 'Expandir pantalla completa'}
                                     >
                                         {isPanelFullScreen ? <Columns2 size={20} /> : <Maximize2 size={20} />}
                                     </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.1, rotate: 90 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={onClose}
                                        className="p-2.5 hover:bg-white/10 rounded-xl transition-colors text-white/50 hover:text-white"
                                        title="Cerrar"
                                    >
                                        <X size={20} />
                                    </motion.button>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                            {loading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        <span className="text-slate-400 font-medium text-sm">Buscando en Notion...</span>
                                    </div>
                                </div>
                            ) : patient ? (
                                <>
                                    {/* Quick Stats Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <StatCard label="Edad" value={patient.age ? `${patient.age} años` : 'N/A'} gradient="from-blue-50 to-blue-50/50" borderColor="border-blue-100/60" />
                                        <StatCard label="Teléfono" value={patient.phone || 'N/A'} gradient="from-sky-50 to-sky-50/50" borderColor="border-sky-100/60" truncate>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-bold text-sm text-slate-700 truncate">{patient.phone || 'N/A'}</span>
                                                {patient.phone && (
                                                    <button
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            navigator.clipboard.writeText(patient.phone || '');
                                                        }}
                                                        className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center shrink-0"
                                                        title="Copiar teléfono"
                                                    >
                                                        <Copy size={14} />
                                                    </button>
                                                )}
                                                {patientWhatsAppUrl && (
                                                    <a
                                                        href={patientWhatsAppUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(event) => event.stopPropagation()}
                                                        className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 flex items-center justify-center shrink-0"
                                                        title="Abrir WhatsApp"
                                                    >
                                                        <MessageCircle size={14} />
                                                    </a>
                                                )}
                                            </div>
                                        </StatCard>
                                        <StatCard label="Dosha" value={patient.dosha || 'No det.'} gradient={`from-emerald-50 to-emerald-50/50`} borderColor="border-emerald-100/60" highlight />
                                        <StatCard label="Email" value={patient.email || 'N/A'} gradient="from-amber-50 to-amber-50/50" borderColor="border-amber-100/60" truncate />
                                    </div>

                                    {/* ═══ Historial de Visitas ═══ */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-1">
                                            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                <History size={16} className="text-primary" />
                                                Historial de Visitas
                                            </h3>
                                            <span className="text-[10px] bg-slate-200/60 text-slate-600 font-bold px-2.5 py-1 rounded-full">
                                                {visitGroups.length} {visitGroups.length === 1 ? 'visita' : 'visitas'}
                                            </span>
                                        </div>

                                        {visitGroups.map((group) => {
                                            const isExpanded = expandedGroups[group.id];
                                            const activeTab = activeVisitTabs[group.id] || (group.type === 'initial' ? 'ficha' : 'treatment');

                                            const setTab = (tab: 'treatment' | 'pulse' | 'tongue' | 'notes' | 'symptoms' | 'ficha') => {
                                                setActiveVisitTabs(prev => ({ ...prev, [group.id]: tab }));
                                            };

                                            const toggleExpand = () => {
                                                setExpandedGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }));
                                            };

                                            return (
                                                <motion.div
                                                    key={group.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                                                >
                                                    {/* Visit Header */}
                                                    <div
                                                        onClick={toggleExpand}
                                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors border-b border-slate-50"
                                                        style={{
                                                            background: group.type === 'initial' 
                                                                ? 'linear-gradient(135deg, rgba(34,197,94,0.04) 0%, rgba(212,168,83,0.02) 100%)'
                                                                : 'linear-gradient(135deg, rgba(14,165,233,0.04) 0%, rgba(34,197,94,0.02) 100%)'
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                                group.type === 'initial' ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-100 text-sky-600'
                                                            }`}>
                                                                <Calendar size={16} />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-slate-800 text-sm">{group.label}</h4>
                                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                                    {new Date(group.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            {/* Summary Badges */}
                                                            <div className="hidden sm:flex items-center gap-2">
                                                                {group.pulseReadings.length > 0 && (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100/50">
                                                                        <Activity size={10} /> Pulso
                                                                    </span>
                                                                )}
                                                                {group.tonguePhotos.length > 0 && (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-500 bg-sky-50 px-2 py-0.5 rounded border border-sky-100/50">
                                                                        <Camera size={10} /> Lengua ({group.tonguePhotos.length})
                                                                    </span>
                                                                )}
                                                                {group.notes.length > 0 && (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded border border-amber-100/50">
                                                                        <StickyNote size={10} /> Notas ({group.notes.length})
                                                                    </span>
                                                                )}
                                                                {(group.treatmentPlans.length > 0 || group.visitRecord) && (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50">
                                                                        <FolderOpen size={10} /> Ficha/Visita
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Expand Icon */}
                                                            <motion.div
                                                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                                                transition={{ duration: 0.2 }}
                                                                className="p-1 text-slate-400"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            </motion.div>
                                                        </div>
                                                    </div>

                                                    {/* Visit Body Accordion */}
                                                    <AnimatePresence>
                                                        {isExpanded && (
                                                            <motion.div
                                                                initial={{ height: 0 }}
                                                                animate={{ height: 'auto' }}
                                                                exit={{ height: 0 }}
                                                                className="overflow-hidden"
                                                            >
                                                                {/* Inner Tabs Navigation */}
                                                                <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100 flex flex-wrap gap-1.5">
                                                                    {group.type === 'initial' && (
                                                                        <button
                                                                            onClick={() => setTab('ficha')}
                                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                                activeTab === 'ficha' ? 'bg-white text-emerald-700 shadow-sm border border-slate-100/80 font-black' : 'text-slate-500 hover:text-slate-800'
                                                                            }`}
                                                                        >
                                                                            🗂️ Datos de Ficha
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => setTab('treatment')}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                            activeTab === 'treatment' ? 'bg-white text-slate-800 shadow-sm border border-slate-100/80 font-black' : 'text-slate-500 hover:text-slate-800'
                                                                        }`}
                                                                    >
                                                                        📋 {group.type === 'initial' ? 'Tratamientos PDF' : 'Tratamiento y Visita'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setTab('pulse')}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                            activeTab === 'pulse' ? 'bg-white text-slate-800 shadow-sm border border-slate-100/80 font-black' : 'text-slate-500 hover:text-slate-800'
                                                                        }`}
                                                                    >
                                                                        🩺 Pulso {group.pulseReadings.length > 0 && `(${group.pulseReadings.length})`}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setTab('tongue')}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                            activeTab === 'tongue' ? 'bg-white text-slate-800 shadow-sm border border-slate-100/80 font-black' : 'text-slate-500 hover:text-slate-800'
                                                                        }`}
                                                                    >
                                                                        📸 Lengua {group.tonguePhotos.length > 0 && `(${group.tonguePhotos.length})`}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setTab('symptoms')}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                            activeTab === 'symptoms' ? 'bg-white text-slate-800 shadow-sm border border-slate-100/80 font-black' : 'text-slate-500 hover:text-slate-800'
                                                                        }`}
                                                                    >
                                                                        📊 Síntomas
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setTab('notes')}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                            activeTab === 'notes' ? 'bg-white text-slate-800 shadow-sm border border-slate-100/80 font-black' : 'text-slate-500 hover:text-slate-800'
                                                                        }`}
                                                                    >
                                                                        📝 Notas {group.notes.length > 0 && `(${group.notes.length})`}
                                                                    </button>
                                                                </div>

                                                                {/* Inner Tab Contents */}
                                                                <div className="p-4">
                                                                    {activeTab === 'ficha' && group.type === 'initial' && (
                                                                        <div className="space-y-4">
                                                                            {patient.clinicalData && Object.keys(patient.clinicalData).length > 0 && (
                                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                                    {Object.entries(patient.clinicalData).map(([key, value]) => (
                                                                                        <div key={key} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/50 border border-slate-100/50">
                                                                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                                                                                style={{ background: getClinicalFieldColor(key).bg }}>
                                                                                                {getClinicalFieldIcon(key, getClinicalFieldColor(key).icon)}
                                                                                            </div>
                                                                                            <div className="flex-1 min-w-0">
                                                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{key}</span>
                                                                                                <span className="text-xs text-slate-700 font-medium leading-snug block mt-0.5 break-words">{value}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                            {parseNotes(patient.fullNotes).length > 0 && (
                                                                                <div className="space-y-3 pt-2">
                                                                                    <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Detalle Completo de Ficha</h5>
                                                                                    {parseNotes(patient.fullNotes).map((section, idx) => (
                                                                                        <div key={idx} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                                                                            <h6 className="font-bold text-slate-800 text-xs border-b border-slate-100 pb-2 mb-2">{section.title}</h6>
                                                                                            <div className="text-slate-600 text-xs leading-relaxed whitespace-pre-line">
                                                                                                {section.content}
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {activeTab === 'treatment' && (
                                                                        <div className="space-y-3">
                                                                            {group.type === 'initial' ? (
                                                                                group.treatmentPlans.length > 0 ? (
                                                                                    <div className="grid grid-cols-1 gap-3">
                                                                                        {group.treatmentPlans.map((plan) => (
                                                                                            <div key={plan.id || plan.date} className="rounded-xl border border-emerald-100 bg-emerald-50/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                                                                <div className="flex items-center gap-3">
                                                                                                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                                                                                        <FolderOpen size={16} />
                                                                                                    </div>
                                                                                                    <div>
                                                                                                        <p className="text-xs font-bold text-emerald-800">{plan.title || `Tratamiento Inicial`}</p>
                                                                                                        <p className="text-[10px] text-slate-400 mt-0.5">{formatNoteDate(plan.updatedAt || plan.createdAt || plan.date)}</p>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <button
                                                                                                        onClick={() => setOpenRecord({ type: 'plan', record: plan })}
                                                                                                        className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50 transition-colors"
                                                                                                    >
                                                                                                        Editar
                                                                                                    </button>
                                                                                                    <button
                                                                                                        onClick={() => openTreatmentPDFEditor(plan.diagnosis || '', { type: 'plan', record: plan })}
                                                                                                        className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-bold hover:bg-amber-600 transition-colors"
                                                                                                    >
                                                                                                        Ver/PDF
                                                                                                    </button>
                                                                                                    {plan.pdfFile && (
                                                                                                        <button
                                                                                                            onClick={() => downloadSavedPdf(plan.id!, plan.title || 'Tratamiento')}
                                                                                                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors"
                                                                                                        >
                                                                                                            Descargar PDF
                                                                                                        </button>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                                                                        <p className="text-xs text-slate-400 mb-3">No hay planes de tratamiento generados aún para esta consulta inicial.</p>
                                                                                        <button
                                                                                            onClick={() => openTreatmentPDFEditor('', null)}
                                                                                            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-all flex items-center gap-1.5 mx-auto"
                                                                                        >
                                                                                            <Plus size={14} /> Generar Tratamiento Inicial
                                                                                        </button>
                                                                                    </div>
                                                                                )
                                                                            ) : (
                                                                                group.visitRecord ? (
                                                                                    <div className="space-y-4">
                                                                                        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                                                                                            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                                                                                                <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Detalles de Consulta</h5>
                                                                                                <div className="flex items-center gap-1.5">
                                                                                                    <button
                                                                                                        onClick={() => openEditVisitModal(group.visitRecord)}
                                                                                                        className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                                                                                    >
                                                                                                        Editar
                                                                                                    </button>
                                                                                                    <button
                                                                                                        onClick={() => reopenVisitTreatmentPdf(group.visitRecord!, group.treatmentPlans)}
                                                                                                        className="px-2.5 py-1 rounded-md bg-amber-500 text-slate-950 text-[10px] font-bold hover:bg-amber-600 transition-colors"
                                                                                                        title="Reabrir el PDF guardado de esta consulta en el editor para modificarlo"
                                                                                                    >
                                                                                                        Ver/PDF
                                                                                                    </button>
                                                                                                    {group.visitRecord.pdfFile && (
                                                                                                        <button
                                                                                                            onClick={() => downloadSavedPdf(group.visitRecord.id!, group.visitRecord.title || 'Consulta')}
                                                                                                            className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition-colors"
                                                                                                        >
                                                                                                            Descargar PDF
                                                                                                        </button>
                                                                                                    )}
                                                                                                    <button
                                                                                                        onClick={() => handleDeleteVisit(group.visitRecord!)}
                                                                                                        disabled={savingRecordId === group.visitRecord.id}
                                                                                                        className="px-2.5 py-1 rounded-md bg-white border border-red-200 text-[10px] font-bold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1 disabled:opacity-50"
                                                                                                        title="Borrar visita de seguimiento"
                                                                                                    >
                                                                                                        {savingRecordId === group.visitRecord.id
                                                                                                            ? <Loader2 size={11} className="animate-spin" />
                                                                                                            : <Trash2 size={11} />}
                                                                                                        Borrar
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="space-y-3 text-xs">
                                                                                                {group.visitRecord.note && (
                                                                                                    <div>
                                                                                                        <span className="font-bold text-slate-400 block mb-0.5">Nota General:</span>
                                                                                                        <p className="text-slate-700 bg-white p-2.5 rounded-lg border border-slate-100 leading-relaxed">{group.visitRecord.note}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                {group.visitRecord.diagnosis && (
                                                                                                    <div>
                                                                                                        <span className="font-bold text-slate-400 block mb-0.5">Diagnóstico:</span>
                                                                                                        <div className="prose prose-sm prose-emerald max-w-none text-slate-750 bg-white p-3 rounded-lg border border-slate-100 leading-relaxed overflow-x-auto">
                                                                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{group.visitRecord.diagnosis}</ReactMarkdown>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                )}
                                                                                                {group.visitRecord.treatment && (
                                                                                                    <div>
                                                                                                        <span className="font-bold text-slate-400 block mb-0.5">Tratamiento Indicado:</span>
                                                                                                        <div className="prose prose-sm prose-emerald max-w-none text-slate-750 bg-white p-3 rounded-lg border border-slate-100 leading-relaxed">
                                                                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{group.visitRecord.treatment}</ReactMarkdown>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                )}
                                                                                                {group.visitRecord.lifestyle && (
                                                                                                    <div>
                                                                                                        <span className="font-bold text-slate-400 block mb-0.5">Estilo de Vida:</span>
                                                                                                        <div className="prose prose-sm prose-emerald max-w-none text-slate-750 bg-white p-3 rounded-lg border border-slate-100 leading-relaxed">
                                                                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{group.visitRecord.lifestyle}</ReactMarkdown>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>

                                                                                        {group.treatmentPlans.length > 0 && (
                                                                                            <div className="space-y-2">
                                                                                                <h5 className="font-bold text-slate-400 text-[10px] uppercase tracking-wider px-1">Planes de Tratamiento PDF Relacionados</h5>
                                                                                                {group.treatmentPlans.map(plan => (
                                                                                                    <div key={plan.id} className="rounded-xl border border-emerald-100 bg-emerald-50/10 p-3.5 flex items-center justify-between gap-3 text-xs">
                                                                                                        <div className="flex items-center gap-2">
                                                                                                            <FolderOpen size={14} className="text-emerald-600" />
                                                                                                            <span className="font-bold text-slate-700 truncate">{plan.title || 'Tratamiento PDF'}</span>
                                                                                                        </div>
                                                                                                        <div className="flex items-center gap-1.5">
                                                                                                            <button
                                                                                                                onClick={() => openTreatmentPDFEditor(plan.diagnosis || '', { type: 'plan', record: plan })}
                                                                                                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[10px] transition-colors"
                                                                                                                title="Reabrir este PDF guardado en el editor para modificarlo"
                                                                                                            >
                                                                                                                {plan.pdfFile || (plan.treatment && plan.treatment.trim()) ? 'Ver/Editar PDF' : 'Generar PDF'}
                                                                                                            </button>
                                                                                                            {plan.pdfFile && (
                                                                                                                <button
                                                                                                                    onClick={() => downloadSavedPdf(plan.id!, plan.title || 'Tratamiento')}
                                                                                                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] transition-colors"
                                                                                                                >
                                                                                                                    Descargar PDF
                                                                                                                </button>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ) : null
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {activeTab === 'pulse' && (
                                                                        <div className="space-y-3">
                                                                            {group.pulseReadings.length > 0 ? (
                                                                                <div className="space-y-3">
                                                                                    {group.pulseReadings.map((reading) => (
                                                                                        <div key={reading.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                                                                                            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <Activity size={14} className="text-red-500 animate-pulse" />
                                                                                                    <span className="font-bold text-slate-800 text-xs">Lectura de Pulso</span>
                                                                                                </div>
                                                                                                <button
                                                                                                    onClick={() => handleDeletePulseReading(reading)}
                                                                                                    className="text-slate-400 hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors"
                                                                                                    title="Borrar lectura"
                                                                                                >
                                                                                                    <Trash2 size={13} />
                                                                                                </button>
                                                                                            </div>
                                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                                                {reading.positions.map((position) => (
                                                                                                    <div key={`${reading.id}-${position.side}-${position.point}`} className="rounded-lg bg-white border border-slate-100 p-3 text-xs">
                                                                                                        <div className="flex items-center justify-between mb-2">
                                                                                                            <span className="font-black text-slate-700">{position.sideLabel} · {position.point}{position.number}</span>
                                                                                                            <span className="text-[10px] text-slate-400">{position.number}</span>
                                                                                                        </div>
                                                                                                        <div className="space-y-1">
                                                                                                            <div className="flex items-center justify-between gap-2">
                                                                                                                <span className="text-slate-500 truncate">Superficial: {position.superficialOrgan}</span>
                                                                                                                <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${getPulseStatusClass(position.superficialStatus)}`}>
                                                                                                                    {getPulseStatusLabel(position.superficialStatus)}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                            <div className="flex items-center justify-between gap-2">
                                                                                                                <span className="text-slate-500 truncate">Profundo: {position.deepOrgan}</span>
                                                                                                                <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${getPulseStatusClass(position.deepStatus)}`}>
                                                                                                                    {getPulseStatusLabel(position.deepStatus)}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                            {reading.notes && (
                                                                                                <p className="mt-3 text-xs text-slate-600 bg-white border border-slate-100 rounded-lg p-3 whitespace-pre-line">{reading.notes}</p>
                                                                                            )}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                addingPulseGroupId !== group.id && (
                                                                                    <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                                                                        <p className="text-xs text-slate-400 mb-3">No hay lecturas de pulso guardadas para esta visita.</p>
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                setAddingPulseGroupId(group.id);
                                                                                                setPulseDate(group.date.split('T')[0]);
                                                                                                setPulsePositions(PULSE_SCHEMA);
                                                                                                setPulseNotes('');
                                                                                                setPulseError('');
                                                                                            }}
                                                                                            className="px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-all flex items-center gap-1.5 mx-auto"
                                                                                        >
                                                                                            <Plus size={14} /> Registrar Pulso
                                                                                        </button>
                                                                                    </div>
                                                                                )
                                                                            )}

                                                                            {addingPulseGroupId === group.id && (
                                                                                <div className="rounded-xl border border-red-100 bg-red-50/10 p-4 space-y-4">
                                                                                    <div className="flex items-center justify-between border-b border-red-100/50 pb-2">
                                                                                        <h5 className="font-bold text-red-500 text-xs uppercase tracking-wider">Nuevo Pulso Ayurvédico</h5>
                                                                                        <button
                                                                                            onClick={() => setAddingPulseGroupId(null)}
                                                                                            className="text-slate-400 hover:text-slate-600 text-[11px]"
                                                                                        >
                                                                                            Cancelar
                                                                                        </button>
                                                                                    </div>
                                                                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                                                                        {(['right', 'left'] as const).map(side => (
                                                                                            <div key={side} className="rounded-xl border border-slate-100 bg-slate-50/60 overflow-hidden">
                                                                                                <div className="px-3 py-2 bg-white border-b border-slate-100 flex items-center justify-between text-xs">
                                                                                                    <span className="font-bold text-slate-700 uppercase tracking-wider">
                                                                                                        {side === 'right' ? 'Derecha' : 'Izquierda'}
                                                                                                    </span>
                                                                                                    <span className="font-bold text-slate-400">
                                                                                                        {side === 'right' ? 'V 1 · P 2 · K 3' : 'K 3 · P 2 · V 1'}
                                                                                                    </span>
                                                                                                </div>
                                                                                                <div className="divide-y divide-slate-100">
                                                                                                    {pulsePositions.map((position, index) => position.side === side && (
                                                                                                        <div key={`${position.side}-${position.point}`} className="p-3 grid grid-cols-1 md:grid-cols-[4rem_1fr_1fr] gap-3 items-start text-xs">
                                                                                                            <div className="flex md:flex-col items-center md:items-start gap-1">
                                                                                                                <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-700">
                                                                                                                    {position.point}{position.number}
                                                                                                                </span>
                                                                                                            </div>

                                                                                                            <label className="space-y-1 block">
                                                                                                                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Superficial</span>
                                                                                                                <div className="rounded-lg border border-slate-200 bg-white p-2 space-y-1">
                                                                                                                    <p className="font-bold text-slate-800 text-[11px] truncate">{position.superficialOrgan}</p>
                                                                                                                    <select
                                                                                                                        value={position.superficialStatus}
                                                                                                                        onChange={(event) => updatePulsePosition(index, 'superficialStatus', event.target.value)}
                                                                                                                        className="w-full h-8 rounded border border-slate-200 bg-slate-50 px-1 text-[11px] text-slate-700 focus:outline-none"
                                                                                                                    >
                                                                                                                        {PULSE_STATUS_OPTIONS.map(option => (
                                                                                                                            <option key={option.value} value={option.value}>{option.label}</option>
                                                                                                                        ))}
                                                                                                                    </select>
                                                                                                                </div>
                                                                                                            </label>

                                                                                                            <label className="space-y-1 block">
                                                                                                                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Profundo</span>
                                                                                                                <div className="rounded-lg border border-slate-200 bg-white p-2 space-y-1">
                                                                                                                    <p className="font-bold text-slate-800 text-[11px] truncate">{position.deepOrgan}</p>
                                                                                                                    <select
                                                                                                                        value={position.deepStatus}
                                                                                                                        onChange={(event) => updatePulsePosition(index, 'deepStatus', event.target.value)}
                                                                                                                        className="w-full h-8 rounded border border-slate-200 bg-slate-50 px-1 text-[11px] text-slate-700 focus:outline-none"
                                                                                                                    >
                                                                                                                        {PULSE_STATUS_OPTIONS.map(option => (
                                                                                                                            <option key={option.value} value={option.value}>{option.label}</option>
                                                                                                                        ))}
                                                                                                                    </select>
                                                                                                                </div>
                                                                                                            </label>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                    <label className="space-y-1.5 block">
                                                                                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Notas del Pulso</span>
                                                                                        <SpeechTextarea
                                                                                            value={pulseNotes}
                                                                                            onValueChange={setPulseNotes}
                                                                                            rows={2}
                                                                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs resize-none focus:ring-2 focus:ring-red-100 outline-none"
                                                                                            placeholder="Observaciones generales del pulso..."
                                                                                        />
                                                                                    </label>
                                                                                    {pulseError && <p className="text-xs text-red-500 font-bold">{pulseError}</p>}
                                                                                    <div className="flex justify-end gap-2">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => setAddingPulseGroupId(null)}
                                                                                            className="px-3.5 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                                                                                        >
                                                                                            Cancelar
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={async () => {
                                                                                                await handleSavePulseReading();
                                                                                                setAddingPulseGroupId(null);
                                                                                                await fetchPatientDetails();
                                                                                            }}
                                                                                            disabled={savingPulseReading}
                                                                                            className="px-3.5 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                                                                                        >
                                                                                            {savingPulseReading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                                                            Guardar pulso
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {activeTab === 'tongue' && (
                                                                        <div className="space-y-3">
                                                                            {group.tonguePhotos.length > 0 ? (
                                                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                                                    {group.tonguePhotos.map((photo) => {
                                                                                        return (
                                                                                        <div key={photo.id} className="group rounded-xl border border-slate-100 bg-slate-50/50 overflow-hidden text-xs flex flex-col">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => setActiveTonguePhoto(photo)}
                                                                                                className="block w-full aspect-[4/3] bg-slate-100 overflow-hidden"
                                                                                            >
                                                                                                <img
                                                                                                    src={photo.url}
                                                                                                    alt="Foto de lengua"
                                                                                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                                                                    onError={(e) => {
                                                                                                        const img = e.currentTarget;
                                                                                                        img.style.display = 'none';
                                                                                                        const fallback = img.nextElementSibling as HTMLElement | null;
                                                                                                        if (fallback) fallback.style.display = 'flex';
                                                                                                    }}
                                                                                                />
                                                                                                <div className="w-full h-full hidden flex-col items-center justify-center gap-1.5 bg-slate-100 text-slate-400">
                                                                                                    <Camera size={24} />
                                                                                                    <span className="font-bold text-[10px]">No se pudo cargar</span>
                                                                                                </div>
                                                                                            </button>
                                                                                            <div className="p-2.5 flex items-center justify-between gap-2 bg-white">
                                                                                                <div className="min-w-0 flex-1">
                                                                                                    <p className="font-bold text-slate-700 truncate">{photo.originalName || 'Foto de lengua'}</p>
                                                                                                    <p className="text-[9px] text-slate-400 mt-0.5">{formatNoteDate(photo.createdAt)}</p>
                                                                                                </div>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={async () => {
                                                                                                        await handleDeleteTonguePhoto(photo);
                                                                                                        await fetchPatientDetails();
                                                                                                    }}
                                                                                                    className="w-7 h-7 rounded-md bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0"
                                                                                                    title="Borrar foto"
                                                                                                >
                                                                                                    <Trash2 size={13} />
                                                                                                </button>
                                                                                            </div>
                                                                                            <div className="px-2.5 pb-2.5 bg-white space-y-1.5">
                                                                                                <TonguePhotoNoteEditor
                                                                                                    initialNote={photo.note || ''}
                                                                                                    onSave={(note) => handleUpdateTonguePhotoNote(photo, note)}
                                                                                                />
                                                                                            </div>
                                                                                        </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-xs text-slate-400">
                                                                                    No hay fotos de lengua guardadas para esta visita.
                                                                                </div>
                                                                            )}

                                                                            <div className="pt-2">
                                                                                <label className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                                                                    uploadingTonguePhoto
                                                                                        ? 'bg-slate-100 text-slate-400 pointer-events-none'
                                                                                        : 'bg-sky-500 text-white hover:bg-sky-600 shadow-sm shadow-sky-500/20'
                                                                                }`}
                                                                                    onClick={() => setActiveUploadGroupDate(group.date)}
                                                                                >
                                                                                    {uploadingTonguePhoto ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                                                                    {uploadingTonguePhoto ? 'Subiendo...' : 'Subir foto de lengua'}
                                                                                    <input
                                                                                        type="file"
                                                                                        accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
                                                                                        onChange={async (e) => {
                                                                                            await handleTonguePhotoUpload(e);
                                                                                            setActiveUploadGroupDate(null);
                                                                                            await fetchPatientDetails();
                                                                                        }}
                                                                                        className="hidden"
                                                                                    />
                                                                                </label>
                                                                                {tonguePhotoError && (
                                                                                    <p className="text-xs text-red-500 font-bold mt-2">{tonguePhotoError}</p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {activeTab === 'symptoms' && (
                                                                        <div className="space-y-3">
                                                                            {group.symptoms.type === 'initial' ? (
                                                                                (group.symptoms.data as SymptomCalibration[]).length > 0 ? (
                                                                                    <div className="divide-y divide-slate-100 bg-slate-50/50 border border-slate-100 rounded-xl p-3.5 space-y-2 text-xs">
                                                                                        <h5 className="font-bold text-slate-400 text-[10px] uppercase tracking-wider pb-1">Calibración Inicial de Síntomas</h5>
                                                                                        {(group.symptoms.data as SymptomCalibration[]).map((item, idx) => (
                                                                                            <div key={idx} className="flex items-center justify-between py-1.5 border-b border-slate-100/30 last:border-b-0">
                                                                                                <span className="font-medium text-slate-700">{item.symptom}</span>
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${getFrequencyBadge(item.frequency)}`}>
                                                                                                        {item.frequency}
                                                                                                    </span>
                                                                                                    <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${getIntensityBadge(item.intensity)}`}>
                                                                                                        Intensidad: {item.intensity}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="text-center py-6 text-xs text-slate-400">No se registraron síntomas en la ficha inicial.</div>
                                                                                )
                                                                            ) : (
                                                                                Object.keys(group.symptoms.data).length > 0 ? (
                                                                                    <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3.5 space-y-2 text-xs">
                                                                                        <h5 className="font-bold text-slate-400 text-[10px] uppercase tracking-wider pb-1">Estado de Síntomas en esta Visita</h5>
                                                                                        {Object.entries(group.symptoms.data as Record<string, { frequency: string; intensity: number }>).map(([symptom, val], idx) => (
                                                                                            <div key={idx} className="flex items-center justify-between py-1.5 border-b border-slate-100/50 last:border-b-0 last:pb-0">
                                                                                                <span className="font-medium text-slate-700">{symptom}</span>
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${getFrequencyBadge(val.frequency)}`}>
                                                                                                        {val.frequency}
                                                                                                    </span>
                                                                                                    <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${getIntensityBadge(val.intensity)}`}>
                                                                                                        Intensidad: {val.intensity}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="text-center py-6 text-xs text-slate-400">No se actualizaron síntomas en esta visita.</div>
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {activeTab === 'notes' && (
                                                                        <div className="space-y-4 text-xs">
                                                                            {group.notes.length > 0 ? (
                                                                                <div className="space-y-2.5">
                                                                                    {group.notes.map((note) => (
                                                                                        <div key={note.id} className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl leading-relaxed">
                                                                                            <div className="text-slate-700 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                                                                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.text}</ReactMarkdown>
                                                                                            </div>
                                                                                            <div className="flex items-center gap-1 mt-2 text-slate-400 text-[9px]">
                                                                                                <Clock size={10} />
                                                                                                <span>{formatNoteDate(note.createdAt)}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-center py-6 text-xs text-slate-400">No hay notas de profesional para esta visita.</div>
                                                                            )}

                                                                            <div className="pt-2 border-t border-slate-50">
                                                                                <div className="flex gap-2 items-end">
                                                                                    <SpeechTextarea
                                                                                        value={newNotes[group.id] || ''}
                                                                                        onValueChange={(val) => setNewNotes(prev => ({ ...prev, [group.id]: val }))}
                                                                                        placeholder={"Añade una nota clínica para esta visita...\nPuedes usar viñetas y listas:\n- Pulso: vata elevado\n- Lengua: saburra blanca\n- Indicación: ..."}
                                                                                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm resize-y focus:ring-2 focus:ring-amber-200 outline-none min-h-[7rem]"
                                                                                        rows={6}
                                                                                    />
                                                                                    <button
                                                                                        onClick={async () => {
                                                                                            await handleSaveNote(group.id);
                                                                                            await fetchPatientDetails();
                                                                                            await fetchDoctorNotes();
                                                                                        }}
                                                                                        disabled={savingNote || !(newNotes[group.id] || '').trim()}
                                                                                        className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                                                                                    >
                                                                                        {savingNote ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
                                                                                    </button>
                                                                                </div>
                                                                                {noteError && (
                                                                                    <p className="mt-2 text-[11px] text-red-600">{noteError}</p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </motion.div>
                                            );
                                        })}
                                    </div>

                                    {/* ═══ Symptom Evolution Table ═══ */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                                    >
                                        <div className="p-4 border-b border-slate-100 flex items-center justify-between"
                                            style={{
                                                background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(99,102,241,0.04) 100%)'
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                                                    <Activity size={16} className="text-violet-600" />
                                                </div>
                                                <h3 className="font-bold text-slate-800 text-sm">Evolución de Síntomas</h3>
                                            </div>
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={openNewVisitModal}
                                                className="bg-white text-violet-600 text-xs font-bold px-3 py-1.5 rounded-lg border border-violet-100 shadow-sm hover:bg-violet-50 transition-colors flex items-center gap-1"
                                            >
                                                <Plus size={14} />
                                                Nueva Visita
                                            </motion.button>
                                        </div>

                                        <div className="border-b border-slate-100 p-4">
                                            {(() => {
                                                const chartSymptoms = symptomEvolution.symptoms
                                                    .filter(item => item.values.some(value => value !== null))
                                                    .slice(0, 8);
                                                const trend = getTrendMeta(symptomEvolution.averageDelta);
                                                const chartWidth = 760;
                                                const chartHeight = 220;
                                                const padding = { top: 18, right: 24, bottom: 34, left: 34 };
                                                const maxValue = Math.max(9, ...chartSymptoms.flatMap(item => item.values.filter((value): value is number => value !== null)));
                                                const pointX = (idx: number) => {
                                                    const steps = Math.max(symptomEvolution.labels.length - 1, 1);
                                                    return padding.left + (idx / steps) * (chartWidth - padding.left - padding.right);
                                                };
                                                const pointY = (value: number) => padding.top + (1 - value / maxValue) * (chartHeight - padding.top - padding.bottom);
                                                const palette = ['#7c3aed', '#059669', '#dc2626', '#d97706', '#2563eb', '#0891b2', '#be123c', '#4f46e5'];

                                                if (chartSymptoms.length === 0) {
                                                    return (
                                                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center text-xs text-slate-400">
                                                            La gráfica aparecerá cuando haya síntomas calibrados o visitas registradas.
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="space-y-3">
                                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                            <div>
                                                                <p className="text-xs font-black uppercase tracking-wider text-slate-400">Gráfica de evolución</p>
                                                                <p className="text-[11px] text-slate-500">Puntaje = frecuencia x intensidad. Si baja, mejora.</p>
                                                            </div>
                                                            <span className={`inline-flex w-fit items-center rounded-lg border px-2.5 py-1 text-[10px] font-black ${trend.className}`}>
                                                                Tendencia general: {trend.label}
                                                            </span>
                                                        </div>
                                                        <div className="overflow-x-auto custom-scrollbar">
                                                            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="min-w-[680px] w-full h-[240px]">
                                                                {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                                                                    const y = padding.top + tick * (chartHeight - padding.top - padding.bottom);
                                                                    const value = Math.round(maxValue * (1 - tick));
                                                                    return (
                                                                        <g key={tick}>
                                                                            <line x1={padding.left} x2={chartWidth - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                                                                            <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{value}</text>
                                                                        </g>
                                                                    );
                                                                })}
                                                                {symptomEvolution.labels.map((label, idx) => (
                                                                    <g key={label}>
                                                                        <line x1={pointX(idx)} x2={pointX(idx)} y1={padding.top} y2={chartHeight - padding.bottom} stroke="#f1f5f9" strokeWidth="1" />
                                                                        <text x={pointX(idx)} y={chartHeight - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#94a3b8">{label}</text>
                                                                    </g>
                                                                ))}
                                                                {chartSymptoms.map((item, symptomIdx) => {
                                                                    const points = item.values
                                                                        .map((value, idx) => value === null ? null : `${pointX(idx)},${pointY(value)}`)
                                                                        .filter((point): point is string => Boolean(point));
                                                                    const color = palette[symptomIdx % palette.length];
                                                                    return (
                                                                        <g key={item.name}>
                                                                            {points.length > 1 && (
                                                                                <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                                                            )}
                                                                            {item.values.map((value, idx) => value === null ? null : (
                                                                                <circle key={`${item.name}-${idx}`} cx={pointX(idx)} cy={pointY(value)} r="4" fill="#fff" stroke={color} strokeWidth="2.5" />
                                                                            ))}
                                                                        </g>
                                                                    );
                                                                })}
                                                            </svg>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {chartSymptoms.map((item, idx) => {
                                                                const meta = getTrendMeta(item.delta);
                                                                return (
                                                                    <span key={item.name} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${meta.className}`}>
                                                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette[idx % palette.length] }} />
                                                                        {item.name}: {meta.label}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        <div className="overflow-x-auto custom-scrollbar">
                                            <table className="w-full text-sm border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                                        <th className="text-left p-4 min-w-[150px] sticky left-0 bg-[#FBFBFC] z-10 border-r border-slate-100/50 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Síntoma</th>
                                                        <th className="text-center p-4 min-w-[120px] text-[10px] uppercase font-bold text-slate-400 tracking-wider border-r border-slate-50">
                                                            <div>Consulta inicial</div>
                                                            <div className="text-[9px] font-normal text-slate-300 mt-0.5">Ficha</div>
                                                        </th>
                                                        {patient.visits.slice().reverse().map((visit, idx) => (
                                                            <th key={visit.id || idx} className="text-center p-4 min-w-[120px] text-[10px] uppercase font-bold text-slate-400 tracking-wider border-r border-slate-50 last:border-r-0">
                                                                <div>Visita de seguimiento {idx + 2}</div>
                                                                <div className="text-[9px] font-normal text-slate-300 mt-0.5">{new Date(visit.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</div>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        // Collect all unique symptoms
                                                        const allSymptoms = new Set<string>();
                                                        patient.symptomCalibrations.forEach(s => allSymptoms.add(s.symptom));
                                                        patient.visits.forEach(v => {
                                                            if (v.symptoms) Object.keys(v.symptoms).forEach(s => allSymptoms.add(s));
                                                        });
                                                        patient.plainSymptoms.forEach(s => allSymptoms.add(s));

                                                        return Array.from(allSymptoms).map((symptom, idx) => {
                                                            // Initial state
                                                            const initial = patient.symptomCalibrations.find(s => s.symptom === symptom);

                                                            return (
                                                                <tr key={idx} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                                                                    <td className="p-4 font-medium text-slate-700 sticky left-0 bg-white z-10 border-r border-slate-100/50">{symptom}</td>
                                                                    {/* Initial Column */}
                                                                    <td className="p-4 text-center border-r border-slate-50">
                                                                        {initial ? (
                                                                            <div className="flex flex-col items-center gap-1">
                                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getFrequencyBadge(initial.frequency)}`}>
                                                                                    {getFrequencyShort(initial.frequency)}
                                                                                </span>
                                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getIntensityBadge(initial.intensity)}`}>
                                                                                    {initial.intensity}
                                                                                </span>
                                                                            </div>
                                                                        ) : (
                                                                            patient.plainSymptoms.includes(symptom) ? <span className="text-slate-300 text-xs">•</span> : <span className="text-slate-200 text-xs">-</span>
                                                                        )}
                                                                    </td>
                                                                    {/* Visit Columns */}
                                                                    {patient.visits.slice().reverse().map((visit, vIdx) => {
                                                                        const vData = visit.symptoms ? visit.symptoms[symptom] : null;
                                                                        return (
                                                                            <td key={visit.id || vIdx} className="p-4 text-center border-r border-slate-50 last:border-r-0">
                                                                                {vData ? (
                                                                                    <div className="flex flex-col items-center gap-1">
                                                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getFrequencyBadge(vData.frequency)}`}>
                                                                                            {getFrequencyShort(vData.frequency)}
                                                                                        </span>
                                                                                        {!isSuperado(vData.frequency) && (
                                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getIntensityBadge(vData.intensity)}`}>
                                                                                                {vData.intensity}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-slate-200 text-xs">-</span>
                                                                                )}
                                                                            </td>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            );
                                                        });
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    </motion.div>

                                    {/* AI Diagnosis CTA */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="p-6 rounded-2xl relative overflow-hidden group"
                                        style={{
                                            background: 'linear-gradient(135deg, #0d1a13 0%, #132e1d 50%, #1a3a25 100%)',
                                        }}
                                    >
                                        <div className="absolute top-0 right-0 w-32 h-32 opacity-10"
                                            style={{ background: 'radial-gradient(circle, #D4A853 0%, transparent 70%)' }}
                                        />
                                        <div className="absolute bottom-0 left-1/4 w-40 h-20 opacity-5"
                                            style={{ background: 'radial-gradient(circle, #22C55E 0%, transparent 70%)' }}
                                        />
                                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div>
                                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                                    <Brain size={20} className="text-emerald-400" />
                                                    Diagnóstico con {aiProvider === 'gemini' ? 'Gemini' : 'DeepSeek'}
                                                </h3>
                                                <p className="text-white/50 text-sm mt-1">Informe ayurvédico detallado, estructurado y basado en la ficha.</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="flex bg-black/20 p-1 rounded-lg">
                                                    <button
                                                        onClick={() => setAiProvider('gemini')}
                                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${aiProvider === 'gemini' ? 'bg-emerald-500 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}
                                                    >
                                                        Gemini
                                                    </button>
                                                    <button
                                                        onClick={() => setAiProvider('deepseek')}
                                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${aiProvider === 'deepseek' ? 'bg-blue-500 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}
                                                    >
                                                        DeepSeek
                                                    </button>
                                                </div>

                                                {aiProvider === 'deepseek' && (
                                                    <div className="flex bg-black/20 p-1 rounded-lg">
                                                        <select
                                                            value={aiModel}
                                                            onChange={(e) => setAiModel(e.target.value)}
                                                            className="bg-transparent text-xs font-bold text-white outline-none border-none cursor-pointer [&>option]:text-black"
                                                        >
                                                            <option value="deepseek-v4-flash">V4 Flash</option>
                                                        </select>
                                                    </div>
                                                )}
                                                <motion.button
                                                    whileHover={{ scale: 1.03 }}
                                                    whileTap={{ scale: 0.97 }}
                                                    onClick={handleDiagnose}
                                                    disabled={aiLoading}
                                                    className="shimmer-btn bg-white text-[#0d1a13] px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-70 shrink-0"
                                                >
                                                    {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                                    {diagnosis ? 'Regenerar informe' : 'Generar diagnóstico'}
                                                </motion.button>
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* AI Diagnosis Output */}
                                    {diagnosis && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-white rounded-2xl border border-primary/15 shadow-sm overflow-hidden"
                                        >
                                            <div className="p-4 border-b border-primary/10 flex items-center justify-between"
                                                style={{
                                                    background: 'linear-gradient(135deg, rgba(34,197,94,0.04) 0%, rgba(212,168,83,0.03) 100%)'
                                                }}
                                            >
                                                <span className="font-bold text-primary text-sm flex items-center gap-2">
                                                    <ClipboardCheck size={16} />
                                                    Informe diagnóstico AI
                                                </span>
                                                <div className="flex gap-2 items-center">
                                                    <Badge variant="gradient">Beta</Badge>
                                                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px]">
                                                        <button
                                                            type="button"
                                                            onClick={() => setAiDiagnosisViewMode('edit')}
                                                            className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${aiDiagnosisViewMode === 'edit' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                                        >
                                                            Editar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setAiDiagnosisViewMode('preview')}
                                                            className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${aiDiagnosisViewMode === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                                        >
                                                            Vista Previa
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={handleOpenTreatmentFromLocalDiagnosis}
                                                        className="text-xs bg-amber-100 text-amber-800 px-3 py-1.5 rounded-md font-medium hover:bg-amber-200 transition-colors flex items-center gap-1.5 shadow-sm"
                                                    >
                                                        <Printer size={12} />
                                                        Descargar Tratamiento
                                                    </button>
                                                    <button
                                                        onClick={handleSaveDiagnosisLocal}
                                                        disabled={savingRecordId === 'new-diagnosis'}
                                                        className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-md font-medium hover:bg-green-200 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        {savingRecordId === 'new-diagnosis' ? 'Guardando...' : 'Guardar local editable'}
                                                    </button>
                                                </div>
                                            </div>
                                            {aiDiagnosisViewMode === 'edit' ? (
                                                <div className="p-4">
                                                    <SpeechTextarea
                                                        value={diagnosis || ''}
                                                        onValueChange={(value) => setDiagnosis(value)}
                                                        rows={16}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base leading-relaxed resize-y min-h-64 focus:ring-2 focus:ring-emerald-200/70 focus:border-emerald-300 outline-none"
                                                    />
                                                    <p className="text-[11px] text-slate-400 mt-2">
                                                        Edita el texto del diagnóstico libremente. Pulsa “Guardar local editable” para conservar los cambios.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="diagnosis-report p-6 text-slate-600 text-sm leading-relaxed prose prose-sm prose-emerald max-w-none prose-headings:text-slate-800 prose-headings:font-bold prose-p:text-slate-600 prose-strong:text-slate-700 prose-ul:list-disc prose-li:my-1 overflow-x-auto">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {diagnosis}
                                                    </ReactMarkdown>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}

                                    {/* Historial de diagnósticos IA (desplegable) */}
                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => setAiHistoryOpen(prev => !prev)}
                                            className="w-full p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                                            style={{
                                                background: 'linear-gradient(135deg, rgba(34,197,94,0.04) 0%, rgba(212,168,83,0.03) 100%)'
                                            }}
                                        >
                                            <span className="font-bold text-xs text-slate-600 uppercase tracking-[0.15em] flex items-center gap-2">
                                                <History size={14} />
                                                Historial de diagnósticos IA
                                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold normal-case tracking-normal">
                                                    {(patient.aiDiagnoses || []).length}
                                                </span>
                                            </span>
                                            <ChevronDown
                                                size={16}
                                                className={`text-slate-400 transition-transform ${aiHistoryOpen ? 'rotate-180' : ''}`}
                                            />
                                        </button>
                                        <AnimatePresence initial={false}>
                                            {aiHistoryOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="p-4 space-y-2 border-t border-slate-100">
                                                        {(patient.aiDiagnoses || []).length === 0 ? (
                                                            <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
                                                                <Brain className="mx-auto text-slate-200 mb-2" size={24} />
                                                                <p className="text-slate-400 text-xs">Aún no hay diagnósticos generados con IA. Cada diagnóstico que generes se guardará aquí automáticamente.</p>
                                                            </div>
                                                        ) : (
                                                            (patient.aiDiagnoses || []).map(entry => {
                                                                const expanded = expandedAiDiagnosisId === entry.id;
                                                                return (
                                                                    <div key={entry.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                                                        <div className="flex items-center justify-between gap-2 p-3 bg-slate-50/60">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setExpandedAiDiagnosisId(expanded ? null : entry.id)}
                                                                                className="flex-1 flex items-center gap-2 text-left min-w-0"
                                                                            >
                                                                                <ChevronDown
                                                                                    size={14}
                                                                                    className={`text-slate-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                                                                                />
                                                                                <span className="text-xs font-semibold text-slate-700 truncate">
                                                                                    {new Date(entry.createdAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                                                                                </span>
                                                                                {entry.dosha && (
                                                                                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0">
                                                                                        {entry.dosha}
                                                                                    </span>
                                                                                )}
                                                                                <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">
                                                                                    {entry.provider === 'gemini' ? 'Gemini' : 'DeepSeek'}
                                                                                </span>
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setDiagnosis(entry.diagnosis);
                                                                                    setAiDiagnosisViewMode('preview');
                                                                                }}
                                                                                className="text-[11px] bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md font-medium hover:bg-emerald-200 transition-colors shrink-0"
                                                                            >
                                                                                Cargar en editor
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDeleteAiDiagnosis(entry)}
                                                                                disabled={deletingAiDiagnosisId === entry.id}
                                                                                className="text-slate-300 hover:text-red-500 transition-colors p-1 shrink-0 disabled:opacity-50"
                                                                                title="Borrar del historial"
                                                                            >
                                                                                {deletingAiDiagnosisId === entry.id
                                                                                    ? <Loader2 size={14} className="animate-spin" />
                                                                                    : <Trash2 size={14} />}
                                                                            </button>
                                                                        </div>
                                                                        <AnimatePresence initial={false}>
                                                                            {expanded && (
                                                                                <motion.div
                                                                                    initial={{ height: 0, opacity: 0 }}
                                                                                    animate={{ height: 'auto', opacity: 1 }}
                                                                                    exit={{ height: 0, opacity: 0 }}
                                                                                    transition={{ duration: 0.2 }}
                                                                                    className="overflow-hidden"
                                                                                >
                                                                                    <div className="diagnosis-report p-4 border-t border-slate-100 text-slate-600 text-sm leading-relaxed prose prose-sm prose-emerald max-w-none prose-headings:text-slate-800 prose-headings:font-bold prose-p:text-slate-600 prose-strong:text-slate-700 prose-ul:list-disc prose-li:my-1 overflow-x-auto max-h-96 overflow-y-auto">
                                                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                                            {entry.diagnosis}
                                                                                        </ReactMarkdown>
                                                                                    </div>
                                                                                </motion.div>
                                                                            )}
                                                                        </AnimatePresence>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Documentos de contexto para la IA */}
                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3"
                                            style={{
                                                background: 'linear-gradient(135deg, rgba(34,197,94,0.04) 0%, rgba(212,168,83,0.03) 100%)'
                                            }}
                                        >
                                            <span className="font-bold text-xs text-slate-600 uppercase tracking-[0.15em] flex items-center gap-2">
                                                <FileText size={14} />
                                                Documentos de contexto
                                            </span>
                                            <label className={`text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${uploadingContextDoc ? 'bg-slate-100 text-slate-400 cursor-wait' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                                                {uploadingContextDoc ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                                                {uploadingContextDoc ? 'Subiendo...' : 'Subir archivo'}
                                                <input
                                                    type="file"
                                                    accept=".txt,.md,.markdown,.csv,.tsv,text/plain,text/markdown,text/csv"
                                                    multiple
                                                    className="hidden"
                                                    disabled={uploadingContextDoc}
                                                    onChange={handleContextDocUpload}
                                                />
                                            </label>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            <p className="text-xs text-slate-400 flex items-start gap-1.5">
                                                <Info size={13} className="mt-0.5 shrink-0" />
                                                Sube archivos de texto (.txt, .md, .csv) con información adicional del paciente. La IA los leerá automáticamente al generar el diagnóstico.
                                            </p>
                                            {contextDocError && (
                                                <p className="text-xs text-red-500 flex items-center gap-1.5">
                                                    <AlertCircle size={13} /> {contextDocError}
                                                </p>
                                            )}
                                            {(patient.contextDocuments || []).length === 0 ? (
                                                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
                                                    <FileText className="mx-auto text-slate-200 mb-2" size={24} />
                                                    <p className="text-slate-400 text-xs">Aún no hay documentos de contexto.</p>
                                                </div>
                                            ) : (
                                                <ul className="space-y-2">
                                                    {(patient.contextDocuments || []).map(doc => (
                                                        <li
                                                            key={doc.id}
                                                            className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100"
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <FileText size={15} className="text-emerald-600 shrink-0" />
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-semibold text-slate-700 truncate">{doc.originalName}</p>
                                                                    <p className="text-[10px] text-slate-400">
                                                                        {(doc.size / 1024).toFixed(1)} KB · {new Date(doc.createdAt).toLocaleDateString('es-MX')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <a
                                                                    href={`/api/patients/${patientId}/context-docs/${doc.id}/file`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                                                                    title="Ver documento"
                                                                >
                                                                    <ExternalLink size={13} />
                                                                </a>
                                                                <button
                                                                    onClick={() => handleDeleteContextDoc(doc)}
                                                                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                                    title="Borrar documento"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>


                                    {/* AI Chat Widget */}
                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-96 overflow-hidden">
                                        <div className="p-4 border-b border-slate-100 flex items-center gap-3"
                                            style={{
                                                background: 'linear-gradient(135deg, rgba(34,197,94,0.04) 0%, rgba(212,168,83,0.03) 100%)'
                                            }}
                                        >
                                            <div className="relative">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-50" />
                                            </div>
                                            <span className="font-bold text-xs text-slate-600 uppercase tracking-[0.15em]">Chat Médico con AI</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm custom-scrollbar">
                                            {chatHistory.length === 0 ? (
                                                <div className="text-center py-10">
                                                    <Brain className="mx-auto text-slate-200 mb-3" size={28} />
                                                    <p className="text-slate-400 text-xs">Pregunta cualquier duda técnica sobre este paciente.</p>
                                                </div>
                                            ) : (
                                                chatHistory.map((msg, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                    >
                                                        <div className={`max-w-[85%] px-4 py-3 text-[13px] leading-relaxed ${msg.role === 'user'
                                                            ? 'bg-primary text-white rounded-2xl rounded-br-lg shadow-sm shadow-primary/15'
                                                            : 'bg-slate-50 text-slate-700 rounded-2xl rounded-bl-lg border border-slate-100'
                                                            }`}>
                                                            {msg.role === 'ai' ? (
                                                                <div className="prose prose-sm prose-slate max-w-none prose-p:my-1 prose-headings:text-slate-700 prose-headings:text-sm prose-ul:my-1 prose-li:my-0.5">
                                                                    <ReactMarkdown children={msg.text} />
                                                                </div>
                                                            ) : (
                                                                <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-headings:text-white prose-headings:text-sm prose-ul:my-1 prose-li:my-0.5">
                                                                    <ReactMarkdown children={msg.text} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ))
                                            )}
                                            {isThinking && (
                                                <div className="flex justify-start">
                                                    <div className="bg-slate-50 px-4 py-3 rounded-2xl rounded-bl-lg border border-slate-100 flex items-center gap-2">
                                                        <div className="flex gap-1">
                                                            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                        </div>
                                                        <span className="text-slate-400 text-xs">Analizando...</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3 border-t border-slate-100 flex items-center gap-2 bg-slate-50/50">
                                            <input
                                                value={chatMessage}
                                                onChange={(e) => setChatMessage(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                                placeholder="Escribe una pregunta..."
                                                className="flex-1 bg-white border border-slate-200 focus:ring-2 focus:ring-primary/15 focus:border-primary/30 rounded-xl px-4 py-2.5 text-sm transition-all placeholder:text-slate-300"
                                            />
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={handleSendMessage}
                                                className="bg-primary text-white p-2.5 rounded-xl hover:bg-primary-600 transition-colors shadow-sm shadow-primary/20"
                                            >
                                                <Send size={16} />
                                            </motion.button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-20 text-slate-400">
                                    No se pudo cargar la información.
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
            {/* Add Visit Modal */}
            <AnimatePresence>
                {isAddingVisit && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]"
                            onClick={() => { setIsAddingVisit(false); setEditingVisitId(null); setEditCaseMode(false); }}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed inset-2 bg-white rounded-2xl shadow-2xl z-[90] flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 shrink-0">
                                    <h3 className="font-bold text-xl text-slate-800">{editCaseMode ? 'Editar Caso' : (editingVisitId ? 'Editar Visita' : 'Nueva Visita')}</h3>
                                    <AutosaveIndicator status={visitAutosaveStatus} errorMessage={visitAutosaveError} />
                                </div>
                                <div className="flex items-center gap-2 ml-auto">
                                    {hasAnyIntakeData && (
                                        <button
                                            type="button"
                                            onClick={() => setShowIntakeSummary(prev => !prev)}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors shrink-0 ${showIntakeSummary
                                                ? 'bg-primary text-white border-primary shadow-sm'
                                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                }`}
                                            title="Ver la ficha que llenó el paciente: síntomas, enfermedades, estilo de vida y más"
                                        >
                                            <FileText size={14} />
                                            {showIntakeSummary ? 'Ocultar ficha del paciente' : 'Ver ficha del paciente'}
                                        </button>
                                    )}
                                    <label className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Fecha</label>
                                    <input
                                        type="date"
                                        value={visitDate}
                                        onChange={(e) => setVisitDate(e.target.value)}
                                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
                                    />
                                </div>
                                <button
                                    onClick={() => { setIsAddingVisit(false); setEditingVisitId(null); setEditCaseMode(false); }}
                                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 min-h-0 px-6 pt-4 pb-6 flex flex-col">
                                {/* Ficha del paciente: lo que llenó él/ella, categorizado y en vista toggle */}
                                <AnimatePresence initial={false}>
                                    {showIntakeSummary && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden shrink-0"
                                        >
                                            <div className="mb-4 rounded-2xl border border-primary/15 bg-primary/[0.03] p-4 space-y-3 max-h-[45vh] overflow-y-auto custom-scrollbar">
                                                <div className="flex flex-wrap items-center justify-between gap-2 sticky -top-4 -mt-4 pt-4 pb-1 bg-primary/[0.03] z-10">
                                                    <div className="flex items-center gap-2">
                                                        <FileText size={16} className="text-primary" />
                                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Ficha que llenó el paciente</h4>
                                                    </div>
                                                    <div className="flex bg-white rounded-lg p-1 gap-1 border border-slate-200">
                                                        <button
                                                            type="button"
                                                            onClick={() => setIntakeViewMode('categorized')}
                                                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors ${intakeViewMode === 'categorized' ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-700'
                                                                }`}
                                                            title="Ver por categorías (acordeón)"
                                                        >
                                                            <LayoutGrid size={12} /> Categorías
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setIntakeViewMode('list')}
                                                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors ${intakeViewMode === 'list' ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-700'
                                                                }`}
                                                            title="Ver todo en una lista"
                                                        >
                                                            <List size={12} /> Lista completa
                                                        </button>
                                                    </div>
                                                </div>

                                                {intakeViewMode === 'categorized' ? (
                                                    <div className="space-y-2">
                                                        {INTAKE_CATEGORIES.map((category) => {
                                                            const categoryFields = (patient?.clinicalData
                                                                ? category.fields
                                                                    .filter(key => patient.clinicalData![key] && patient.clinicalData![key].trim())
                                                                    .map(key => [key, patient.clinicalData![key]] as [string, string])
                                                                : []);
                                                            const showSymptomBadges = category.key === 'sintomas' && (
                                                                (patient?.symptomCalibrations?.length || 0) > 0 || (patient?.plainSymptoms?.length || 0) > 0
                                                            );
                                                            if (categoryFields.length === 0 && !showSymptomBadges) return null;
                                                            const isOpen = !!openIntakeCategories[category.key];
                                                            return (
                                                                <div key={category.key} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleIntakeCategory(category.key)}
                                                                        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-slate-50 transition-colors"
                                                                    >
                                                                        <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-700">
                                                                            <span className="text-primary">{getIntakeCategoryIcon(category.key)}</span>
                                                                            {category.title}
                                                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                                                                {categoryFields.length + (showSymptomBadges ? (patient?.symptomCalibrations?.length || patient?.plainSymptoms?.length || 0) : 0)}
                                                                            </span>
                                                                        </span>
                                                                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                                                    </button>
                                                                    {isOpen && (
                                                                        <div className="px-3.5 pb-3.5 space-y-3">
                                                                            {showSymptomBadges && (
                                                                                <div className="flex flex-wrap gap-1.5">
                                                                                    {(patient?.symptomCalibrations || []).map((s, idx) => (
                                                                                        <span key={`cal-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-semibold text-slate-700">
                                                                                            {s.symptom}
                                                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${getFrequencyBadge(s.frequency)}`}>
                                                                                                {getFrequencyShort(s.frequency)}
                                                                                            </span>
                                                                                            {!isSuperado(s.frequency) && (
                                                                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${getIntensityBadge(s.intensity)}`}>
                                                                                                    {s.intensity}
                                                                                                </span>
                                                                                            )}
                                                                                        </span>
                                                                                    ))}
                                                                                    {(patient?.plainSymptoms || [])
                                                                                        .filter(sym => !(patient?.symptomCalibrations || []).some(s => s.symptom === sym))
                                                                                        .map((sym, idx) => (
                                                                                            <span key={`plain-${idx}`} className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-semibold text-slate-700">
                                                                                                {sym}
                                                                                            </span>
                                                                                        ))}
                                                                                </div>
                                                                            )}
                                                                            {categoryFields.length > 0 && (
                                                                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                                                                    {categoryFields.map(([key, value]) => (
                                                                                        <div key={key} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                                                                                            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                                                                                                style={{ background: getClinicalFieldColor(key).bg }}>
                                                                                                {getClinicalFieldIcon(key, getClinicalFieldColor(key).icon)}
                                                                                            </div>
                                                                                            <div className="flex-1 min-w-0">
                                                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{key}</span>
                                                                                                <span className="text-xs text-slate-700 font-medium leading-snug block mt-0.5 break-words">{value}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}

                                                        {getUncategorizedIntakeFields().length > 0 && (
                                                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleIntakeCategory('otros')}
                                                                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-slate-50 transition-colors"
                                                                >
                                                                    <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-700">
                                                                        <Info size={14} className="text-primary" /> Otros datos
                                                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                                                            {getUncategorizedIntakeFields().length}
                                                                        </span>
                                                                    </span>
                                                                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${openIntakeCategories['otros'] ? 'rotate-180' : ''}`} />
                                                                </button>
                                                                {openIntakeCategories['otros'] && (
                                                                    <div className="px-3.5 pb-3.5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                                                        {getUncategorizedIntakeFields().map(([key, value]) => (
                                                                            <div key={key} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                                                                                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                                                                                    style={{ background: getClinicalFieldColor(key).bg }}>
                                                                                    {getClinicalFieldIcon(key, getClinicalFieldColor(key).icon)}
                                                                                </div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{key}</span>
                                                                                    <span className="text-xs text-slate-700 font-medium leading-snug block mt-0.5 break-words">{value}</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {parseNotes(patient?.fullNotes || '').length > 0 && (
                                                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleIntakeCategory('textoOriginal')}
                                                                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-slate-50 transition-colors"
                                                                >
                                                                    <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-700">
                                                                        <StickyNote size={14} className="text-primary" /> Texto original de la ficha
                                                                    </span>
                                                                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${openIntakeCategories['textoOriginal'] ? 'rotate-180' : ''}`} />
                                                                </button>
                                                                {openIntakeCategories['textoOriginal'] && (
                                                                    <div className="px-3.5 pb-3.5 space-y-2">
                                                                        {parseNotes(patient?.fullNotes || '').map((section, idx) => (
                                                                            <div key={idx} className="bg-slate-50/60 p-3 rounded-lg border border-slate-100">
                                                                                <h6 className="font-bold text-slate-800 text-[11px] border-b border-slate-100 pb-1.5 mb-1.5">{section.title}</h6>
                                                                                <div className="text-slate-600 text-xs leading-relaxed whitespace-pre-line">{section.content}</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                                        {(patient?.symptomCalibrations || []).length > 0 && (
                                                            <div className="md:col-span-2 xl:col-span-3 flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                                                                {(patient?.symptomCalibrations || []).map((s, idx) => (
                                                                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-100 text-[11px] font-semibold text-slate-700">
                                                                        {s.symptom}
                                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${getFrequencyBadge(s.frequency)}`}>
                                                                            {getFrequencyShort(s.frequency)}
                                                                        </span>
                                                                        {!isSuperado(s.frequency) && (
                                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${getIntensityBadge(s.intensity)}`}>
                                                                                {s.intensity}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {Object.entries(patient?.clinicalData || {}).map(([key, value]) => (
                                                            <div key={key} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                                                                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                                                                    style={{ background: getClinicalFieldColor(key).bg }}>
                                                                    {getClinicalFieldIcon(key, getClinicalFieldColor(key).icon)}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{key}</span>
                                                                    <span className="text-xs text-slate-700 font-medium leading-snug block mt-0.5 break-words">{value}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Panel de 3 columnas */}
                                <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">

                                    {/* Columna 1: Síntomas */}
                                    <div className="flex-1 min-h-0 min-w-0 flex flex-col rounded-xl border border-slate-200 bg-slate-50/40">
                                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <Activity size={16} className="text-emerald-600" />
                                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">Síntomas</h4>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowSymptomPasteBox(prev => !prev)}
                                                    className={`flex items-center gap-1.5 text-[11px] font-bold rounded-lg border px-2.5 py-1.5 transition-colors ${showSymptomPasteBox
                                                        ? 'bg-primary text-white border-primary'
                                                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                        }`}
                                                    title="Pegar una tabla de síntomas (Excel, Word, Markdown o CSV, en cualquier formato) para autorellenarlos"
                                                >
                                                    <ClipboardPaste size={13} />
                                                    Pegar tabla
                                                </button>
                                                <label className={`flex items-center gap-1.5 text-[11px] font-bold rounded-lg border px-2.5 py-1.5 cursor-pointer transition-colors ${importingSymptoms ? 'opacity-60 pointer-events-none border-slate-200 text-slate-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`} title="Importar síntomas desde un archivo de texto (.txt, .md, .csv)">
                                                    {importingSymptoms ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                                                    Importar .txt
                                                    <input
                                                        type="file"
                                                        accept=".txt,.md,.markdown,.csv,.tsv,text/plain"
                                                        className="hidden"
                                                        onChange={handleImportVisitSymptoms}
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                        {/* Selector de escala de intensidad */}
                                        <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-200 flex items-center justify-between gap-3 text-xs">
                                            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Escala de intensidad:</span>
                                            <div className="flex bg-white rounded-lg p-0.5 gap-0.5 border border-slate-200 shadow-sm shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleIntensityScale(3)}
                                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${visitIntensityScale === 3 ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                    title="Calibrar del 1 al 3 (Suave / Moderado / Fuerte)"
                                                >
                                                    1 a 3
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleIntensityScale(10)}
                                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${visitIntensityScale === 10 ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                    title="Calibrar del 1 al 10 para mayor precisión"
                                                >
                                                    1 a 10
                                                </button>
                                            </div>
                                        </div>
                                        {showSymptomPasteBox && (
                                            <div className="px-4 pt-2 pb-1 space-y-2">
                                                <textarea
                                                    value={pasteSymptomTableText}
                                                    onChange={(e) => setPasteSymptomTableText(e.target.value)}
                                                    onPaste={(e) => {
                                                        const text = e.clipboardData.getData('text/plain');
                                                        if (!text) return;
                                                        e.preventDefault();
                                                        setPasteSymptomTableText(text);
                                                        handleApplySymptomsPaste(text);
                                                    }}
                                                    placeholder={'Pega aquí una tabla de síntomas en cualquier formato (Excel, Word, Markdown, CSV)...\nEj: Dolor de cabeza  Semanal  2'}
                                                    className="w-full min-h-[64px] bg-white border border-emerald-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none resize-y"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApplySymptomsPaste()}
                                                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors"
                                                    >
                                                        Detectar síntomas
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setShowSymptomPasteBox(false); setPasteSymptomTableText(''); }}
                                                        className="px-3 py-1.5 rounded-lg text-slate-500 text-[11px] font-bold hover:bg-slate-100 transition-colors"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {symptomImportMsg && (
                                            <p className="px-4 pt-2 text-[11px] text-slate-500">{symptomImportMsg}</p>
                                        )}
                                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                            <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={newVisitSymptomName}
                                                    onChange={(event) => setNewVisitSymptomName(event.target.value)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') {
                                                            event.preventDefault();
                                                            handleAddVisitSymptom();
                                                        }
                                                    }}
                                                    placeholder="Agregar síntoma nuevo..."
                                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/15 focus:border-primary/30 outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddVisitSymptom}
                                                    className="h-10 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
                                                >
                                                    <Plus size={14} />
                                                    Agregar
                                                </button>
                                            </div>
                                            {Object.entries(visitSymptoms).map(([symptom, data]) => (
                                                <div key={symptom} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm space-y-2">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <span className="font-medium text-slate-700 text-sm flex-1 leading-snug">{symptom}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setVisitSymptoms(prev => {
                                                                const next = { ...prev };
                                                                delete next[symptom];
                                                                return next;
                                                            })}
                                                            className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0"
                                                            title="Quitar síntoma"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                                                            {['D', 'S', 'M'].map((freq) => {
                                                                const map = { 'D': 'Diaria', 'S': 'Semanal', 'M': 'Mensual' };
                                                                const fullFreq = map[freq as keyof typeof map];
                                                                const isSelected = data.frequency === fullFreq;
                                                                return (
                                                                    <button
                                                                        key={freq}
                                                                        onClick={() => setVisitSymptoms(prev => ({
                                                                            ...prev,
                                                                            [symptom]: { ...prev[symptom], frequency: fullFreq }
                                                                        }))}
                                                                        className={`w-8 h-8 rounded-md text-xs font-bold transition-all ${isSelected
                                                                            ? 'bg-white shadow-sm text-slate-800 ring-1 ring-black/5'
                                                                            : 'text-slate-400 hover:text-slate-600'
                                                                            }`}
                                                                    >
                                                                        {freq}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className={`flex bg-slate-100 rounded-lg p-1 gap-1 flex-wrap max-w-full ${isSuperado(data.frequency) ? 'opacity-40 pointer-events-none' : ''}`}>
                                                            {(visitIntensityScale === 10 ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1, 2, 3]).map((num) => {
                                                                const isSelected = data.intensity === num;
                                                                let bgClass = 'text-slate-400 hover:text-slate-600';
                                                                if (isSelected) {
                                                                    if (visitIntensityScale === 10) {
                                                                        if (num <= 3) bgClass = 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300';
                                                                        else if (num <= 7) bgClass = 'bg-amber-100 text-amber-700 ring-1 ring-amber-300';
                                                                        else bgClass = 'bg-red-100 text-red-700 ring-1 ring-red-300';
                                                                    } else {
                                                                        bgClass = num === 1 ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' :
                                                                                  num === 2 ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' :
                                                                                  'bg-red-100 text-red-700 ring-1 ring-red-300';
                                                                    }
                                                                }
                                                                const btnSize = visitIntensityScale === 10 ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
                                                                return (
                                                                    <button
                                                                        key={num}
                                                                        onClick={() => setVisitSymptoms(prev => ({
                                                                            ...prev,
                                                                            [symptom]: { ...prev[symptom], intensity: num }
                                                                        }))}
                                                                        className={`${btnSize} rounded-md font-bold transition-all ${bgClass}`}
                                                                        title={`${num} (${getIntensityLabelText(num, visitIntensityScale)})`}
                                                                    >
                                                                        {num}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setVisitSymptoms(prev => ({
                                                                ...prev,
                                                                [symptom]: isSuperado(prev[symptom]?.frequency)
                                                                    ? { ...prev[symptom], frequency: 'Diaria' }
                                                                    : { ...prev[symptom], frequency: 'Superado' }
                                                            }))}
                                                            className={`h-8 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${isSuperado(data.frequency)
                                                                ? 'bg-emerald-500 text-white shadow-sm'
                                                                : 'bg-slate-100 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                                                }`}
                                                            title="Marcar como síntoma superado"
                                                        >
                                                            <Check size={14} />
                                                            Superado
                                                        </button>
                                                    </div>
                                                    <SpeechTextarea
                                                        value={data.note || ''}
                                                        onValueChange={(note) => setVisitSymptoms(prev => ({
                                                            ...prev,
                                                            [symptom]: { ...prev[symptom], note }
                                                        }))}
                                                        rows={2}
                                                        placeholder="Nota de este síntoma: contexto, evolución, desencadenantes..."
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs resize-none focus:ring-2 focus:ring-primary/15 focus:border-primary/30 outline-none"
                                                    />
                                                </div>
                                            ))}
                                            {Object.keys(visitSymptoms).length === 0 && (
                                                <p className="text-xs text-slate-400 text-center py-6">Aún no hay síntomas. Agrega uno arriba.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Columna 2: Notas de la consulta */}
                                    <div className="flex-1 min-h-0 min-w-0 flex flex-col rounded-xl border border-slate-200 bg-slate-50/40">
                                        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                                            <FileText size={16} className="text-sky-600" />
                                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">Notas de la consulta</h4>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Nota general</label>
                                                <SpeechTextarea
                                                    value={visitNote}
                                                    onValueChange={setVisitNote}
                                                    placeholder="Resumen corto de la visita..."
                                                    rows={3}
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase">Diagnóstico de esta visita</label>
                                                    {diagnosis && diagnosis.trim() && !diagnosis.startsWith('Error') && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setVisitDiagnosis(diagnosis)}
                                                            className="flex items-center gap-1 text-[11px] font-bold text-violet-700 border border-violet-200 bg-violet-50 hover:bg-violet-100 rounded-lg px-2 py-1 transition-colors"
                                                            title="Copiar el diagnóstico generado por la IA a este campo"
                                                        >
                                                            <Sparkles size={12} />
                                                            Usar diagnóstico de IA
                                                        </button>
                                                    )}
                                                </div>
                                                <SpeechTextarea
                                                    value={visitDiagnosis}
                                                    onValueChange={setVisitDiagnosis}
                                                    rows={6}
                                                    placeholder="Diagnóstico clínico o ayurvédico observado en esta visita..."
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Estilo de vida</label>
                                                <SpeechTextarea
                                                    value={visitLifestyle}
                                                    onValueChange={setVisitLifestyle}
                                                    rows={5}
                                                    placeholder="Rutina diaria, sueño, ejercicio, pranayama, hábitos graduales..."
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase">Observaciones de la lengua</label>
                                                    <label className={`flex items-center gap-1.5 text-[11px] font-bold rounded-lg border px-2.5 py-1.5 cursor-pointer transition-colors ${uploadingTonguePhoto ? 'opacity-60 pointer-events-none border-slate-200 text-slate-400' : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'}`} title="Subir foto de la lengua">
                                                        {uploadingTonguePhoto ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                                                        Subir foto
                                                        <input
                                                            type="file"
                                                            accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
                                                            className="hidden"
                                                            onChange={handleVisitTonguePhotoUpload}
                                                        />
                                                    </label>
                                                </div>
                                                <SpeechTextarea
                                                    value={visitTongue}
                                                    onValueChange={setVisitTongue}
                                                    rows={4}
                                                    placeholder="Color, saburra, marcas, grietas, humedad, zonas afectadas..."
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-y focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
                                                />
                                                {tonguePhotoError && (
                                                    <p className="text-[11px] text-red-600">{tonguePhotoError}</p>
                                                )}
                                                {visitTonguePhotos.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                        {visitTonguePhotos.map(photo => (
                                                            <button
                                                                key={photo.id}
                                                                type="button"
                                                                onClick={() => setActiveTonguePhoto(photo)}
                                                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-sky-300 transition-all"
                                                                title="Ver foto"
                                                            >
                                                                <img src={photo.url} alt="Lengua" className="w-full h-full object-cover" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Columna 3: Tratamientos elegidos */}
                                    <div className="flex-1 min-h-0 min-w-0 flex flex-col rounded-xl border border-emerald-200 bg-emerald-50/30">
                                        <div className="px-4 py-3 border-b border-emerald-100 flex items-center gap-2">
                                            <ShieldCheck size={16} className="text-emerald-600" />
                                            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800">Tratamientos elegidos</h4>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Tratamiento indicado</label>
                                                <SpeechTextarea
                                                    value={visitTreatment}
                                                    onValueChange={setVisitTreatment}
                                                    rows={5}
                                                    placeholder="Tratamiento, hierbas, alimentación o indicaciones principales..."
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
                                                />
                                            </div>

                                            {/* Selector de categorías de alimentación */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Categorías de alimentación</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {FOOD_CATEGORIES.map((cat) => {
                                                        const isSelected = visitTrackedCategories.includes(cat);
                                                        return (
                                                            <button
                                                                key={cat}
                                                                type="button"
                                                                onClick={() => toggleVisitCategory(cat)}
                                                                className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                                                                    isSelected
                                                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                                                        : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                                                                }`}
                                                            >
                                                                {cat}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <p className="text-[11px] text-slate-400">Estas categorías se cargan en el editor y aparecen en el PDF.</p>
                                            </div>

                                            {/* Selector de fórmulas herbales */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Fórmulas herbales</label>
                                                {mostUsedFormulas.length > 0 && (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Más usadas</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {mostUsedFormulas.map((name) => {
                                                                const alreadyAdded = visitTrackedHerbs.some(h => (h.formula || '').trim().toLowerCase() === name.toLowerCase());
                                                                const dbUsage = lookupHerbUsage(name);
                                                                return (
                                                                    <button
                                                                        key={name}
                                                                        type="button"
                                                                        onClick={() => handleQuickAddFormula(name)}
                                                                        disabled={alreadyAdded}
                                                                        title={dbUsage ? `Dosis: ${dbUsage}` : 'Agregar fórmula'}
                                                                        className={`px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${
                                                                            alreadyAdded
                                                                                ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-default'
                                                                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                                        }`}
                                                                    >
                                                                        {name}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                <datalist id="visit-herb-suggestions">
                                                    {HERB_SUGGESTIONS.map((name) => (
                                                        <option key={name} value={name} />
                                                    ))}
                                                </datalist>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <input
                                                        type="text"
                                                        list="visit-herb-suggestions"
                                                        value={newVisitHerbName}
                                                        onChange={(e) => handleVisitHerbNameChange(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddVisitHerb();
                                                            }
                                                        }}
                                                        placeholder="Fórmula o hierba..."
                                                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/15 focus:border-primary/30 outline-none"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={newVisitHerbDosage}
                                                        onChange={(e) => setNewVisitHerbDosage(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddVisitHerb();
                                                            }
                                                        }}
                                                        placeholder="Dosis (ej. 1 cáps. 2x día)"
                                                        className="sm:w-44 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/15 focus:border-primary/30 outline-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleAddVisitHerb}
                                                        className="h-10 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shrink-0"
                                                    >
                                                        <Plus size={14} />
                                                        Agregar
                                                    </button>
                                                </div>
                                                {visitTrackedHerbs.length > 0 && (
                                                    <div className="space-y-1.5">
                                                        {visitTrackedHerbs.map((herb) => (
                                                            <div key={herb.formula} className="flex items-center gap-2 bg-white rounded-lg border border-slate-100 px-3 py-2">
                                                                <span className="flex-1 text-sm font-medium text-slate-700">{herb.formula}</span>
                                                                {herb.dosage && <span className="text-xs text-slate-400">{herb.dosage}</span>}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeVisitHerb(herb.formula)}
                                                                    className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0"
                                                                    title="Quitar fórmula"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleSaveVisit({ openPdf: true })}
                                                disabled={savingVisit}
                                                className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl shadow-emerald-900/15 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                            >
                                                {savingVisit ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                                                {editCaseMode ? 'Guardar caso y generar PDF' : 'Crear tratamiento de seguimiento'}
                                            </button>
                                            <p className="text-[11px] text-slate-500 -mt-1">
                                                {editCaseMode
                                                    ? 'Guarda los cambios del caso (ficha y consulta inicial) y abre el editor del PDF.'
                                                    : 'Guarda esta visita y abre el editor para elegir categorías de alimentos, fórmulas herbales y generar el PDF de seguimiento.'}
                                            </p>

                                {(() => {
                                    // La adherencia revisa lo del tratamiento ANTERIOR (sembrado en visitAdherence),
                                    // no las categorías/fórmulas nuevas que se eligen para esta visita.
                                    const categoryItems = visitAdherence.categories || [];
                                    const herbItems = visitAdherence.herbs || [];
                                    const hasItems = categoryItems.length > 0 || herbItems.length > 0;

                                    if (!hasItems) return null;

                                    const renderVisitAdherenceItems = (section: 'categories' | 'herbs', items: TreatmentAdherenceItem[]) => (
                                        <div className="space-y-2">
                                            {items.map(item => (
                                                <div key={`new-visit-${section}-${item.name}`} className="rounded-lg border border-slate-100 bg-white p-3">
                                                    <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                                                        <span className="flex-1 text-sm font-bold text-slate-700">{item.name}</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {[
                                                                { value: 'done', label: 'Hecho' },
                                                                { value: 'partial', label: 'Parcial' },
                                                                { value: 'not_done', label: 'No hecho' },
                                                                { value: 'unknown', label: 'Sin revisar' }
                                                            ].map(option => (
                                                                <button
                                                                    key={option.value}
                                                                    type="button"
                                                                    onClick={() => patchNewVisitAdherence(section, item.name, { status: option.value as TreatmentAdherenceItem['status'] })}
                                                                    className={`px-2 py-1 rounded-md border text-[10px] font-bold transition-colors ${
                                                                        item.status === option.value
                                                                            ? getAdherenceClass(item.status)
                                                                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                                                                    }`}
                                                                >
                                                                    {option.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={item.note || ''}
                                                        onChange={(event) => patchNewVisitAdherence(section, item.name, { note: event.target.value })}
                                                        placeholder="Nota breve: qué hizo, qué no hizo, reacción, tolerancia..."
                                                        className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    );

                                    return (
                                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div>
                                                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800">Qué hizo realmente el paciente</h4>
                                                    <p className="text-[11px] text-slate-500 mt-1">Marca la adherencia antes de guardar esta visita. Esto actualizará la ficha y el historial.</p>
                                                </div>
                                                <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                                            </div>
                                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                                {categoryItems.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Categorías</p>
                                                        {renderVisitAdherenceItems('categories', categoryItems)}
                                                    </div>
                                                )}
                                                {herbItems.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Fórmulas herbales</p>
                                                        {renderVisitAdherenceItems('herbs', herbItems)}
                                                    </div>
                                                )}
                                            </div>
                                            <label className="block mt-3 space-y-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nota general de adherencia</span>
                                                <SpeechTextarea
                                                    value={visitAdherence.generalNote || ''}
                                                    onValueChange={(generalNote) => setVisitAdherence(prev => ({
                                                        ...prev,
                                                        generalNote,
                                                        updatedAt: new Date().toISOString()
                                                    }))}
                                                    rows={3}
                                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs resize-none outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                                                    placeholder="Resumen para la siguiente consulta..."
                                                />
                                            </label>
                                        </div>
                                    );
                                })()}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-3 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                                <button
                                    onClick={() => { setIsAddingVisit(false); setEditingVisitId(null); setEditCaseMode(false); }}
                                    className="px-5 py-2.5 rounded-xl font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleSaveVisit({ openPdf: true })}
                                    disabled={savingVisit}
                                    className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl shadow-emerald-900/15 hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-70"
                                >
                                    {savingVisit ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                                    Guardar y generar PDF actualizado
                                </button>
                                <button
                                    onClick={() => handleSaveVisit()}
                                    disabled={savingVisit}
                                    className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl shadow-primary/20 hover:bg-primary-600 transition-all flex items-center gap-2 disabled:opacity-70"
                                >
                                    {savingVisit ? <Loader2 size={16} className="animate-spin" /> : (editingVisitId ? <Save size={16} /> : <Plus size={16} />)}
                                    {editCaseMode ? 'Guardar Caso' : (editingVisitId ? 'Guardar Cambios' : 'Guardar Visita')}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Seguimiento Terapéutico (vista aparte): resumen acumulado de todas las visitas */}
            <AnimatePresence>
                {showTrackingView && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]"
                            onClick={() => setShowTrackingView(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed inset-0 m-auto w-full max-w-4xl h-[92vh] bg-white rounded-2xl shadow-2xl z-[90] flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <ClipboardCheck className="text-emerald-600 shrink-0" size={20} />
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-xl text-slate-800 truncate">Seguimiento Terapéutico</h3>
                                        <p className="text-[11px] text-slate-400 truncate">
                                            {patient?.name || 'Paciente'} · alimentos, fórmulas, terapias y hábitos acumulados de todas las visitas.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">{therapeuticSummary.records.length} archivos</span>
                                    <span className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold">{therapeuticSummary.reviewedCount} revisados</span>
                                    <button
                                        onClick={() => setShowTrackingView(false)}
                                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(() => {
                                        const adherenceStatusOptions: Array<{ value: NonNullable<TreatmentAdherenceItem['status']>; label: string }> = [
                                            { value: 'done', label: 'Hecho' },
                                            { value: 'partial', label: 'Parcial' },
                                            { value: 'not_done', label: 'No hecho' },
                                            { value: 'unknown', label: 'Sin revisar' }
                                        ];
                                        const renderTrackableItem = (
                                            section: 'categories' | 'herbs' | 'healthyHabits',
                                            item: typeof therapeuticSummary.categories[number]
                                        ) => (
                                            <div key={item.name} className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                                                    <span className="flex-1 text-[11px] font-bold text-slate-700 truncate">
                                                        {item.name} <span className="text-slate-400 font-normal">· {item.count}</span>
                                                    </span>
                                                    <div className="flex flex-wrap gap-1 shrink-0">
                                                        {adherenceStatusOptions.map(option => (
                                                            <button
                                                                key={option.value}
                                                                type="button"
                                                                onClick={() => patchTherapeuticSummaryAdherence(section, item, { status: option.value })}
                                                                className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold transition-colors ${
                                                                    item.lastStatus === option.value
                                                                        ? getAdherenceClass(item.lastStatus)
                                                                        : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                                                                }`}
                                                            >
                                                                {option.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                {item.occurrences.length > 0 && (
                                                    <p
                                                        className="mt-1 text-[10px] text-slate-400 truncate"
                                                        title={item.occurrences.map(occ => `${occ.title}${occ.date ? ` (${formatNoteDate(occ.date)})` : ''}`).join(' · ')}
                                                    >
                                                        Visitas: {item.occurrences.map(occ => `${occ.title}${occ.date ? ` (${formatNoteDate(occ.date)})` : ''}`).join(' · ')}
                                                    </p>
                                                )}
                                                {item.notes[0] && (
                                                    <p className="mt-0.5 text-[10px] text-slate-400 italic truncate" title={item.notes[0]}>
                                                        “{item.notes[0]}”
                                                    </p>
                                                )}
                                            </div>
                                        );
                                        return (
                                            <>
                                                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2.5">Categorías usadas</p>
                                                    {therapeuticSummary.categories.length > 0 ? (
                                                        <div className="space-y-1.5">
                                                            {therapeuticSummary.categories.map(item => renderTrackableItem('categories', item))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">Todavía no hay categorías registradas.</span>
                                                    )}
                                                </div>
                                                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2.5">Fórmulas usadas</p>
                                                    {therapeuticSummary.herbs.length > 0 ? (
                                                        <div className="space-y-1.5">
                                                            {therapeuticSummary.herbs.map(item => renderTrackableItem('herbs', item))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">Todavía no hay fórmulas registradas.</span>
                                                    )}
                                                </div>
                                                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2.5">Terapias indicadas</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {therapeuticSummary.therapies.length > 0 ? therapeuticSummary.therapies.map(item => (
                                                            <span key={item.name} className="px-2 py-1 rounded-lg border text-[11px] font-bold bg-sky-50 text-sky-700 border-sky-200" title={item.occurrences.map(occ => `${occ.title}${occ.date ? ` (${formatNoteDate(occ.date)})` : ''}`).join(' · ')}>
                                                                {item.name} · {item.count}
                                                            </span>
                                                        )) : (
                                                            <span className="text-xs text-slate-400">Todavía no hay terapias registradas.</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2.5">Hábitos/guías</p>
                                                    {therapeuticSummary.healthyHabits.length > 0 ? (
                                                        <div className="space-y-1.5">
                                                            {therapeuticSummary.healthyHabits.map(item => renderTrackableItem('healthyHabits', item))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">Todavía no hay hábitos registrados.</span>
                                                    )}
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>

                                <div className="rounded-xl border border-slate-100 bg-white p-4">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2.5">Archivos registrados</p>
                                    {therapeuticSummary.records.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {therapeuticSummary.records.map(({ type, record }) => (
                                                <div key={`${type}-${record.id || getRecordDateValue(record)}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50/60 border border-slate-100 text-xs">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FolderOpen size={13} className={type === 'plan' ? 'text-emerald-600 shrink-0' : 'text-sky-600 shrink-0'} />
                                                        <span className="font-bold text-slate-700 truncate">{record.title || (type === 'plan' ? 'Tratamiento' : 'Visita')}</span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${type === 'plan' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>
                                                            {type === 'plan' ? 'Tratamiento' : 'Visita'}
                                                        </span>
                                                    </div>
                                                    <span className="text-slate-400 shrink-0">{formatNoteDate(getRecordDateValue(record))}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400">Todavía no hay archivos guardados. Se registran al guardar PDFs de tratamiento o visitas.</p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Edit Case Modal */}
            <AnimatePresence>
                {isEditingCase && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]"
                            onClick={() => setIsEditingCase(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed inset-0 m-auto w-full max-w-3xl h-[92vh] bg-white rounded-2xl shadow-2xl z-[90] flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Sparkles className="text-primary shrink-0" size={20} />
                                    <h3 className="font-bold text-xl text-slate-800 truncate">Editar Caso y Calibración</h3>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {hasAnyIntakeData && (
                                        <button
                                            type="button"
                                            onClick={() => setShowIntakeSummary(prev => !prev)}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${showIntakeSummary
                                                ? 'bg-primary text-white border-primary shadow-sm'
                                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                }`}
                                            title="Ver la ficha que llenó el paciente: síntomas, enfermedades, estilo de vida y más"
                                        >
                                            <FileText size={14} />
                                            {showIntakeSummary ? 'Ocultar ficha del paciente' : 'Ver ficha del paciente'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIsEditingCase(false)}
                                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                {caseError && (
                                    <div className="bg-red-50 text-red-700 p-4 rounded-xl text-xs border border-red-200 flex items-center gap-2">
                                        <AlertCircle size={16} className="text-red-500 shrink-0" />
                                        <span>{caseError}</span>
                                    </div>
                                )}

                                {/* Ficha del paciente: lo que llenó él/ella, categorizado y en vista toggle */}
                                <AnimatePresence initial={false}>
                                    {showIntakeSummary && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-4 space-y-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <FileText size={16} className="text-primary" />
                                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Ficha que llenó el paciente</h4>
                                                    </div>
                                                    <div className="flex bg-white rounded-lg p-1 gap-1 border border-slate-200">
                                                        <button
                                                            type="button"
                                                            onClick={() => setIntakeViewMode('categorized')}
                                                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors ${intakeViewMode === 'categorized' ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-700'
                                                                }`}
                                                            title="Ver por categorías (acordeón)"
                                                        >
                                                            <LayoutGrid size={12} /> Categorías
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setIntakeViewMode('list')}
                                                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors ${intakeViewMode === 'list' ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-700'
                                                                }`}
                                                            title="Ver todo en una lista"
                                                        >
                                                            <List size={12} /> Lista completa
                                                        </button>
                                                    </div>
                                                </div>

                                                {intakeViewMode === 'categorized' ? (
                                                    <div className="space-y-2">
                                                        {INTAKE_CATEGORIES.map((category) => {
                                                            const categoryFields = (patient?.clinicalData
                                                                ? category.fields
                                                                    .filter(key => patient.clinicalData![key] && patient.clinicalData![key].trim())
                                                                    .map(key => [key, patient.clinicalData![key]] as [string, string])
                                                                : []);
                                                            const showSymptomBadges = category.key === 'sintomas' && (
                                                                (patient?.symptomCalibrations?.length || 0) > 0 || (patient?.plainSymptoms?.length || 0) > 0
                                                            );
                                                            if (categoryFields.length === 0 && !showSymptomBadges) return null;
                                                            const isOpen = !!openIntakeCategories[category.key];
                                                            return (
                                                                <div key={category.key} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleIntakeCategory(category.key)}
                                                                        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-slate-50 transition-colors"
                                                                    >
                                                                        <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-700">
                                                                            <span className="text-primary">{getIntakeCategoryIcon(category.key)}</span>
                                                                            {category.title}
                                                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                                                                {categoryFields.length + (showSymptomBadges ? (patient?.symptomCalibrations?.length || patient?.plainSymptoms?.length || 0) : 0)}
                                                                            </span>
                                                                        </span>
                                                                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                                                    </button>
                                                                    {isOpen && (
                                                                        <div className="px-3.5 pb-3.5 space-y-3">
                                                                            {showSymptomBadges && (
                                                                                <div className="flex flex-wrap gap-1.5">
                                                                                    {(patient?.symptomCalibrations || []).map((s, idx) => (
                                                                                        <span key={`cal-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-semibold text-slate-700">
                                                                                            {s.symptom}
                                                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${getFrequencyBadge(s.frequency)}`}>
                                                                                                {getFrequencyShort(s.frequency)}
                                                                                            </span>
                                                                                            {!isSuperado(s.frequency) && (
                                                                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${getIntensityBadge(s.intensity)}`}>
                                                                                                    {s.intensity}
                                                                                                </span>
                                                                                            )}
                                                                                        </span>
                                                                                    ))}
                                                                                    {(patient?.plainSymptoms || [])
                                                                                        .filter(sym => !(patient?.symptomCalibrations || []).some(s => s.symptom === sym))
                                                                                        .map((sym, idx) => (
                                                                                            <span key={`plain-${idx}`} className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-semibold text-slate-700">
                                                                                                {sym}
                                                                                            </span>
                                                                                        ))}
                                                                                </div>
                                                                            )}
                                                                            {categoryFields.length > 0 && (
                                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                                    {categoryFields.map(([key, value]) => (
                                                                                        <div key={key} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                                                                                            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                                                                                                style={{ background: getClinicalFieldColor(key).bg }}>
                                                                                                {getClinicalFieldIcon(key, getClinicalFieldColor(key).icon)}
                                                                                            </div>
                                                                                            <div className="flex-1 min-w-0">
                                                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{key}</span>
                                                                                                <span className="text-xs text-slate-700 font-medium leading-snug block mt-0.5 break-words">{value}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}

                                                        {getUncategorizedIntakeFields().length > 0 && (
                                                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleIntakeCategory('otros')}
                                                                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-slate-50 transition-colors"
                                                                >
                                                                    <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-700">
                                                                        <Info size={14} className="text-primary" /> Otros datos
                                                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                                                            {getUncategorizedIntakeFields().length}
                                                                        </span>
                                                                    </span>
                                                                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${openIntakeCategories['otros'] ? 'rotate-180' : ''}`} />
                                                                </button>
                                                                {openIntakeCategories['otros'] && (
                                                                    <div className="px-3.5 pb-3.5 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                        {getUncategorizedIntakeFields().map(([key, value]) => (
                                                                            <div key={key} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                                                                                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                                                                                    style={{ background: getClinicalFieldColor(key).bg }}>
                                                                                    {getClinicalFieldIcon(key, getClinicalFieldColor(key).icon)}
                                                                                </div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{key}</span>
                                                                                    <span className="text-xs text-slate-700 font-medium leading-snug block mt-0.5 break-words">{value}</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {parseNotes(patient?.fullNotes || '').length > 0 && (
                                                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleIntakeCategory('textoOriginal')}
                                                                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-slate-50 transition-colors"
                                                                >
                                                                    <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-700">
                                                                        <StickyNote size={14} className="text-primary" /> Texto original de la ficha
                                                                    </span>
                                                                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${openIntakeCategories['textoOriginal'] ? 'rotate-180' : ''}`} />
                                                                </button>
                                                                {openIntakeCategories['textoOriginal'] && (
                                                                    <div className="px-3.5 pb-3.5 space-y-2">
                                                                        {parseNotes(patient?.fullNotes || '').map((section, idx) => (
                                                                            <div key={idx} className="bg-slate-50/60 p-3 rounded-lg border border-slate-100">
                                                                                <h6 className="font-bold text-slate-800 text-[11px] border-b border-slate-100 pb-1.5 mb-1.5">{section.title}</h6>
                                                                                <div className="text-slate-600 text-xs leading-relaxed whitespace-pre-line">{section.content}</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        {(patient?.symptomCalibrations || []).length > 0 && (
                                                            <div className="md:col-span-2 flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                                                                {(patient?.symptomCalibrations || []).map((s, idx) => (
                                                                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-100 text-[11px] font-semibold text-slate-700">
                                                                        {s.symptom}
                                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${getFrequencyBadge(s.frequency)}`}>
                                                                            {getFrequencyShort(s.frequency)}
                                                                        </span>
                                                                        {!isSuperado(s.frequency) && (
                                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${getIntensityBadge(s.intensity)}`}>
                                                                                {s.intensity}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {Object.entries(patient?.clinicalData || {}).map(([key, value]) => (
                                                            <div key={key} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                                                                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                                                                    style={{ background: getClinicalFieldColor(key).bg }}>
                                                                    {getClinicalFieldIcon(key, getClinicalFieldColor(key).icon)}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{key}</span>
                                                                    <span className="text-xs text-slate-700 font-medium leading-snug block mt-0.5 break-words">{value}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Basic Fields */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Nombre Completo</label>
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Dosha</label>
                                        <select
                                            value={editDosha}
                                            onChange={(e) => setEditDosha(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
                                        >
                                            <option value="">No determinado</option>
                                            <option value="Vata">Vata</option>
                                            <option value="Pitta">Pitta</option>
                                            <option value="Kapha">Kapha</option>
                                            <option value="Vata-Pitta">Vata-Pitta</option>
                                            <option value="Pitta-Kapha">Pitta-Kapha</option>
                                            <option value="Vata-Kapha">Vata-Kapha</option>
                                            <option value="Tridoshica">Tridoshica</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Edad</label>
                                        <input
                                            type="text"
                                            value={editAge}
                                            onChange={(e) => setEditAge(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Celular / Teléfono</label>
                                        <input
                                            type="text"
                                            value={editPhone}
                                            onChange={(e) => setEditPhone(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Correo Electrónico</label>
                                        <input
                                            type="email"
                                            value={editEmail}
                                            onChange={(e) => setEditEmail(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Plain Symptoms Editor */}
                                <div className="space-y-3 pt-2 border-t border-slate-100">
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Síntomas Principales (Tags)</label>
                                    
                                    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[50px] items-center">
                                        {editPlainSymptoms.length === 0 ? (
                                            <span className="text-xs text-slate-400">Sin síntomas principales añadidos.</span>
                                        ) : (
                                            editPlainSymptoms.map((s, idx) => (
                                                <Badge
                                                    key={idx}
                                                    variant="neutral"
                                                    className="pl-2.5 pr-1 py-1 text-xs font-semibold flex items-center gap-1.5 bg-white border border-slate-200 animate-fadeIn"
                                                >
                                                    <span>{s}</span>
                                                    <button
                                                        onClick={() => setEditPlainSymptoms(prev => prev.filter((_, i) => i !== idx))}
                                                        className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                </Badge>
                                            ))
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newEditSymptomName}
                                            onChange={(e) => setNewEditSymptomName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (newEditSymptomName.trim()) {
                                                        setEditPlainSymptoms(prev => [...prev, newEditSymptomName.trim()]);
                                                        setNewEditSymptomName('');
                                                    }
                                                }
                                            }}
                                            placeholder="Añadir nuevo síntoma..."
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (newEditSymptomName.trim()) {
                                                    setEditPlainSymptoms(prev => [...prev, newEditSymptomName.trim()]);
                                                    setNewEditSymptomName('');
                                                }
                                            }}
                                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
                                        >
                                            Añadir
                                        </button>
                                    </div>
                                </div>

                                {/* Symptom Calibrations Editor */}
                                <div className="space-y-3 pt-2 border-t border-slate-100">
                                    <div className="flex items-center justify-between gap-3">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Calibración de Síntomas (Frecuencia e Intensidad)</label>
                                        <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5 border border-slate-200 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleEditIntensityScale(3)}
                                                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${editIntensityScale === 3 ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                1 a 3
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleEditIntensityScale(10)}
                                                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${editIntensityScale === 10 ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                1 a 10
                                            </button>
                                        </div>
                                    </div>

                                    {editSymptomCalibrations.length === 0 ? (
                                        <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                                            No hay calibración de síntomas configurada.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {editSymptomCalibrations.map((cal, idx) => (
                                                <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                                                    <span className="font-bold text-sm text-slate-700 flex-1">{cal.symptom}</span>
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase">Frecuencia</span>
                                                            <select
                                                                value={cal.frequency}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setEditSymptomCalibrations(prev => prev.map((item, i) => i === idx ? { ...item, frequency: val } : item));
                                                                }}
                                                                className="bg-white border border-slate-200 rounded-lg text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                                                            >
                                                                <option value="Diaria">Diaria</option>
                                                                <option value="Semanal">Semanal</option>
                                                                <option value="Mensual">Mensual</option>
                                                                <option value="Superado">Superado ✓</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase">Intensidad</span>
                                                            <select
                                                                value={cal.intensity}
                                                                onChange={(e) => {
                                                                    const val = parseInt(e.target.value);
                                                                    const label = getIntensityLabelText(val, editIntensityScale);
                                                                    setEditSymptomCalibrations(prev => prev.map((item, i) => i === idx ? { ...item, intensity: val, intensityLabel: label } : item));
                                                                }}
                                                                className="bg-white border border-slate-200 rounded-lg text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                                                            >
                                                                {Array.from({ length: editIntensityScale }, (_, i) => i + 1).map((num) => (
                                                                    <option key={num} value={num}>
                                                                        {num} ({getIntensityLabelText(num, editIntensityScale)})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditSymptomCalibrations(prev => prev.filter((_, i) => i !== idx))}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add symptom calibration helper */}
                                    <div className="flex gap-2 pt-1">
                                        <select
                                            id="addCalibrationSelect"
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                                            defaultValue=""
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val) {
                                                    if (!editSymptomCalibrations.find(sc => sc.symptom === val)) {
                                                        setEditSymptomCalibrations(prev => [...prev, {
                                                            symptom: val,
                                                            frequency: 'Semanal',
                                                            intensity: 2,
                                                            intensityLabel: 'Moderado'
                                                        }]);
                                                    }
                                                    e.target.value = "";
                                                }
                                            }}
                                        >
                                            <option value="" disabled>Selecciona un síntoma para calibrarlo...</option>
                                            {/* List plain symptoms and typical symptoms not already calibrated */}
                                            {Array.from(new Set([
                                                ...editPlainSymptoms,
                                                "Ansiedad", "Insomnio", "Estreñimiento", "Gases", "Indigestión", "Dolor articular",
                                                "Fatiga", "Inflamación", "Alergias", "Migraña", "Dolor de cabeza", "Acidez",
                                                "Retención de líquidos", "Congestión nasal", "Sobrepeso", "Falta de apetito"
                                            ])).filter(symptomName => !editSymptomCalibrations.find(sc => sc.symptom === symptomName)).map((symptomName) => (
                                                <option key={symptomName} value={symptomName}>{symptomName}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="u otro síntoma personalizado..."
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const target = e.target as HTMLInputElement;
                                                    const val = target.value.trim();
                                                    if (val) {
                                                        if (!editSymptomCalibrations.find(sc => sc.symptom === val)) {
                                                            setEditSymptomCalibrations(prev => [...prev, {
                                                                symptom: val,
                                                                frequency: 'Semanal',
                                                                intensity: 2,
                                                                intensityLabel: 'Moderado'
                                                            }]);
                                                        }
                                                        target.value = "";
                                                    }
                                                }
                                            }}
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                                <button
                                    onClick={() => setIsEditingCase(false)}
                                    type="button"
                                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 text-sm font-bold transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveCase}
                                    disabled={savingCase}
                                    type="button"
                                    className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl shadow-primary/20 hover:bg-primary-600 transition-all flex items-center gap-2 disabled:opacity-70"
                                >
                                    {savingCase ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Guardar Cambios
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Local editable record workspace */}
            <AnimatePresence>
                {openRecord && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm z-[95]"
                            onClick={() => setOpenRecord(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98, x: recordEditorMode === 'half' ? 40 : 0 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.98, x: recordEditorMode === 'half' ? 40 : 0 }}
                            className={`fixed z-[100] bg-white shadow-2xl border border-slate-100 flex flex-col overflow-hidden ${
                                recordEditorMode === 'full'
                                    ? 'inset-4 rounded-2xl'
                                    : 'top-0 right-0 bottom-0 w-full max-w-3xl rounded-l-2xl'
                            }`}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/80">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                        <FolderOpen size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-slate-900 truncate">
                                            {getRecordTitle(openRecord.record, openRecord.type)}
                                        </h3>
                                        <p className="text-xs text-slate-400 truncate">
                                            Carpeta local · {patient?.name || 'Paciente'} · {openRecord.record.id}
                                        </p>
                                    </div>
                                    <AutosaveIndicator status={openRecordAutosaveStatus} errorMessage={recordSaveError} className="shrink-0" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setRecordEditorMode(recordEditorMode === 'full' ? 'half' : 'full')}
                                        className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center"
                                        title={recordEditorMode === 'full' ? 'Ver en media pantalla' : 'Ver en pantalla completa'}
                                    >
                                        {recordEditorMode === 'full' ? <Columns2 size={18} /> : <Maximize2 size={18} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleOpenPdfFromRecord}
                                        disabled={!openRecord.record.diagnosis?.trim()}
                                        className="h-10 px-4 rounded-xl bg-amber-500 text-slate-950 text-sm font-bold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <Printer size={16} />
                                        Generar PDF
                                    </button>
                                    {openRecord.record.pdfFile && (
                                        <button
                                            type="button"
                                            onClick={() => downloadSavedPdf(openRecord.record.id!, openRecord.record.title || 'Consulta')}
                                            className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 flex items-center gap-2"
                                        >
                                            <FileText size={16} />
                                            Descargar PDF
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setOpenRecord(null)}
                                        className="w-10 h-10 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                <label className="space-y-2 block mb-5">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre del archivo editable</span>
                                    <input
                                        type="text"
                                        value={openRecord.record.title || getRecordTitle(openRecord.record, openRecord.type)}
                                        onChange={(event) => {
                                            if (openRecord.type === 'plan') {
                                                patchPatientPlan(openRecord.record.id || '', { title: event.target.value });
                                            } else {
                                                patchPatientVisit(openRecord.record.id || '', { title: event.target.value });
                                            }
                                        }}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base font-semibold focus:ring-2 focus:ring-primary/15 focus:border-primary/30 outline-none"
                                    />
                                </label>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                                    <label className="space-y-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</span>
                                        <input
                                            type="date"
                                            value={(openRecord.type === 'plan' ? openRecord.record.visitDate : openRecord.record.date)?.slice(0, 10) || ''}
                                            onChange={(event) => {
                                                if (openRecord.type === 'plan') {
                                                    patchPatientPlan(openRecord.record.id || '', { visitDate: event.target.value });
                                                } else {
                                                    patchPatientVisit(openRecord.record.id || '', { date: event.target.value });
                                                }
                                            }}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/15 focus:border-primary/30 outline-none"
                                        />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dosha</span>
                                        <input
                                            type="text"
                                            value={openRecord.record.dosha || ''}
                                            onChange={(event) => {
                                                if (openRecord.type === 'plan') {
                                                    patchPatientPlan(openRecord.record.id || '', { dosha: event.target.value });
                                                } else {
                                                    patchPatientVisit(openRecord.record.id || '', { dosha: event.target.value });
                                                }
                                            }}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/15 focus:border-primary/30 outline-none"
                                        />
                                    </label>
                                </div>

                                {openRecord.type === 'visit' && (
                                    <label className="space-y-2 block mb-5">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nota de visita</span>
                                        <SpeechTextarea
                                            value={openRecord.record.note || ''}
                                            onValueChange={(value) => patchPatientVisit(openRecord.record.id || '', { note: value })}
                                            rows={4}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base resize-none focus:ring-2 focus:ring-primary/15 focus:border-primary/30 outline-none"
                                        />
                                    </label>
                                )}

                                {/* Observaciones de la lengua (fix #14) */}
                                <label className="space-y-2 block mb-5">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Observaciones de la lengua</span>
                                    <SpeechTextarea
                                        value={openRecord.record.tongue || ''}
                                        onValueChange={(value) => {
                                            if (openRecord.type === 'plan') {
                                                patchPatientPlan(openRecord.record.id || '', { tongue: value });
                                            } else {
                                                patchPatientVisit(openRecord.record.id || '', { tongue: value });
                                            }
                                        }}
                                        rows={4}
                                        placeholder="Color, saburra, marcas, grietas, humedad, zonas afectadas..."
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base resize-y focus:ring-2 focus:ring-primary/15 focus:border-primary/30 outline-none"
                                    />
                                </label>

                                {(() => {
                                    const adherence = buildRecordAdherence(openRecord.record);
                                    const categoryItems = mergeAdherenceItems(adherence.categories, openRecord.record.categories || []);
                                    const herbItems = mergeAdherenceItems(adherence.herbs, (openRecord.record.herbs || []).map(herb => herb.formula));
                                    const hasItems = categoryItems.length > 0 || herbItems.length > 0;

                                    if (!hasItems) return null;

                                    const renderItems = (section: 'categories' | 'herbs', items: TreatmentAdherenceItem[]) => (
                                        <div className="space-y-2">
                                            {items.map(item => (
                                                <div key={`${section}-${item.name}`} className="rounded-lg border border-slate-100 bg-white p-3">
                                                    <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                                                        <span className="flex-1 text-sm font-bold text-slate-700">{item.name}</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {[
                                                                { value: 'done', label: 'Hecho' },
                                                                { value: 'partial', label: 'Parcial' },
                                                                { value: 'not_done', label: 'No hecho' },
                                                                { value: 'unknown', label: 'Sin revisar' }
                                                            ].map(option => (
                                                                <button
                                                                    key={option.value}
                                                                    type="button"
                                                                    onClick={() => patchOpenRecordAdherence(section, item.name, { status: option.value as TreatmentAdherenceItem['status'] })}
                                                                    className={`px-2 py-1 rounded-md border text-[10px] font-bold transition-colors ${
                                                                        item.status === option.value
                                                                            ? getAdherenceClass(item.status)
                                                                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                                                                    }`}
                                                                >
                                                                    {option.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={item.note || ''}
                                                        onChange={(event) => patchOpenRecordAdherence(section, item.name, { note: event.target.value })}
                                                        placeholder="Nota breve: qué hizo, qué no hizo, reacción, tolerancia..."
                                                        className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    );

                                    return (
                                        <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div>
                                                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800">Qué hizo realmente el paciente</h4>
                                                    <p className="text-[11px] text-slate-500 mt-1">Esto alimenta el historial visual y las alertas del próximo PDF.</p>
                                                </div>
                                                <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                                            </div>
                                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                                {categoryItems.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Categorías</p>
                                                        {renderItems('categories', categoryItems)}
                                                    </div>
                                                )}
                                                {herbItems.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Fórmulas herbales</p>
                                                        {renderItems('herbs', herbItems)}
                                                    </div>
                                                )}
                                            </div>
                                            <label className="block mt-3 space-y-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nota general de adherencia</span>
                                                <SpeechTextarea
                                                    value={adherence.generalNote || ''}
                                                    onValueChange={patchOpenRecordAdherenceNote}
                                                    rows={3}
                                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs resize-none outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                                                    placeholder="Resumen para la siguiente consulta..."
                                                />
                                            </label>
                                        </div>
                                    );
                                })()}

                                {openRecord.type === 'visit' && (
                                    <div className="space-y-3 mb-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Síntomas del archivo</span>
                                            <span className="text-[11px] text-slate-400">Frecuencia e intensidad actuales</span>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center gap-2">
                                            <input
                                                type="text"
                                                value={newRecordSymptomName}
                                                onChange={(event) => setNewRecordSymptomName(event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter') {
                                                        event.preventDefault();
                                                        handleAddRecordSymptom();
                                                    }
                                                }}
                                                placeholder="Agregar síntoma nuevo al archivo..."
                                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/15 focus:border-primary/30 outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddRecordSymptom}
                                                className="h-10 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <Plus size={14} />
                                                Agregar
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {Object.entries(openRecord.record.symptoms || {}).length > 0 ? (
                                                Object.entries(openRecord.record.symptoms || {}).map(([symptom, data]) => (
                                                    <div key={symptom} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                                        <span className="font-medium text-slate-700 text-sm flex-1">{symptom}</span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                                                                {['D', 'S', 'M'].map((freq) => {
                                                                    const map = { 'D': 'Diaria', 'S': 'Semanal', 'M': 'Mensual' };
                                                                    const fullFreq = map[freq as keyof typeof map];
                                                                    const isSelected = data.frequency === fullFreq;
                                                                    return (
                                                                        <button
                                                                            key={freq}
                                                                            type="button"
                                                                            onClick={() => patchPatientVisit(openRecord.record.id || '', {
                                                                                symptoms: {
                                                                                    ...(openRecord.record.symptoms || {}),
                                                                                    [symptom]: { ...data, frequency: fullFreq }
                                                                                }
                                                                            })}
                                                                            className={`w-8 h-8 rounded-md text-xs font-bold transition-all ${isSelected
                                                                                ? 'bg-white shadow-sm text-slate-800 ring-1 ring-black/5'
                                                                                : 'text-slate-400 hover:text-slate-600'
                                                                                }`}
                                                                        >
                                                                            {freq}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>

                                                            <div className="w-px h-8 bg-slate-100 mx-1" />

                                                            <div className={`flex bg-slate-100 rounded-lg p-1 gap-1 flex-wrap max-w-full ${isSuperado(data.frequency) ? 'opacity-40 pointer-events-none' : ''}`}>
                                                                {(visitIntensityScale === 10 ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1, 2, 3]).map((num) => {
                                                                    const isSelected = data.intensity === num;
                                                                    let bgClass = 'text-slate-400 hover:text-slate-600';
                                                                    if (isSelected) {
                                                                        if (visitIntensityScale === 10) {
                                                                            if (num <= 3) bgClass = 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300';
                                                                            else if (num <= 7) bgClass = 'bg-amber-100 text-amber-700 ring-1 ring-amber-300';
                                                                            else bgClass = 'bg-red-100 text-red-700 ring-1 ring-red-300';
                                                                        } else {
                                                                            bgClass = num === 1 ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' :
                                                                                    num === 2 ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' :
                                                                                    'bg-red-100 text-red-700 ring-1 ring-red-300';
                                                                        }
                                                                    }
                                                                    const btnSize = visitIntensityScale === 10 ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
                                                                    return (
                                                                        <button
                                                                            key={num}
                                                                            onClick={() => patchPatientVisit(openRecord.record.id || '', {
                                                                                symptoms: {
                                                                                    ...(openRecord.record.symptoms || {}),
                                                                                    [symptom]: { ...data, intensity: num }
                                                                                }
                                                                            })}
                                                                            className={`${btnSize} rounded-md font-bold transition-all ${bgClass}`}
                                                                            title={`${num}`}
                                                                        >
                                                                            {num}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => patchPatientVisit(openRecord.record.id || '', {
                                                                    symptoms: {
                                                                        ...(openRecord.record.symptoms || {}),
                                                                        [symptom]: isSuperado(data.frequency)
                                                                            ? { ...data, frequency: 'Diaria' }
                                                                            : { ...data, frequency: 'Superado' }
                                                                    }
                                                                })}
                                                                className={`h-8 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${isSuperado(data.frequency)
                                                                    ? 'bg-emerald-500 text-white shadow-sm'
                                                                    : 'bg-slate-100 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                                                    }`}
                                                                title="Marcar como síntoma superado"
                                                            >
                                                                <Check size={14} />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const nextSymptoms = { ...(openRecord.record.symptoms || {}) };
                                                                    delete nextSymptoms[symptom];
                                                                    patchPatientVisit(openRecord.record.id || '', { symptoms: nextSymptoms });
                                                                }}
                                                                className="w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                                                                title="Quitar síntoma"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-4 text-xs text-slate-400 bg-white border border-dashed border-slate-200 rounded-lg">
                                                    Este archivo todavía no tiene síntomas registrados.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-5">
                                    <div className="space-y-2 flex flex-col">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Diagnóstico</span>
                                            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px]">
                                                <button
                                                    type="button"
                                                    onClick={() => setDiagnosisViewMode('edit')}
                                                    className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${diagnosisViewMode === 'edit' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDiagnosisViewMode('preview')}
                                                    className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${diagnosisViewMode === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                                >
                                                    Vista Previa
                                                </button>
                                            </div>
                                        </div>
                                        {diagnosisViewMode === 'edit' ? (
                                            <SpeechTextarea
                                                value={openRecord.record.diagnosis || ''}
                                                onValueChange={(value) => {
                                                    if (openRecord.type === 'plan') {
                                                        patchPatientPlan(openRecord.record.id || '', { diagnosis: value });
                                                    } else {
                                                        patchPatientVisit(openRecord.record.id || '', { diagnosis: value });
                                                    }
                                                }}
                                                rows={recordEditorMode === 'full' ? 10 : 7}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base resize-y min-h-48 focus:ring-2 focus:ring-emerald-200/70 focus:border-emerald-300 outline-none"
                                            />
                                        ) : (
                                            <div className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 min-h-48 overflow-x-auto prose prose-sm prose-emerald max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {openRecord.record.diagnosis || '*Sin diagnóstico*'}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2 flex flex-col">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tratamiento</span>
                                            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px]">
                                                <button
                                                    type="button"
                                                    onClick={() => setTreatmentViewMode('edit')}
                                                    className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${treatmentViewMode === 'edit' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setTreatmentViewMode('preview')}
                                                    className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${treatmentViewMode === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                                >
                                                    Vista Previa
                                                </button>
                                            </div>
                                        </div>
                                        {treatmentViewMode === 'edit' ? (
                                            <SpeechTextarea
                                                value={openRecord.record.treatment || ''}
                                                onValueChange={(value) => {
                                                    if (openRecord.type === 'plan') {
                                                        patchPatientPlan(openRecord.record.id || '', { treatment: value });
                                                    } else {
                                                        patchPatientVisit(openRecord.record.id || '', { treatment: value });
                                                    }
                                                }}
                                                rows={recordEditorMode === 'full' ? 10 : 7}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base resize-y min-h-48 focus:ring-2 focus:ring-emerald-200/70 focus:border-emerald-300 outline-none"
                                            />
                                        ) : (
                                            <div className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 min-h-48 overflow-x-auto prose prose-sm prose-emerald max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {openRecord.record.treatment || '*Sin tratamiento*'}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2 flex flex-col">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estilo de vida</span>
                                            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px]">
                                                <button
                                                    type="button"
                                                    onClick={() => setLifestyleViewMode('edit')}
                                                    className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${lifestyleViewMode === 'edit' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLifestyleViewMode('preview')}
                                                    className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${lifestyleViewMode === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                                >
                                                    Vista Previa
                                                </button>
                                            </div>
                                        </div>
                                        {lifestyleViewMode === 'edit' ? (
                                            <SpeechTextarea
                                                value={openRecord.record.lifestyle || ''}
                                                onValueChange={(value) => {
                                                    if (openRecord.type === 'plan') {
                                                        patchPatientPlan(openRecord.record.id || '', { lifestyle: value });
                                                    } else {
                                                        patchPatientVisit(openRecord.record.id || '', { lifestyle: value });
                                                    }
                                                }}
                                                rows={6}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base resize-y min-h-32 focus:ring-2 focus:ring-emerald-200/70 focus:border-emerald-300 outline-none"
                                            />
                                        ) : (
                                            <div className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 min-h-32 overflow-x-auto prose prose-sm prose-emerald max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {openRecord.record.lifestyle || '*Sin estilo de vida*'}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>

                                    {/* Fórmulas herbales editables (fix #12) */}
                                    {(() => {
                                        const recordHerbs = (openRecord.record.herbs || []) as Array<{ formula: string; dosage: string; purpose?: string }>;
                                        const updateHerbs = (herbs: Array<{ formula: string; dosage: string; purpose?: string }>) => {
                                            if (openRecord.type === 'plan') {
                                                patchPatientPlan(openRecord.record.id || '', { herbs });
                                            } else {
                                                patchPatientVisit(openRecord.record.id || '', { herbs });
                                            }
                                        };
                                        return (
                                            <div className="space-y-2 flex flex-col">
                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fórmulas herbales</span>
                                                <datalist id="record-herb-suggestions">
                                                    {HERB_SUGGESTIONS.map((name) => (
                                                        <option key={name} value={name} />
                                                    ))}
                                                </datalist>
                                                <div className="space-y-2">
                                                    {recordHerbs.length === 0 && (
                                                        <p className="text-xs text-slate-400">Sin fórmulas. Agrega una abajo.</p>
                                                    )}
                                                    {recordHerbs.map((herb, idx) => (
                                                        <div key={idx} className="flex flex-col sm:flex-row gap-2">
                                                            <input
                                                                type="text"
                                                                list="record-herb-suggestions"
                                                                value={herb.formula || ''}
                                                                onChange={(e) => {
                                                                    const formulaVal = e.target.value;
                                                                    const dbUsage = lookupHerbUsage(formulaVal);
                                                                    const dbPurpose = lookupHerbPurpose(formulaVal);
                                                                    const next = recordHerbs.map((h, i) => {
                                                                        if (i !== idx) return h;
                                                                        // Si se borra el nombre de la fórmula, se borra también la dosis y propósito.
                                                                        if (!formulaVal.trim()) {
                                                                            return { ...h, formula: formulaVal, dosage: '', purpose: '' };
                                                                        }
                                                                        // Autocompleta la dosis y propósito desde la base de datos
                                                                        const nextDosage = (dbUsage && !(h.dosage || '').trim()) ? dbUsage : h.dosage;
                                                                        const nextPurpose = dbPurpose || h.purpose || '';
                                                                        return { ...h, formula: formulaVal, dosage: nextDosage, purpose: nextPurpose };
                                                                    });
                                                                    updateHerbs(next);
                                                                }}
                                                                placeholder="Fórmula o hierba..."
                                                                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200/70 focus:border-emerald-300 outline-none"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={herb.dosage || ''}
                                                                onChange={(e) => {
                                                                    const next = recordHerbs.map((h, i) => i === idx ? { ...h, dosage: e.target.value, purpose: h.purpose || lookupHerbPurpose(h.formula) || '' } : h);
                                                                    updateHerbs(next);
                                                                }}
                                                                placeholder="Dosis (ej. 1 cáps. 2x día)"
                                                                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200/70 focus:border-emerald-300 outline-none"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => updateHerbs(recordHerbs.filter((_, i) => i !== idx))}
                                                                className="w-9 h-9 shrink-0 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                                                                title="Quitar fórmula"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => updateHerbs([...recordHerbs, { formula: '', dosage: '' }])}
                                                    className="self-start flex items-center gap-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-3 py-1.5 transition-colors"
                                                >
                                                    <Plus size={14} />
                                                    Agregar fórmula
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <TreatmentPDFModal
                isOpen={isTreatmentModalOpen}
                onClose={() => {
                    setIsTreatmentModalOpen(false);
                    setEditingRecord(null);
                    void fetchPatientDetails();
                }}
                initialDiagnosis={diagnosis}
                editingRecord={editingRecord}
                patientId={activeTreatmentPatientId || patientId || patient?.id || null}
                patient={patient ? { ...patient, id: activeTreatmentPatientId || patientId || patient.id } : { name: 'Paciente', age: '', email: '', dosha: 'Vata-Pitta', fullNotes: '[]', symptomCalibrations: [], plainSymptoms: [], visits: [], treatmentPlans: [] }}
            />

            {/* Visor Lightbox para fotos de lengua */}
            <AnimatePresence>
                {activeTonguePhoto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setActiveTonguePhoto(null)}
                        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4"
                    >
                        <div 
                            onClick={(e) => e.stopPropagation()} 
                            className="relative max-w-4xl w-full flex flex-col items-center gap-4"
                        >
                            {/* Imagen */}
                            <motion.div
                                initial={{ scale: 0.95, y: 15 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 15 }}
                                className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900 max-h-[75vh]"
                            >
                                <img
                                    src={activeTonguePhoto.url}
                                    alt="Visor de foto de lengua"
                                    className="max-w-full max-h-[75vh] object-contain block"
                                />
                            </motion.div>

                            {/* Info & Controles */}
                            <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-white px-2">
                                <div className="min-w-0">
                                    <h4 className="font-bold text-sm truncate">{activeTonguePhoto.originalName || 'Foto de lengua'}</h4>
                                    <p className="text-xs text-white/50">{formatNoteDate(activeTonguePhoto.createdAt)}</p>
                                    {activeTonguePhoto.note && (
                                        <p className="text-xs text-white/80 mt-1.5 leading-relaxed whitespace-pre-wrap">{activeTonguePhoto.note}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <a
                                        href={activeTonguePhoto.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors"
                                        title="Abrir en pestaña nueva"
                                    >
                                        <ExternalLink size={14} />
                                        <span>Abrir original</span>
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTonguePhoto(null)}
                                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                        title="Cerrar visor"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </AnimatePresence>
    );
}

const StatCard = ({ label, value, gradient, borderColor, truncate, highlight, children }: {
    label: string; value: string; gradient: string; borderColor: string; truncate?: boolean; highlight?: boolean; children?: React.ReactNode;
}) => (
    <div className={`p-4 rounded-xl border bg-gradient-to-br ${gradient} ${borderColor} flex flex-col gap-1.5`}>
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</span>
        {children || (
            <span className={`font-bold text-sm ${truncate ? 'truncate' : ''} ${highlight ? 'text-primary' : 'text-slate-700'}`}>
                {value}
            </span>
        )}
    </div>
);
