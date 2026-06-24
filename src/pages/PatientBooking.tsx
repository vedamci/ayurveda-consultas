import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, User, Mail, Phone, MessageSquare, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';
import { PublicLayout } from '../layouts/PublicLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

interface Slot {
    date: string;
    start: string;
    end: string;
    timeLabel: string;
}

type AppointmentType = 'initial' | 'followup';

const getTomorrowDateString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function PatientBooking() {
    const { user } = useAuth();
    const [slots, setSlots] = useState<Slot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Wizard Steps: 1 = Date/Time, 2 = Info Form, 3 = Confirmation
    const [step, setStep] = useState(1);
    
    // Selections
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

    // Admin Mode States
    const queryParams = new URLSearchParams(window.location.search);
    const isAdminLink = queryParams.get('admin') === 'true';
    const canUseAdminMode = isAdminLink || user?.role === 'admin';
    
    const [useCustomTime, setUseCustomTime] = useState(isAdminLink);
    const [adminModeInitialized, setAdminModeInitialized] = useState(isAdminLink);
    const [customDate, setCustomDate] = useState(() => isAdminLink ? getTomorrowDateString() : '');
    const [customStartTime, setCustomStartTime] = useState('10:00');
    const [customEndTime, setCustomEndTime] = useState('11:00');
    const isUsingCustomTime = canUseAdminMode && useCustomTime;
    const [appointmentType, setAppointmentType] = useState<AppointmentType>('initial');
    const appointmentTypeLabel = appointmentType === 'followup' ? 'Visita de seguimiento' : 'Consulta inicial';
    const shouldRequestClinicalForm = appointmentType === 'initial' && !canUseAdminMode;

    // Form fields
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        notes: ''
    });
    const [bookingLoading, setBookingLoading] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        fetchSlots();
    }, []);

    useEffect(() => {
        if (!canUseAdminMode || adminModeInitialized) return;
        setUseCustomTime(true);
        setAdminModeInitialized(true);
        setCustomDate(prev => prev || getTomorrowDateString());
        setSelectedSlot(null);
        setValidationError(null);
    }, [canUseAdminMode, adminModeInitialized]);

    const fetchSlots = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('/api/calendar/free-slots');
            const data = await response.json();
            
            if (data.success) {
                setSlots(data.slots || []);
                // Default select first date if available
                if (data.slots && data.slots.length > 0) {
                    const uniqueDates = Array.from(new Set(data.slots.map((s: Slot) => s.date))).sort() as string[];
                    if (uniqueDates.length > 0) {
                        setSelectedDate(uniqueDates[0]);
                    }
                }
            } else {
                setError(data.error || 'No se pudieron obtener los espacios disponibles.');
            }
        } catch (err: any) {
            console.error('Error fetching free slots:', err);
            setError('Error al conectar con el servidor. Por favor, intenta de nuevo más tarde.');
        } finally {
            setLoading(false);
        }
    };

    // Group slots by date
    const slotsByDate: Record<string, Slot[]> = {};
    slots.forEach(slot => {
        if (!slotsByDate[slot.date]) {
            slotsByDate[slot.date] = [];
        }
        slotsByDate[slot.date].push(slot);
    });

    const uniqueDates = Object.keys(slotsByDate).sort();

    // Helper to format date in Spanish beautifully
    const formatSlotDate = (dateString: string) => {
        const [year, month, day] = dateString.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        
        const weekday = dateObj.toLocaleDateString('es-MX', { weekday: 'short' });
        const dayNum = dateObj.getDate();
        const monthName = dateObj.toLocaleDateString('es-MX', { month: 'short' });
        
        return {
            weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1).replace('.', ''),
            dayNum,
            monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1).replace('.', '')
        };
    };

    const handleDateSelect = (dateStr: string) => {
        setSelectedDate(dateStr);
        setSelectedSlot(null); // Reset selected slot when date changes
    };

    const handleSlotSelect = (slot: Slot) => {
        setSelectedSlot(slot);
    };

    const ensureCustomDate = () => {
        if (customDate) return;
        setCustomDate(getTomorrowDateString());
    };

    const handleAdminModeToggle = () => {
        const nextValue = !useCustomTime;
        setUseCustomTime(nextValue);
        setSelectedSlot(null);
        setValidationError(null);
        if (nextValue) {
            ensureCustomDate();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNextStep = () => {
        if (isUsingCustomTime) {
            if (!customDate || !customStartTime || !customEndTime) {
                setValidationError('Por favor introduce la fecha y horas para el agendamiento.');
                return;
            }
            if (new Date(`${customDate}T${customEndTime}:00`) <= new Date(`${customDate}T${customStartTime}:00`)) {
                setValidationError('La hora de fin debe ser posterior a la hora de inicio.');
                return;
            }
            setSelectedSlot({
                date: customDate,
                start: `${customDate}T${customStartTime}:00`,
                end: `${customDate}T${customEndTime}:00`,
                timeLabel: `${customStartTime} - ${customEndTime}`
            });
            setValidationError(null);
            setStep(2);
        } else {
            if (!selectedSlot) {
                setValidationError('Por favor selecciona un horario de consulta para continuar.');
                return;
            }
            setValidationError(null);
            setStep(2);
        }
    };

    const handlePrevStep = () => {
        setValidationError(null);
        setStep(1);
    };

    const handleBook = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError(null);

        // Validation
        if (!formData.name.trim()) {
            setValidationError('El nombre completo es requerido.');
            return;
        }
        if (!formData.email.trim()) {
            setValidationError('El correo electrónico es requerido.');
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setValidationError('Por favor introduce un correo electrónico válido.');
            return;
        }
        if (!formData.phone.trim()) {
            setValidationError('El celular es requerido.');
            return;
        }
        if (!selectedSlot) {
            setValidationError('No hay un horario de consulta seleccionado.');
            return;
        }

        try {
            setBookingLoading(true);
            const response = await fetch('/api/calendar/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    start: selectedSlot.start,
                    end: selectedSlot.end,
                    appointmentType,
                    bookingMode: canUseAdminMode ? 'admin' : 'patient',
                    notes: formData.notes
                })
            });

            const data = await response.json();
            if (data.success) {
                setStep(3);
            } else {
                setValidationError(data.error || 'Ocurrió un error al agendar la cita. Por favor, intenta de nuevo.');
            }
        } catch (err) {
            console.error('Error booking event:', err);
            setValidationError('Error de red. No pudimos agendar tu cita, intenta nuevamente.');
        } finally {
            setBookingLoading(false);
        }
    };

    const getSpanishFullDateString = (dateString: string, timeLabel: string) => {
        const [year, month, day] = dateString.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const dayLong = dateObj.toLocaleDateString('es-MX', { weekday: 'long' });
        const monthLong = dateObj.toLocaleDateString('es-MX', { month: 'long' });
        const timeText = timeLabel.includes(' - ') ? `de ${timeLabel} hrs` : `a las ${timeLabel} hrs`;
        
        return `${dayLong.charAt(0).toUpperCase() + dayLong.slice(1)}, ${day} de ${monthLong} ${timeText}`;
    };

    return (
        <PublicLayout title="VEDAMCONSULTATION" subtitle="Agenda de Citas">
            <div className="w-full max-w-2xl mx-auto">
                {/* Logo and Header info */}
                <div className="text-center mb-8">
                    <img 
                        src="/LOGO_2020_VEDAMCI.png" 
                        alt="Logo VEDAMCI" 
                        className="h-16 mx-auto mb-4 object-contain"
                        onError={(e) => {
                            // If logo fails to load, hide it
                            (e.target as HTMLElement).style.display = 'none';
                        }}
                    />
                    <h2 className="text-2xl font-bold text-slate-850 tracking-tight">Agenda tu Consulta</h2>
                    <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                        Selecciona el horario de tu preferencia para la sesión de valoración. Todas las citas son virtuales en hora de Ciudad de México (GMT-6).
                    </p>
                </div>

                {/* Steps Indicator */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${step >= 1 ? 'bg-primary/10 text-primary-600' : 'bg-slate-100 text-slate-400'}`}>
                        <span className="w-4 h-4 rounded-full bg-primary/20 text-[10px] flex items-center justify-center">1</span>
                        <span>Horario</span>
                    </div>
                    <div className="w-8 h-px bg-slate-200" />
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${step >= 2 ? 'bg-primary/10 text-primary-600' : 'bg-slate-100 text-slate-400'}`}>
                        <span className="w-4 h-4 rounded-full bg-slate-200 text-[10px] flex items-center justify-center text-slate-500">2</span>
                        <span>Mis Datos</span>
                    </div>
                    <div className="w-8 h-px bg-slate-200" />
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${step === 3 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        <span className="w-4 h-4 rounded-full bg-slate-200 text-[10px] flex items-center justify-center text-slate-500">3</span>
                        <span>Confirmación</span>
                    </div>
                </div>

                {/* Error Banner */}
                {validationError && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
                            <AlertCircle className="shrink-0 text-red-500" size={18} />
                            <span>{validationError}</span>
                        </div>
                    </motion.div>
                )}

                {/* Wizard Steps Contents */}
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {/* Admin Mode Banner */}
                            {canUseAdminMode && (
                                <Card className={`border p-4 mb-2 ${useCustomTime ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-1.5">
                                                <ShieldCheck size={16} className="text-amber-600" />
                                                <span>Modo Administrador {useCustomTime ? 'Activo' : 'Inactivo'}</span>
                                            </div>
                                            <p className="text-slate-600 text-xs">
                                                {useCustomTime
                                                    ? 'Puedes programar una consulta en cualquier fecha y hora libremente, sin depender de días u horarios configurados.'
                                                    : 'El calendario está usando los horarios disponibles normales para pacientes.'}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant={useCustomTime ? 'outline' : 'primary'}
                                            size="sm"
                                            onClick={handleAdminModeToggle}
                                            aria-pressed={useCustomTime}
                                            className="shrink-0"
                                        >
                                            {useCustomTime ? 'Desactivar modo admin' : 'Activar modo admin'}
                                        </Button>
                                    </div>
                                </Card>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                                    Tipo de cita
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setAppointmentType('initial')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            appointmentType === 'initial'
                                                ? 'bg-primary-100 border-primary text-primary-700 shadow-sm'
                                                : 'bg-white border-slate-100 text-slate-700 hover:border-slate-300'
                                        }`}
                                    >
                                        <span className="block text-sm font-bold">Consulta inicial</span>
                                        <span className="block text-xs mt-0.5 text-slate-500">
                                            Con formulario clínico para pacientes nuevos
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAppointmentType('followup')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            appointmentType === 'followup'
                                                ? 'bg-primary-100 border-primary text-primary-700 shadow-sm'
                                                : 'bg-white border-slate-100 text-slate-700 hover:border-slate-300'
                                        }`}
                                    >
                                        <span className="block text-sm font-bold">Seguimiento</span>
                                        <span className="block text-xs mt-0.5 text-slate-500">
                                            Agenda sin pedir formulario clínico
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {isUsingCustomTime ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Fecha</label>
                                            <input
                                                type="date"
                                                required
                                                value={customDate}
                                                onChange={(e) => setCustomDate(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-primary text-sm transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Hora de Inicio</label>
                                            <input
                                                type="time"
                                                required
                                                value={customStartTime}
                                                onChange={(e) => {
                                                    setCustomStartTime(e.target.value);
                                                    const [h, m] = e.target.value.split(':').map(Number);
                                                    const newH = (h + 1) % 24;
                                                    setCustomEndTime(`${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                                                }}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-primary text-sm transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Hora de Fin</label>
                                            <input
                                                type="time"
                                                required
                                                value={customEndTime}
                                                onChange={(e) => setCustomEndTime(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-primary text-sm transition-colors"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-6">
                                        <div className="text-left">
                                            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Horario Personalizado</p>
                                            <p className="text-sm font-bold text-slate-800 mt-0.5">
                                                {customDate && customStartTime ? getSpanishFullDateString(customDate, `${customStartTime} - ${customEndTime}`) : 'No configurado'}
                                            </p>
                                        </div>
                                        <Button onClick={handleNextStep} className="flex items-center gap-1.5">
                                            <span>Continuar</span>
                                            <ArrowRight size={16} />
                                        </Button>
                                    </div>
                                </div>
                            ) : loading ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3">
                                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                    <p className="text-slate-400 text-sm">Consultando espacios disponibles...</p>
                                </div>
                            ) : error ? (
                                <Card className="p-8 text-center border-dashed border-2 border-red-100 bg-red-50/10">
                                    <AlertCircle className="mx-auto text-red-400 mb-3" size={32} />
                                    <h3 className="font-bold text-slate-800 text-base">Servicio no disponible</h3>
                                    <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">{error}</p>
                                    <Button variant="outline" size="sm" className="mt-4" onClick={fetchSlots}>
                                        Reintentar
                                    </Button>
                                </Card>
                            ) : uniqueDates.length === 0 ? (
                                <Card className="p-8 text-center border-dashed border-2 border-slate-200 bg-slate-50/30">
                                    <Calendar className="mx-auto text-slate-400 mb-3" size={32} />
                                    <h3 className="font-bold text-slate-700 text-base">Sin horarios disponibles</h3>
                                    <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                                        No encontramos horarios libres programados para las siguientes tres semanas. Por favor, ponte en contacto con la clínica.
                                    </p>
                                </Card>
                            ) : (
                                <div className="space-y-6">
                                    {/* Date Carousel Selector */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                                            1. Selecciona el Día
                                        </label>
                                        <div className="flex gap-2 overflow-x-auto pb-3 custom-scrollbar snap-x snap-mandatory">
                                            {uniqueDates.map(dateStr => {
                                                const formatted = formatSlotDate(dateStr);
                                                const isSelected = selectedDate === dateStr;
                                                return (
                                                    <button
                                                        key={dateStr}
                                                        onClick={() => handleDateSelect(dateStr)}
                                                        className={`snap-center flex-shrink-0 w-20 py-3.5 px-2 rounded-xl flex flex-col items-center justify-center transition-all border ${
                                                            isSelected 
                                                                ? 'bg-primary border-primary text-white shadow-md shadow-primary/20 scale-[1.02]' 
                                                                : 'bg-white border-slate-100 hover:border-slate-300 text-slate-600 hover:text-slate-800'
                                                        }`}
                                                    >
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                                                            {formatted.weekday}
                                                        </span>
                                                        <span className="text-2xl font-extrabold mt-1 tracking-tight">
                                                            {formatted.dayNum}
                                                        </span>
                                                        <span className={`text-[10px] font-medium mt-1 ${isSelected ? 'text-white/90' : 'text-slate-400'}`}>
                                                            {formatted.monthName}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Time Slots Grid */}
                                    {selectedDate && (
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                                                2. Selecciona la Hora
                                            </label>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                                                {slotsByDate[selectedDate]?.map((slot, index) => {
                                                    const isSelected = selectedSlot?.start === slot.start;
                                                    return (
                                                        <button
                                                            key={index}
                                                            onClick={() => handleSlotSelect(slot)}
                                                            className={`py-3 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-sm font-semibold ${
                                                                isSelected 
                                                                    ? 'bg-primary-100 border-primary text-primary-600 font-bold scale-[1.01]' 
                                                                    : 'bg-white border-slate-100 hover:border-slate-300 text-slate-700'
                                                            }`}
                                                        >
                                                            <Clock size={14} className={isSelected ? 'text-primary-600' : 'text-slate-400'} />
                                                            <span>{slot.timeLabel}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action footer */}
                                    {selectedSlot && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-center justify-between border-t border-slate-100 pt-5 mt-6"
                                        >
                                            <div className="text-left">
                                                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Horario Seleccionado</p>
                                                <p className="text-sm font-bold text-slate-800 mt-0.5">
                                                    {getSpanishFullDateString(selectedSlot.date, selectedSlot.timeLabel)}
                                                </p>
                                            </div>
                                            <Button onClick={handleNextStep} className="flex items-center gap-1.5">
                                                <span>Continuar</span>
                                                <ArrowRight size={16} />
                                            </Button>
                                        </motion.div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {step === 2 && selectedSlot && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <form onSubmit={handleBook} className="space-y-6">
                                {/* Back link and Slot Summary */}
                                <div className="flex flex-col gap-3">
                                    <button
                                        type="button"
                                        onClick={handlePrevStep}
                                        className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 self-start transition-colors"
                                    >
                                        <ArrowLeft size={14} />
                                        <span>Volver a seleccionar horario</span>
                                    </button>
                                    
                                    <Card className="bg-slate-50 border-slate-100 p-4 flex items-center gap-3">
                                        <div className="p-2.5 bg-primary/10 rounded-xl text-primary-600">
                                            <Calendar size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{appointmentTypeLabel}</p>
                                            <p className="text-sm font-bold text-slate-800">
                                                {getSpanishFullDateString(selectedSlot.date, selectedSlot.timeLabel)}
                                            </p>
                                        </div>
                                    </Card>
                                </div>

                                {/* Form Fields */}
                                <div className="space-y-4">
                                    {/* Nombre Completo */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                            Nombre Completo *
                                        </label>
                                        <div className="relative">
                                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                type="text"
                                                name="name"
                                                required
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                placeholder="Ej. María González López"
                                                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary text-sm transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                            Correo Electrónico *
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                type="email"
                                                name="email"
                                                required
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                placeholder="Ej. maria@correo.com"
                                                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary text-sm transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {/* Teléfono */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                            Celular / WhatsApp *
                                        </label>
                                        <div className="relative">
                                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                type="tel"
                                                name="phone"
                                                required
                                                value={formData.phone}
                                                onChange={handleInputChange}
                                                placeholder="Ej. 5512345678"
                                                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary text-sm transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {/* Motivo de Consulta */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                            {appointmentType === 'followup' ? 'Notas de seguimiento (Opcional)' : 'Motivo de Consulta (Opcional)'}
                                        </label>
                                        <div className="relative">
                                            <MessageSquare className="absolute left-3.5 top-3 text-slate-400" size={16} />
                                            <textarea
                                                name="notes"
                                                rows={3}
                                                value={formData.notes}
                                                onChange={handleInputChange}
                                                placeholder={appointmentType === 'followup'
                                                    ? 'Agrega notas breves para esta visita de seguimiento.'
                                                    : 'Describe brevemente tus síntomas principales o el motivo de tu consulta ayurvédica.'}
                                                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary text-sm transition-colors resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Form Actions */}
                                <div className="border-t border-slate-100 pt-5 flex justify-end">
                                    <Button
                                        type="submit"
                                        disabled={bookingLoading}
                                        className="w-full sm:w-auto shimmer-btn px-6 font-bold"
                                    >
                                        {bookingLoading ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                <span>Confirmando cita...</span>
                                            </div>
                                        ) : (
                                            appointmentType === 'followup' ? 'Agendar Seguimiento' : 'Agendar Cita Ayurvédica'
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {step === 3 && selectedSlot && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="border border-emerald-500/10 bg-emerald-50/10 p-8 text-center">
                                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-500/20 flex items-center justify-center mx-auto mb-4 shadow-sm animate-bounce">
                                    <CheckCircle2 size={32} />
                                </div>

                                <h3 className="text-xl font-bold text-slate-900">¡Cita Agendada con Éxito!</h3>
                                <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
                                    Tu {appointmentType === 'followup' ? 'visita de seguimiento' : 'consulta de Ayurveda'} se ha registrado directamente en nuestra agenda de Google Calendar.
                                    Hemos enviado un correo electrónico de confirmación con la invitación y los detalles a <span className="font-bold text-slate-800">{formData.email}</span>.
                                </p>

                                <div className="my-6 max-w-sm mx-auto bg-white border border-slate-100 p-5 rounded-2xl shadow-sm text-left">
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-2.5">
                                            <CheckCircle2 className="text-primary-600 shrink-0 mt-0.5" size={16} />
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipo de cita</p>
                                                <p className="text-sm font-bold text-slate-800">{appointmentTypeLabel}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-2.5">
                                            <Calendar className="text-primary-600 shrink-0 mt-0.5" size={16} />
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paciente</p>
                                                <p className="text-sm font-bold text-slate-800">{formData.name}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-start gap-2.5">
                                            <Clock className="text-primary-600 shrink-0 mt-0.5" size={16} />
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fecha y Hora</p>
                                                <p className="text-sm font-bold text-slate-800">
                                                    {getSpanishFullDateString(selectedSlot.date, selectedSlot.timeLabel)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {shouldRequestClinicalForm ? (
                                    <div className="border-t border-slate-100 pt-6 mt-6 space-y-4">
                                        <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20 text-left">
                                            <h4 className="font-bold text-primary-700 text-sm flex items-center gap-1.5">
                                                <AlertCircle size={16} className="text-primary" />
                                                Acción Requerida: Formulario Clínico de Ingreso
                                            </h4>
                                            <p className="text-slate-600 text-xs mt-1.5 leading-relaxed">
                                                Para que el médico pueda valorar tu caso a profundidad, es indispensable que completes tu historial clínico antes de la consulta. Tus datos ingresados ya se encuentran listos para ser pre-llenados.
                                            </p>
                                        </div>
                                        
                                        <a
                                            href={`/ingreso-paciente?patientName=${encodeURIComponent(formData.name)}&email=${encodeURIComponent(formData.email)}&phone=${encodeURIComponent(formData.phone)}`}
                                            className="w-full inline-flex items-center justify-center bg-primary hover:bg-primary-600 text-white font-bold text-sm py-3 px-6 rounded-xl transition-all shadow-md shadow-primary/10 hover:scale-[1.01] animate-pulse"
                                        >
                                            <span>Completar Formulario Clínico de Ingreso</span>
                                            <ArrowRight size={16} className="ml-1.5" />
                                        </a>
                                    </div>
                                ) : (
                                    <div className="border-t border-slate-100 pt-6 mt-6">
                                        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 text-left">
                                            <h4 className="font-bold text-emerald-700 text-sm flex items-center gap-1.5">
                                                <CheckCircle2 size={16} className="text-emerald-600" />
                                                Sin formulario clínico requerido
                                            </h4>
                                            <p className="text-slate-600 text-xs mt-1.5 leading-relaxed">
                                                {canUseAdminMode
                                                    ? 'La cita fue creada desde modo administrador y no solicitará el formulario clínico al paciente.'
                                                    : 'Esta visita de seguimiento quedó agendada sin solicitar formulario clínico adicional.'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </PublicLayout>
    );
}
