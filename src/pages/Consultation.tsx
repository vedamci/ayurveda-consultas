import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Save, ChevronRight, Activity, ChevronLeft, User, Calendar } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { VerticalStepper } from '../components/consultation/VerticalStepper';

const initialSteps = [
    { id: 'details', label: 'Datos del Paciente', status: 'current' },
    { id: 'reason', label: 'Motivo de Consulta', status: 'pending' },
    { id: 'agni', label: 'Agni y Digestión', status: 'pending' },
    { id: 'sleep', label: 'Sueño y Descanso', status: 'pending' },
    { id: 'energy', label: 'Energía y Ojas', status: 'pending' },
];

const agniOptions = [
    { value: 'sama', label: 'Sama (Equilibrado)', desc: 'Hambre regular, buena digestión a tiempo' },
    { value: 'vishama', label: 'Vishama (Irregular)', desc: 'Apetito variable, gases, hinchazón' },
    { value: 'tikshna', label: 'Tikshna (Agudo)', desc: 'Hambre intensa, acidez, irritabilidad' },
    { value: 'manda', label: 'Manda (Lento)', desc: 'Digestión lenta, pesadez post-comida' },
];

export default function Consultation() {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [steps, setSteps] = useState(initialSteps);
    const [patientData, setPatientData] = useState({
        name: '',
        age: '',
        gender: '',
        dosha: ''
    });
    const [agniType, setAgniType] = useState('vishama');
    const [observations, setObservations] = useState('');

    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) {
            setSteps(prev => prev.map((step, idx) => {
                if (idx === currentStepIndex) return { ...step, status: 'completed' };
                if (idx === currentStepIndex + 1) return { ...step, status: 'current' };
                return step;
            }));
            setCurrentStepIndex(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStepIndex > 0) {
            setSteps(prev => prev.map((step, idx) => {
                if (idx === currentStepIndex) return { ...step, status: 'pending' };
                if (idx === currentStepIndex - 1) return { ...step, status: 'current' };
                return step;
            }));
            setCurrentStepIndex(prev => prev - 1);
        }
    };

    const updatePatient = (field: string, value: string) => {
        setPatientData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        try {
            const payload = {
                patientName: patientData.name,
                age: patientData.age,
                dosha: patientData.dosha,
                reason: observations, // Using observations as the main reason for now
                agniType: agniType,
                observations: observations
            };

            const response = await fetch('/api/consultation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                const data = await response.json();
                alert('Consulta guardada en Notion con éxito. ID: ' + data.id);
            } else {
                const errorData = await response.json();
                alert('Error al guardar: ' + errorData.error);
            }
        } catch (error) {
            console.error('Error saving to Notion:', error);
            alert('Error de conexión con el servidor.');
        }
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const response = await fetch(`/api/patients/search?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data.success) {
                setSearchResults(data.results);
            }
        } catch (error) {
            console.error('Error searching:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const selectPatient = async (patientId: string) => {
        try {
            const response = await fetch(`/api/patients/${patientId}`);
            const data = await response.json();

            if (data.success && data.patient) {
                setPatientData({
                    name: data.patient.name,
                    age: data.patient.age || '',
                    gender: '', // Not in basic map yet
                    dosha: data.patient.dosha || ''
                });
                // Pre-fill observations with the intake form notes
                setObservations(data.patient.fullNotes || '');
                setShowSearch(false);
                setSearchQuery('');
            }
        } catch (error) {
            console.error('Error fetching patient details:', error);
        }
    };

    return (
        <DashboardLayout>
            <div className="grid grid-cols-12 gap-8 h-[calc(100vh-8rem)]">

                {/* Left Column: Patient Profile & Stepper (3 cols) */}
                <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
                    <Card className="flex items-center gap-4 relative overflow-visible">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${patientData.name ? 'text-primary' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                            style={patientData.name ? {
                                background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(212,168,83,0.08) 100%)',
                                borderColor: 'rgba(34,197,94,0.15)'
                            } : undefined}
                        >
                            {patientData.name ? (
                                <span className="font-bold text-lg">{patientData.name.charAt(0).toUpperCase()}</span>
                            ) : (
                                <User size={22} />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 truncate">{patientData.name || 'Nuevo Paciente'}</h4>
                            <div className="flex items-center gap-2 mt-1">
                                {patientData.dosha ? (
                                    <Badge variant="warning">{patientData.dosha}</Badge>
                                ) : (
                                    <span className="text-xs text-slate-400 italic">Sin datos</span>
                                )}
                                {patientData.age && <span className="text-xs text-slate-400">{patientData.age} años</span>}
                            </div>
                        </div>
                        <button
                            onClick={() => setShowSearch(!showSearch)}
                            className="absolute top-2 right-2 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors"
                            title="Buscar Paciente"
                        >
                            <Sparkles size={16} />
                        </button>

                        {/* Search Dropdown */}
                        <AnimatePresence>
                            {showSearch && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowSearch(false)}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-2 max-h-80 flex flex-col"
                                    >
                                        <input
                                            autoFocus
                                            placeholder="Buscar por nombre..."
                                            className="w-full p-3 text-sm border-b border-slate-100 focus:outline-none mb-2 bg-transparent"
                                            value={searchQuery}
                                            onChange={(e) => handleSearch(e.target.value)}
                                        />
                                        <div className="max-h-60 overflow-y-auto">
                                            {isSearching ? (
                                                <div className="p-4 text-center text-xs text-slate-400">Buscando...</div>
                                            ) : searchResults.length > 0 ? (
                                                searchResults.map((p: any) => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => selectPatient(p.id)}
                                                        className="w-full text-left p-2 hover:bg-slate-50 rounded-lg text-sm"
                                                    >
                                                        <div className="font-bold text-slate-900">{p.name}</div>
                                                        <div className="text-xs text-slate-500">{p.email}</div>
                                                    </button>
                                                ))
                                            ) : searchQuery.length > 1 ? (
                                                <div className="p-4 text-center text-xs text-slate-400">No se encontraron pacientes.</div>
                                            ) : null}
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </Card>

                    <div className="pl-2">
                        <VerticalStepper steps={steps as any} currentStepIndex={currentStepIndex} />
                    </div>
                </div>

                {/* Center Column: Assessment Form (6 cols) */}
                <div className="col-span-12 lg:col-span-6 flex flex-col">
                    <Card className="flex-1 flex flex-col relative overflow-hidden">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {steps[currentStepIndex].label}
                                </h2>
                                <p className="text-slate-400 mt-1 text-sm">
                                    {currentStepIndex === 0 ? 'Ingrese los datos básicos del paciente.' : 'Evaluación del estado actual y equilibrio dóshico.'}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(212,168,83,0.06) 100%)',
                                    border: '1px solid rgba(34,197,94,0.1)'
                                }}
                            >
                                {currentStepIndex === 0 ? <User size={18} className="text-primary" /> : <Activity size={18} className="text-primary" />}
                            </div>
                        </div>

                        <form className="space-y-8 flex-1 overflow-y-auto pr-2 custom-scrollbar">

                            {/* Step 0: Patient Details */}
                            {currentStepIndex === 0 && (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Nombre Completo</label>
                                        <input
                                            type="text"
                                            className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm placeholder:text-slate-400 focus:outline-none"
                                            placeholder="Ej: Juan Pérez"
                                            value={patientData.name}
                                            onChange={(e) => updatePatient('name', e.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Edad</label>
                                            <input
                                                type="text"
                                                className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm placeholder:text-slate-400 focus:outline-none"
                                                placeholder="Ej: 34"
                                                value={patientData.age}
                                                onChange={(e) => updatePatient('age', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Prakriti (Opcional)</label>
                                            <input
                                                type="text"
                                                className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm placeholder:text-slate-400 focus:outline-none"
                                                placeholder="Ej: Vata-Pitta"
                                                value={patientData.dosha}
                                                onChange={(e) => updatePatient('dosha', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Agni (Index 2 now) */}
                            {currentStepIndex === 2 ? (
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Estado de Agni Principal</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {agniOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setAgniType(option.value)}
                                                className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group ${agniType === option.value
                                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                    : 'border-slate-200 hover:border-primary/30 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="font-bold text-gray-900 mb-1">{option.label}</div>
                                                <div className="text-xs text-slate-500 line-clamp-2">
                                                    {option.desc}
                                                </div>
                                                {agniType === option.value && (
                                                    <motion.div
                                                        layoutId="check"
                                                        className="absolute top-3 right-3 text-primary"
                                                    >
                                                        <Activity size={16} />
                                                    </motion.div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {/* Step 1: Observations */}
                            {currentStepIndex === 1 && (
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Motivo Principal</label>
                                    <textarea
                                        className="w-full h-32 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none text-sm placeholder:text-slate-400 focus:outline-none"
                                        placeholder="Describa la razón principal de la visita..."
                                        value={observations}
                                        onChange={(e) => setObservations(e.target.value)}
                                    />
                                    <div className="flex gap-2 flex-wrap">
                                        {['#Dolor', '#Digestión', '#Estrés', '#Insomnio', '#Piel'].map(tag => (
                                            <button key={tag} type="button" className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600 hover:border-primary hover:text-primary transition-colors">
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Placeholder for other steps */}
                            {currentStepIndex > 2 && (
                                <div className="flex items-center justify-center h-48 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                                    Contenido del paso {currentStepIndex + 1} (Demo)
                                </div>
                            )}
                        </form>

                        <div className="pt-6 border-t border-slate-100 flex items-center justify-between mt-auto bg-white">
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                                <Save size={14} />
                                <span>Autoguardado</span>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="ghost" onClick={handleBack} disabled={currentStepIndex === 0} className="gap-2">
                                    <ChevronLeft size={16} /> Atrás
                                </Button>
                                {currentStepIndex === steps.length - 1 ? (
                                    <Button onClick={handleSave} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                                        Finalizar y Guardar <Save size={16} />
                                    </Button>
                                ) : (
                                    <Button onClick={handleNext} className="gap-2">
                                        Siguiente <ChevronRight size={16} />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Right Column: Live Reasoning (3 cols) */}
                <div className="col-span-12 lg:col-span-3 space-y-6">
                    <Card noPadding className="border-0 overflow-hidden" style={{
                        background: 'linear-gradient(180deg, #0d1a13 0%, #07110c 100%)',
                        border: '1px solid rgba(255,255,255,0.04)'
                    }}>
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-5">
                                <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
                                    <Sparkles size={12} className="text-primary" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">Razonamiento en Vivo</span>
                            </div>

                            <AnimatePresence mode="wait">
                                {currentStepIndex === 2 && agniType === 'vishama' && (
                                    <motion.div
                                        key="vishama"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="space-y-4"
                                    >
                                        <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                                            <h5 className="font-bold text-sm mb-1.5 text-emerald-300">Agravación Vata</h5>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                El apetito irregular (Vishama Agni) se correlaciona directamente con el desequilibrio de Vata.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                                {currentStepIndex === 0 && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-xs text-slate-500 italic text-center py-6"
                                    >
                                        Ingrese datos del paciente para comenzar el análisis.
                                    </motion.div>
                                )}
                                {currentStepIndex === 1 && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="space-y-4"
                                    >
                                        <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                                            <h5 className="font-bold text-sm mb-1.5 text-blue-300">Análisis Sintomático</h5>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                El sistema analizará palabras clave como "{observations.split(' ')[0] || '...'}" para sugerir patologías.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </Card>

                    <Card>
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-4">Resumen del Caso</h4>
                        <ul className="space-y-4">
                            <li className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
                                    <User size={14} className="text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Paciente</p>
                                    <p className="text-sm font-semibold text-slate-700">{patientData.name || 'Nuevo Paciente'}</p>
                                </div>
                            </li>
                            <li className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
                                    <Calendar size={14} className="text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Fecha</p>
                                    <p className="text-sm font-semibold text-slate-700">{new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</p>
                                </div>
                            </li>
                        </ul>
                    </Card>
                </div>

            </div>
        </DashboardLayout>
    );
}
