import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, CheckCircle, AlertCircle, StickyNote, Plus, X } from 'lucide-react';
import { PublicLayout } from '../layouts/PublicLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SpeechTextarea } from '../components/ui/SpeechTextarea';

const PROFESSIONAL_NOTES_DRAFT_KEY = 'vedamci-professional-notes-draft';

const SYMPTOMS_LIST = [
    "Gas excesivo", "Eructos excesivos", "Gastritis o reflujo", "Nausea o vomito",
    "Sueño y pesadez después de comer", "Estreñimiento", "Diarrea",
    "Diarrea combinada con estreñimiento", "Dolor abdominal", "Ansiedad",
    "Enojo", "Depresión"
];

const SUBSTANCES_LIST = [
    "Tabaco", "Alcohol", "Marihuana", "CBD", "Otras", "Ninguna"
];

const EXERCISE_LIST = [
    "Ninguno", "Caminar", "Correr", "Yoga", "Natación"
];

const EATING_HABITS_LIST = [
    "Agradezco antes de las comidas.",
    "Descanso 15 minutos después de comer.",
    "Evito tomar agua fría con los alimentos.",
    "Como hasta estar satisfecho no saturo mi estomago.",
    "Como en un ambiente tranquilo y sin distracciones.",
    "Mastico adecuadamente los alimentos."
];

const SUPPLEMENTS_LIST = [
    "Multivitaminico", "Vitamina C", "Vitamina E", "Vitamina D",
    "Omega-3", "Calcio", "Magnesio", "Zinc", "Minerales",
    "Lactobacilos", "Aminoácidos", "Antioxidante.", "Té Herbal",
    "Hierbas chinas", "Hierbas Ayurvédicas", "Homepathia",
    "Flores de Bach", "Licuados de proteína", "Espirulina", "Selenio"
];

const MENSTRUATION_LIST = [
    "No aplica soy hombre",
    "Mi flujo menstrual es irregular",
    "Mi flujo menstrual es muy pesado",
    "Tengo cólicos todos los meses",
    "Dolor de cabeza durante",
    "Retención de liquido",
    "Sensibilidad en los senos",
    "Irritabilidad",
    "Ninguna"
];

const SLEEP_LIST = [
    "Mi sueño es ligero y me despierto con cualquier sonido",
    "Me cuesta trabajo dormir cuando hay calor",
    "Mi sueño es muy pesado y me cuesta levantarme por la mañana",
    "No sé cual elegir o podría elegir dos afirmaciones"
];

interface PatientIntakeFormProps {
    isInternal?: boolean;
    onSuccess?: () => void;
}

export default function PatientIntakeForm({ isInternal, onSuccess }: PatientIntakeFormProps) {
    const [formData, setFormData] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return {
            // Personal
            patientName: params.get('patientName') || params.get('name') || '',
            phone: params.get('phone') || params.get('celular') || '',
            address: '', occupation: '', maritalStatus: '',
            children: '', emergencyContact: '', weight: '', height: '', age: '',
            email: params.get('email') || '',

            // History
            consultationReason: '', preexistingConditions: '', hospitalizations: '',
            surgeries: '', pregnancy: 'No', substances: [] as string[], otherSymptoms: '',
            energyLevel: '5', exercise: [] as string[], symptoms: [] as string[],
            symptomCalibrations: {} as Record<string, { frequency: string; intensity: number }>,

            // Diet
            breakfast: '', diet: '', dinner: '', allergies: '', mealSchedule: '',
            mealsPerDay: '3', eatingHabits: [] as string[], supplements: [] as string[],

            // Profile
            appetite: '', weightTendency: '', menstruation: [] as string[], sweat: '',
            sleep: [] as string[], temperature: '',

            // Final
            professional: '', recordingConsent: '', studentListeners: '',
            consent: isInternal || false,
            dataProtection: isInternal || false,

            // Internal
            commitment: '10',
            professionalNotes: ''
        };
    });

    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [newSymptomName, setNewSymptomName] = useState('');

    useEffect(() => {
        if (isInternal) {
            try {
                // Purge any legacy global notes draft to prevent leaks
                localStorage.removeItem(PROFESSIONAL_NOTES_DRAFT_KEY);
            } catch (e) {
                // no-op
            }
        }
    }, [isInternal]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleMultiSelect = (field: string, value: string) => {
        setFormData(prev => {
            const current = (prev as any)[field] || [];
            if (current.includes(value)) {
                // If removing a symptom, also remove its calibration
                if (field === 'symptoms') {
                    const newCalibrations = { ...prev.symptomCalibrations };
                    delete newCalibrations[value];
                    return { ...prev, [field]: current.filter((item: string) => item !== value), symptomCalibrations: newCalibrations };
                }
                return { ...prev, [field]: current.filter((item: string) => item !== value) };
            } else {
                // If adding a symptom, add default calibration
                if (field === 'symptoms') {
                    return {
                        ...prev,
                        [field]: [...current, value],
                        symptomCalibrations: {
                            ...prev.symptomCalibrations,
                            [value]: { frequency: 'Diaria', intensity: 1 }
                        }
                    };
                }
                return { ...prev, [field]: [...current, value] };
            }
        });
    };

    const handleCalibrationChange = (symptom: string, field: 'frequency' | 'intensity', value: string | number) => {
        setFormData(prev => ({
            ...prev,
            symptomCalibrations: {
                ...prev.symptomCalibrations,
                [symptom]: {
                    ...prev.symptomCalibrations[symptom],
                    [field]: value
                }
            }
        }));
    };

    const normalizeSymptomName = (value: string) => value.trim().replace(/\s+/g, ' ');

    const handleAddCustomSymptom = () => {
        const symptomName = normalizeSymptomName(newSymptomName);
        if (!symptomName || formData.symptoms.includes(symptomName)) {
            setNewSymptomName('');
            return;
        }

        setFormData(prev => ({
            ...prev,
            symptoms: [...prev.symptoms, symptomName],
            symptomCalibrations: {
                ...prev.symptomCalibrations,
                [symptomName]: { frequency: 'Diaria', intensity: 1 }
            }
        }));
        setNewSymptomName('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Basic validation
        if (!formData.patientName || !formData.email || !formData.phone || (!isInternal && !formData.consent)) {
            setErrorMessage('Por favor complete los campos obligatorios.');
            setStatus('error');
            if (!isInternal) window.scrollTo(0, 0);
            return;
        }

        // Confirmación antes de enviar la ficha.
        if (!window.confirm('¿Enviar la ficha de ingreso? Revisa que los datos estén completos antes de continuar.')) {
            return;
        }

        setStatus('loading');

        try {
            const response = await fetch('/api/consultation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                setStatus('success');
                if (isInternal) {
                    setFormData(prev => ({ ...prev, professionalNotes: '' }));
                }
                if (onSuccess) {
                    setTimeout(() => onSuccess(), 1500);
                }
                if (!isInternal) window.scrollTo(0, 0);
            } else {
                const data = await response.json();
                setStatus('error');
                setErrorMessage(data.error || 'Error desconocido al guardar en Notion.');
                if (!isInternal) window.scrollTo(0, 0);
            }
        } catch (error) {
            setStatus('error');
            setErrorMessage('Error de conexión con el servidor.');
            if (!isInternal) window.scrollTo(0, 0);
        }
    };

    const successContent = (
        <div className="text-center py-20 px-6">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6"
            >
                <CheckCircle size={40} />
            </motion.div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">¡Formulario Recibido!</h2>
            <p className="text-slate-600 max-w-md mx-auto mb-8">
                {isInternal ? 'La ficha ha sido guardada correctamente en Notion.' : 'Hemos recibido tus datos correctamente. Nuestro equipo revisará tu información antes de la consulta.'}
            </p>
            {!isInternal && (
                <Button onClick={() => window.location.reload()} variant="outline">
                    Enviar otro formulario
                </Button>
            )}
        </div>
    );

    /* Helper: section label for numbered questions */
    const qLabel = (num: number, text: string, required = true) => (
        <label className="text-sm font-semibold">
            {num}. {text}{required ? ' *' : ''}
        </label>
    );

    /* Helper: radio group */
    const radioGroup = (name: string, options: string[], value: string) => (
        <div className="space-y-2">
            {options.map(opt => (
                <label key={opt} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded">
                    <input
                        type="radio"
                        name={name}
                        value={opt}
                        checked={value === opt}
                        onChange={handleChange}
                        className="w-4 h-4 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-slate-700">{opt}</span>
                </label>
            ))}
        </div>
    );

    /* Helper: multi-select checkbox group */
    const checkboxGroup = (field: string, options: string[], selected: string[]) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {options.map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
                    <input
                        type="checkbox"
                        checked={selected.includes(opt)}
                        onChange={() => handleMultiSelect(field, opt)}
                        className="w-4 h-4 text-primary rounded ring-offset-0 focus:ring-0"
                    />
                    <span className="text-sm text-slate-700">{opt}</span>
                </label>
            ))}
        </div>
    );

    const customSymptoms = formData.symptoms.filter(symptom => !SYMPTOMS_LIST.includes(symptom));

    const professionalNotesPanel = isInternal ? (
        <aside className="order-first xl:order-last sticky top-3 z-20 rounded-2xl border border-amber-100 bg-white shadow-xl shadow-amber-100/50 overflow-hidden">
            <div className="p-4 border-b border-amber-100 bg-amber-50/70">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <StickyNote size={16} className="text-amber-600" />
                    Notas del profesional
                </label>
            </div>
            <div className="p-4">
                <SpeechTextarea
                    name="professionalNotes"
                    value={formData.professionalNotes}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, professionalNotes: value }))}
                    className="w-full p-3 bg-amber-50/30 rounded-xl border border-amber-100 h-32 xl:h-[calc(90vh-15rem)] max-h-[32rem] focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none"
                    placeholder="Notas clínicas internas para guardar con esta ficha..."
                />
            </div>
        </aside>
    ) : null;

    const formContent = (
        <form
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
                // Evita que Enter en un campo de una línea envíe la ficha por accidente.
                // Enter sigue funcionando en áreas de texto y en el botón de enviar.
                const target = e.target as HTMLElement;
                if (e.key === 'Enter' && target.tagName !== 'TEXTAREA' && target.tagName !== 'BUTTON') {
                    e.preventDefault();
                }
            }}
            className="space-y-8"
        >
            {status === 'error' && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3">
                    <AlertCircle size={24} />
                    <div>
                        <p className="font-bold">Error</p>
                        <p className="text-sm">{errorMessage}</p>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* Seccion 1: Datos Personales (Q1–Q11)                  */}
            {/* ═══════════════════════════════════════════════════════ */}
            <Card className="p-6 md:p-8 space-y-6">
                <h2 className="text-xl font-bold text-primary border-b border-primary/10 pb-4">1. Datos Personales</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Q1 */}
                    <div className="space-y-2">
                        {qLabel(1, 'Nombre')}
                        <input required name="patientName" value={formData.patientName} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200" />
                    </div>
                    {/* Q2 */}
                    <div className="space-y-2">
                        {qLabel(2, 'Número de celular')}
                        <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200" />
                    </div>
                    {/* Q3 */}
                    <div className="space-y-2">
                        {qLabel(3, 'Dirección')}
                        <input name="address" value={formData.address} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200" />
                    </div>
                    {/* Q4 */}
                    <div className="space-y-2">
                        {qLabel(4, 'Ocupación')}
                        <input name="occupation" value={formData.occupation} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200" />
                    </div>
                    {/* Q5 */}
                    <div className="space-y-2">
                        {qLabel(5, 'Estado civil')}
                        <input name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200" />
                    </div>
                    {/* Q6 */}
                    <div className="space-y-2">
                        {qLabel(6, 'Número de hijos')}
                        <input name="children" value={formData.children} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200" />
                    </div>
                    {/* Q7 */}
                    <div className="space-y-2">
                        {qLabel(7, 'Contacto de emergencia')}
                        <input name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200" />
                    </div>
                    {/* Q8 */}
                    <div className="space-y-2">
                        {qLabel(8, 'Peso')}
                        <input name="weight" value={formData.weight} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200" />
                    </div>
                    {/* Q9 */}
                    <div className="space-y-2">
                        {qLabel(9, 'Altura')}
                        <input name="height" value={formData.height} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200" />
                    </div>
                    {/* Q10 */}
                    <div className="space-y-2">
                        {qLabel(10, 'Edad')}
                        <input type="number" name="age" value={formData.age} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200" />
                    </div>
                    {/* Q11 */}
                    <div className="space-y-2">
                        {qLabel(11, 'Correo electrónico')}
                        <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200" />
                    </div>
                </div>
            </Card>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* Seccion 2: Salud y Antecedentes (Q12–Q21)             */}
            {/* ═══════════════════════════════════════════════════════ */}
            <Card className="p-6 md:p-8 space-y-6">
                <h2 className="text-xl font-bold text-primary border-b border-primary/10 pb-4">2. Salud y Antecedentes</h2>

                {/* Q12 */}
                <div className="space-y-2">
                    {qLabel(12, 'Propósito de la consulta')}
                    <textarea name="consultationReason" value={formData.consultationReason} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 h-24" placeholder="Describe brevemente el propósito de tu consulta" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Q13 */}
                    <div className="space-y-2">
                        {qLabel(13, 'Enfermedades diagnosticadas previamente')}
                        <textarea name="preexistingConditions" value={formData.preexistingConditions} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 h-20" placeholder="Escribe los detalles" />
                    </div>
                    {/* Q14 */}
                    <div className="space-y-2">
                        {qLabel(14, 'Hospitalizaciones')}
                        <textarea name="hospitalizations" value={formData.hospitalizations} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 h-20" placeholder="Escribe los detalles" />
                    </div>
                    {/* Q15 */}
                    <div className="space-y-2">
                        {qLabel(15, 'Cirugías estéticas')}
                        <textarea name="surgeries" value={formData.surgeries} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 h-20" placeholder="Escribe los detalles" />
                    </div>
                    {/* Q16 */}
                    <div className="space-y-2">
                        {qLabel(16, 'Embarazo')}
                        {radioGroup('pregnancy', ['Sí', 'No'], formData.pregnancy)}
                    </div>
                </div>

                {/* Q17 */}
                <div className="space-y-3">
                    {qLabel(17, 'Usas frecuentemente algunas de las siguientes substancias')}
                    <p className="text-xs text-slate-400">(Selecciona todas las opciones que quieras)</p>
                    {checkboxGroup('substances', SUBSTANCES_LIST, formData.substances)}
                </div>

                {/* Q18 */}
                <div className="space-y-3">
                    {qLabel(18, 'Síntomas (Selecciona los síntomas que tengas en este momento)')}
                    <div className="text-sm text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                        <p className="font-bold text-primary mb-2 flex items-center gap-2">
                            <span className="bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">!</span>
                            Instrucciones Importantes:
                        </p>
                        <ol className="list-decimal pl-5 space-y-1 text-xs">
                            <li><strong>Marca la casilla</strong> del síntoma que presentas o agrega uno nuevo si no aparece en la lista.</li>
                            <li>Selecciona la <strong>Frecuencia</strong>:
                                <ul className="list-disc pl-5 mt-1 text-slate-500">
                                    <li><strong className="text-blue-600">D</strong> = Diaria</li>
                                    <li><strong className="text-emerald-600">S</strong> = Semanal</li>
                                    <li><strong className="text-slate-600">M</strong> = Mensual</li>
                                </ul>
                            </li>
                            <li>Selecciona la <strong>Intensidad</strong> (1 = Suave, 2 = Moderado, 3 = Fuerte).</li>
                        </ol>
                    </div>
                    <div className="space-y-2">
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-2">
                            <input
                                type="text"
                                value={newSymptomName}
                                onChange={(event) => setNewSymptomName(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        handleAddCustomSymptom();
                                    }
                                }}
                                placeholder="Agregar síntoma nuevo..."
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/15 focus:border-primary/30 outline-none"
                            />
                            <button
                                type="button"
                                onClick={handleAddCustomSymptom}
                                className="h-10 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
                            >
                                <Plus size={14} />
                                Agregar
                            </button>
                        </div>

                        {customSymptoms.map(symptom => {
                            const cal = formData.symptomCalibrations[symptom];
                            return (
                                <div key={symptom} className="rounded-xl border border-primary/30 bg-primary/5 shadow-sm">
                                    <div className="flex items-center gap-3 p-3">
                                        <span className="text-sm font-medium text-primary flex-1">{symptom}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleMultiSelect('symptoms', symptom)}
                                            className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                                            title="Quitar síntoma"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    {cal && (
                                        <div className="px-3 pb-3 pt-0 flex flex-wrap gap-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Frecuencia:</span>
                                                <div className="flex gap-1">
                                                    {[
                                                        { label: 'D', value: 'Diaria', title: 'Diaria' },
                                                        { label: 'S', value: 'Semanal', title: 'Semanal' },
                                                        { label: 'M', value: 'Mensual', title: 'Mensual' }
                                                    ].map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            title={opt.title}
                                                            onClick={() => handleCalibrationChange(symptom, 'frequency', opt.value)}
                                                            className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${cal.frequency === opt.value
                                                                ? opt.value === 'Diaria' ? 'bg-blue-500 text-white shadow-sm'
                                                                    : opt.value === 'Semanal' ? 'bg-emerald-500 text-white shadow-sm'
                                                                        : 'bg-slate-500 text-white shadow-sm'
                                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                                }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Intensidad:</span>
                                                <div className="flex gap-1">
                                                    {([1, 2, 3] as const).map(level => {
                                                        const labels = { 1: 'Suave', 2: 'Moderado', 3: 'Fuerte' };
                                                        return (
                                                            <button
                                                                key={level}
                                                                type="button"
                                                                title={labels[level]}
                                                                onClick={() => handleCalibrationChange(symptom, 'intensity', level)}
                                                                className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${cal.intensity === level
                                                                    ? level === 1 ? 'bg-green-500 text-white shadow-sm'
                                                                        : level === 2 ? 'bg-amber-500 text-white shadow-sm'
                                                                            : 'bg-red-500 text-white shadow-sm'
                                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                                    }`}
                                                            >
                                                                {level}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {SYMPTOMS_LIST.map(symptom => {
                            const isChecked = formData.symptoms.includes(symptom);
                            const cal = formData.symptomCalibrations[symptom];
                            return (
                                <div key={symptom} className={`rounded-xl border transition-all ${isChecked ? 'border-primary/30 bg-primary/5 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'
                                    }`}>
                                    <label className="flex items-center gap-3 cursor-pointer p-3">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleMultiSelect('symptoms', symptom)}
                                            className="w-4 h-4 text-primary rounded ring-offset-0 focus:ring-0"
                                        />
                                        <span className={`text-sm font-medium ${isChecked ? 'text-primary' : 'text-slate-700'}`}>{symptom}</span>
                                    </label>
                                    {isChecked && cal && (
                                        <div className="px-3 pb-3 pt-0 flex flex-wrap gap-4 ml-7">
                                            {/* Frequency */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Frecuencia:</span>
                                                <div className="flex gap-1">
                                                    {[
                                                        { label: 'D', value: 'Diaria', title: 'Diaria' },
                                                        { label: 'S', value: 'Semanal', title: 'Semanal' },
                                                        { label: 'M', value: 'Mensual', title: 'Mensual' }
                                                    ].map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            title={opt.title}
                                                            onClick={() => handleCalibrationChange(symptom, 'frequency', opt.value)}
                                                            className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${cal.frequency === opt.value
                                                                ? opt.value === 'Diaria' ? 'bg-blue-500 text-white shadow-sm'
                                                                    : opt.value === 'Semanal' ? 'bg-emerald-500 text-white shadow-sm'
                                                                        : 'bg-slate-500 text-white shadow-sm'
                                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                                }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* Intensity */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Intensidad:</span>
                                                <div className="flex gap-1">
                                                    {([1, 2, 3] as const).map(level => {
                                                        const labels = { 1: 'Suave', 2: 'Moderado', 3: 'Fuerte' };
                                                        return (
                                                            <button
                                                                key={level}
                                                                type="button"
                                                                title={labels[level]}
                                                                onClick={() => handleCalibrationChange(symptom, 'intensity', level)}
                                                                className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${cal.intensity === level
                                                                    ? level === 1 ? 'bg-green-500 text-white shadow-sm'
                                                                        : level === 2 ? 'bg-amber-500 text-white shadow-sm'
                                                                            : 'bg-red-500 text-white shadow-sm'
                                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                                    }`}
                                                            >
                                                                {level}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Q19 */}
                <div className="space-y-2">
                    {qLabel(19, 'Notas o detalles de otros síntomas no mencionados anteriormente')}
                    <textarea name="otherSymptoms" value={formData.otherSymptoms} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 h-20" />
                </div>

                {/* Q20 */}
                <div className="space-y-2">
                    {qLabel(20, 'Cuál es tu nivel de energía en un rango del 1 al 10 (1 baja, 10 alta)')}
                    <div className="flex items-center gap-4">
                        <input type="range" min="1" max="10" name="energyLevel" value={formData.energyLevel} onChange={handleChange} className="flex-1 accent-primary" />
                        <span className="font-bold text-xl text-primary min-w-[2rem] text-center">{formData.energyLevel}</span>
                    </div>
                </div>

                {/* Q21 */}
                <div className="space-y-3">
                    {qLabel(21, '¿Practicas algún tipo de ejercicio?')}
                    <p className="text-xs text-slate-400">(Selecciona todas las opciones que quieras)</p>
                    {checkboxGroup('exercise', EXERCISE_LIST, formData.exercise)}
                </div>
            </Card>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* Seccion 3: Hábitos Alimentarios (Q22–Q29)             */}
            {/* ═══════════════════════════════════════════════════════ */}
            <Card className="p-6 md:p-8 space-y-6">
                <h2 className="text-xl font-bold text-primary border-b border-primary/10 pb-4">3. Hábitos Alimentarios</h2>

                {/* Q22–Q24 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        {qLabel(22, 'Desayuno típico')}
                        <textarea name="breakfast" value={formData.breakfast} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 h-24" placeholder="Menciona frecuencia y cantidad" />
                    </div>
                    <div className="space-y-2">
                        {qLabel(23, 'Comida típica')}
                        <textarea name="diet" value={formData.diet} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 h-24" placeholder="Menciona frecuencia y cantidad" />
                    </div>
                    <div className="space-y-2">
                        {qLabel(24, 'Cena típica')}
                        <textarea name="dinner" value={formData.dinner} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 h-24" placeholder="Menciona frecuencia y cantidad" />
                    </div>
                </div>

                {/* Q25 */}
                <div className="space-y-2">
                    {qLabel(25, '¿Tienes algún tipo de alergia?')}
                    <input name="allergies" value={formData.allergies} onChange={handleChange} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200" />
                </div>

                {/* Q26 */}
                <div className="space-y-2">
                    {qLabel(26, '¿Los horarios cuando consumes los alimentos son regulares?')}
                    {radioGroup('mealSchedule', ['Sí', 'No', 'A veces'], formData.mealSchedule)}
                </div>

                {/* Q27 */}
                <div className="space-y-2">
                    {qLabel(27, '¿Cuántas veces comes al día?')}
                    {radioGroup('mealsPerDay', ['3', '2', '5', 'Otro'], formData.mealsPerDay)}
                </div>

                {/* Q28 */}
                <div className="space-y-3">
                    {qLabel(28, 'Respecto a cómo comes selecciona las afirmaciones que apliquen para ti')}
                    <p className="text-xs text-slate-400">(Selecciona todas las opciones que quieras)</p>
                    {checkboxGroup('eatingHabits', EATING_HABITS_LIST, formData.eatingHabits)}
                </div>

                {/* Q29 */}
                <div className="space-y-3">
                    {qLabel(29, 'Selecciona los tipos de suplementos que consumes')}
                    <p className="text-xs text-slate-400">(Selecciona todas las opciones que quieras)</p>
                    {checkboxGroup('supplements', SUPPLEMENTS_LIST, formData.supplements)}
                </div>
            </Card>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* Seccion 4: Perfil Ayurvédico (Q30–Q35)               */}
            {/* ═══════════════════════════════════════════════════════ */}
            <Card className="p-6 md:p-8 space-y-6">
                <h2 className="text-xl font-bold text-primary border-b border-primary/10 pb-4">4. Perfil Ayurvédico</h2>

                {/* Q30 */}
                <div className="space-y-2">
                    {qLabel(30, 'Describe el estado de tu apetito')}
                    {radioGroup('appetite', [
                        'Variable a veces tengo mucha hambre a veces poca.',
                        'Fuerte tengo mucha hambre en las 3 comidas',
                        'Tengo un apetito bajo me da hambre 2 veces al día.'
                    ], formData.appetite)}
                </div>

                {/* Q31 */}
                <div className="space-y-2">
                    {qLabel(31, 'Con respecto al peso elige alguna de las siguientes opciones')}
                    {radioGroup('weightTendency', [
                        'No gano peso fácilmente',
                        'Gano peso fácilmente',
                        'Ninguno'
                    ], formData.weightTendency)}
                </div>

                {/* Q32 */}
                <div className="space-y-3">
                    {qLabel(32, 'Con respecto a la menstruación elige alguna de las siguientes opciones')}
                    <p className="text-xs text-slate-400">(Selecciona todas las opciones que quieras)</p>
                    {checkboxGroup('menstruation', MENSTRUATION_LIST, formData.menstruation)}
                </div>

                {/* Q33 */}
                <div className="space-y-2">
                    {qLabel(33, 'Con respecto al sudor elige alguna de las siguientes opciones')}
                    {radioGroup('sweat', [
                        'Tengo poco sudor y su olor es suave',
                        'Tengo mucho sudor y su olor es fuerte',
                        'Tengo mucho sudor y su olor es dulce',
                        'No sé cual elegir o podría elegir dos afirmaciones'
                    ], formData.sweat)}
                </div>

                {/* Q34 */}
                <div className="space-y-3">
                    {qLabel(34, 'Con respecto al sueño elige alguna de las siguientes opciones')}
                    <p className="text-xs text-slate-400">(Selecciona todas las opciones que quieras)</p>
                    {checkboxGroup('sleep', SLEEP_LIST, formData.sleep)}
                </div>

                {/* Q35 */}
                <div className="space-y-2">
                    {qLabel(35, '¿Cómo es tu temperatura corporal?')}
                    {radioGroup('temperature', [
                        'Soy muy friolento',
                        'Soy muy caluroso',
                        'Ninguna de las anteriores'
                    ], formData.temperature)}
                </div>
            </Card>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* Seccion 5: Cierre (Q36–Q38 + Compromiso + Consent)    */}
            {/* ═══════════════════════════════════════════════════════ */}
            <Card className="p-6 md:p-8 space-y-6">
                <h2 className="text-xl font-bold text-primary border-b border-primary/10 pb-4">5. Cierre</h2>

                {/* Q36 */}
                <div className="space-y-2">
                    {qLabel(36, 'Nombre del profesional de Ayurveda que te atiende')}
                    {radioGroup('professional', [
                        'Krishna Das',
                        'Hari Priya Das',
                        'Nimai Pandit Das'
                    ], formData.professional)}
                </div>

                {/* Q37 */}
                <div className="space-y-2">
                    {qLabel(37, 'Con fines educativos las sesiones pueden ser grabadas y observadas por alumnos de nuestra escuela')}
                    {radioGroup('recordingConsent', [
                        'Sí deseo apoyar a los alumnos de VEDAMCI',
                        'No deseo que mis consultas sean estudiadas'
                    ], formData.recordingConsent)}
                </div>

                {/* Q38 */}
                <div className="space-y-2">
                    {qLabel(38, 'Permito que durante la consulta online, alumnos que están aprendiendo puedan estar de oyentes. Si nos apoyas recibirás un bono de $200 pesos que podrás utilizar en futuras consultas o productos Ayurvédicos')}
                    {radioGroup('studentListeners', ['Sí', 'No'], formData.studentListeners)}
                </div>

                {/* Commitment slider */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold">Compromiso (1-10)</label>
                    <div className="flex items-center gap-4">
                        <input type="range" min="1" max="10" name="commitment" value={formData.commitment} onChange={handleChange} className="flex-1 accent-primary" />
                        <span className="font-bold text-xl text-primary">{formData.commitment}</span>
                    </div>
                </div>

                {!isInternal && (
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                name="dataProtection"
                                checked={formData.dataProtection}
                                onChange={handleChange}
                                className="mt-1 w-5 h-5 rounded text-primary focus:ring-primary border-slate-300"
                            />
                            <span className="text-sm text-slate-600">Acepto la política de protección de datos y el aviso de privacidad.</span>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                name="consent"
                                checked={formData.consent}
                                onChange={handleChange}
                                className="mt-1 w-5 h-5 rounded text-primary focus:ring-primary border-slate-300"
                            />
                            <span className="text-sm text-slate-600">
                                <strong>Consentimiento Informado:</strong> Entiendo que esta es una consulta de asesoría de salud basada en Ayurveda y no sustituye tratamiento médico de emergencia. Leí y estoy de acuerdo.
                            </span>
                        </label>
                    </div>
                )}

                <div className="pt-6 flex justify-end">
                    <Button type="submit" className="w-full md:w-auto px-8 py-3 text-lg font-bold" disabled={status === 'loading'}>
                        {status === 'loading' ? 'Guardando...' : 'Enviar Formulario'} <Save className="ml-2" />
                    </Button>
                </div>
            </Card>
        </form>
    );

    if (isInternal) {
        return (
            <div className="w-full">
                {status === 'success' ? successContent : (
                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-4 items-start">
                        <div className="order-last xl:order-first min-w-0">
                            {formContent}
                        </div>
                        {professionalNotesPanel}
                    </div>
                )}
            </div>
        );
    }

    return (
        <PublicLayout>
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Ficha de Ingreso Ayurvédica</h1>
                    <p className="text-slate-500 mt-2">Por favor, completa esta información con la mayor sinceridad posible para prepararnos para tu consulta.</p>
                </div>
                {status === 'success' ? successContent : formContent}
            </div>
        </PublicLayout>
    );
}
