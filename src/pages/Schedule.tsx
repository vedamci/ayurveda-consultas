import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Calendar as CalendarIcon, 
    Clock, 
    User, 
    FileText, 
    AlertCircle, 
    ExternalLink, 
    RefreshCw,
    Settings,
    Eye,
    EyeOff,
    Save,
    LogOut,
    HelpCircle,
    CheckCircle2,
    Edit2,
    Trash2,
    Copy,
    Check,
    List,
    Grid,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { DashboardLayout } from '../layouts/DashboardLayout';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};



interface CalendarEvent {
    id: string;
    summary: string;
    description?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    htmlLink: string;
    attendees?: Array<{ email: string; displayName?: string; self?: boolean }>;
}

const isEventCanceled = (summary?: string, description?: string) => {
    const s = (summary || '').toLowerCase();
    const d = (description || '').toLowerCase();
    return s.startsWith('canceled:') || 
           s.startsWith('cancelled:') || 
           s.startsWith('cancelado:') ||
           s.includes('cancelado') ||
           d.includes('cancellation reason:') ||
           d.includes('motivo de cancelación:');
};

const getDefaultCalendarRedirectUri = () => {
    const currentPort = window.location.port;
    const isLocalDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (!isLocalDevelopment) {
        return `${window.location.origin}/api/calendar/auth/callback`;
    }

    const backendPort = currentPort === '5174' ? '3001' : '3000';
    return `${window.location.protocol}//${window.location.hostname}:${backendPort}/api/calendar/auth/callback`;
};

export default function Schedule() {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Google Calendar configuration states
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [calendarId, setCalendarId] = useState('primary');
    const [redirectUri, setRedirectUri] = useState(getDefaultCalendarRedirectUri);
    const [isConnected, setIsConnected] = useState(false);
    const [hasClientSecret, setHasClientSecret] = useState(false);
    const [bookingLink, setBookingLink] = useState('');
    const [copied, setCopied] = useState(false);

    const handleCopyLink = () => {
        const linkToCopy = bookingLink || `${window.location.origin}/reservar`;
        navigator.clipboard.writeText(linkToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // UI toggle states
    const [showConfig, setShowConfig] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [configError, setConfigError] = useState<string | null>(null);
    const [configSuccess, setConfigSuccess] = useState<string | null>(null);

    // Availability & blocking config states
    const [allowedDays, setAllowedDays] = useState('1,2,3,4,5');
    const [allowedHours, setAllowedHours] = useState('9,10,11,12,13,14,15,16,17');
    const [blockedDates, setBlockedDates] = useState('');

    // Calendar view toggle states
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [gridYear, setGridYear] = useState(new Date().getFullYear());
    const [gridMonth, setGridMonth] = useState(new Date().getMonth());

    // Event editing states
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [editSummary, setEditSummary] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editStartTime, setEditStartTime] = useState('');
    const [editEndTime, setEditEndTime] = useState('');
    const [isSavingEvent, setIsSavingEvent] = useState(false);
    const [isDeletingEvent, setIsDeletingEvent] = useState(false);

    const openEditModal = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setEditSummary(event.summary || '');
        setEditDescription(event.description || '');
        
        const startDateTime = event.start?.dateTime || event.start?.date;
        const endDateTime = event.end?.dateTime || event.end?.date;
        
        if (startDateTime) {
            const startDateObj = new Date(startDateTime);
            const yyyy = startDateObj.getFullYear();
            const mm = String(startDateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(startDateObj.getDate()).padStart(2, '0');
            setEditDate(`${yyyy}-${mm}-${dd}`);
            
            if (event.start?.dateTime) {
                const hh = String(startDateObj.getHours()).padStart(2, '0');
                const min = String(startDateObj.getMinutes()).padStart(2, '0');
                setEditStartTime(`${hh}:${min}`);
            } else {
                setEditStartTime('00:00');
            }
        } else {
            setEditDate('');
            setEditStartTime('00:00');
        }
        
        if (endDateTime && event.end?.dateTime) {
            const endDateObj = new Date(endDateTime);
            const hh = String(endDateObj.getHours()).padStart(2, '0');
            const min = String(endDateObj.getMinutes()).padStart(2, '0');
            setEditEndTime(`${hh}:${min}`);
        } else {
            setEditEndTime('01:00');
        }
    };

    const handleUpdateEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEvent) return;
        setIsSavingEvent(true);
        setError(null);
        try {
            const startIso = `${editDate}T${editStartTime}:00`;
            const endIso = `${editDate}T${editEndTime}:00`;
            
            const response = await fetch(`/api/calendar/events/${selectedEvent.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    summary: editSummary,
                    description: editDescription,
                    start: startIso,
                    end: endIso
                })
            });
            
            const data = await response.json();
            if (data.success) {
                setSelectedEvent(null);
                fetchEvents();
            } else {
                setError(data.error || 'Error al guardar los cambios en Google Calendar');
            }
        } catch (err) {
            setError('No se pudo conectar con el servidor para actualizar el evento.');
        } finally {
            setIsSavingEvent(false);
        }
    };

    const handleDeleteEvent = async () => {
        if (!selectedEvent) return;
        if (!window.confirm('¿Estás seguro de que deseas eliminar permanentemente esta cita de Google Calendar?')) {
            return;
        }
        setIsDeletingEvent(true);
        setError(null);
        try {
            const response = await fetch(`/api/calendar/events/${selectedEvent.id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                setSelectedEvent(null);
                fetchEvents();
            } else {
                setError(data.error || 'Error al eliminar el evento de Google Calendar');
            }
        } catch (err) {
            setError('No se pudo conectar con el servidor para eliminar el evento.');
        } finally {
            setIsDeletingEvent(false);
        }
    };

    const getPatientName = (event: CalendarEvent) => {
        const summary = event.summary || '';
        const description = event.description || '';
        
        // 1. Try to extract from our own format: "Nombre del Paciente: [Name]"
        const nameMatch = description.match(/Nombre del Paciente:\s*([^\n]+)/i);
        if (nameMatch && nameMatch[1].trim()) {
            return nameMatch[1].trim();
        }
        
        // 2. Try to clean up summary format: "Consulta Ayurveda: Nombre"
        if (summary.includes('Consulta Ayurveda:')) {
            return summary.replace('Consulta Ayurveda:', '').trim();
        }
        
        // 3. Try to clean up Calendly format: "Nombre and VEDAMCI" or "Nombre y VEDAMCI"
        let cleaned = summary;
        cleaned = cleaned.replace(/\band\s+VEDAMCI\b/gi, '');
        cleaned = cleaned.replace(/\by\s+VEDAMCI\b/gi, '');
        cleaned = cleaned.replace(/\bwith\s+VEDAMCI\b/gi, '');
        cleaned = cleaned.replace(/\bcon\s+VEDAMCI\b/gi, '');
        cleaned = cleaned.trim();
        
        if (cleaned) {
            return cleaned;
        }
        
        // 4. Fallback to attendees
        if (event.attendees && event.attendees.length > 0) {
            const patientAttendee = event.attendees.find(a => !a.self && a.email !== 'vedamci@gmail.com');
            if (patientAttendee) {
                return patientAttendee.displayName || patientAttendee.email;
            }
        }
        
        return 'Paciente sin nombre';
    };

    const getEventDateString = (event: CalendarEvent): string => {
        const dateVal = event.start?.dateTime || event.start?.date;
        if (!dateVal) return '';
        return dateVal.substring(0, 10);
    };

    const formatLongDate = (dateString: string) => {
        const [year, month, day] = dateString.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formatted = dateObj.toLocaleDateString('es-MX', options);
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    };

    const fetchConfig = async () => {
        try {
            const response = await fetch('/api/calendar/config');
            const data = await response.json();
            if (data.success) {
                setClientId(data.clientId || '');
                setCalendarId(data.calendarId || 'primary');
                setRedirectUri(data.redirectUri || getDefaultCalendarRedirectUri());
                setIsConnected(data.isConnected || false);
                setHasClientSecret(data.hasClientSecret || false);
                setBookingLink(data.bookingLink || '');
                setAllowedDays(data.allowedDays || '1,2,3,4,5');
                setAllowedHours(data.allowedHours || '9,10,11,12,13,14,15,16,17');
                setBlockedDates(data.blockedDates || '');
                
                // If the app is not connected to Google yet, show the configuration panel by default
                if (!data.isConnected && !data.clientId) {
                    setShowConfig(true);
                }
            }
        } catch (err) {
            console.error('Error fetching calendar config:', err);
        }
    };

    const fetchEvents = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/calendar/events');
            const data = await response.json();
            if (data.success) {
                setEvents(data.events || []);
            } else {
                setError(data.error || 'Error al cargar la agenda');
            }
        } catch (err: any) {
            setError('No se pudo conectar con el servidor o Google Calendar no está configurado.');
        } finally {
            setLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        const init = async () => {
            await fetchConfig();
            fetchEvents();
        };
        init();
    }, []);

    // Detect when browser gains focus (useful after completing OAuth flow in new tab)
    useEffect(() => {
        const handleFocus = async () => {
            try {
                const response = await fetch('/api/calendar/config');
                const data = await response.json();
                if (data.success) {
                    // Update connection state
                    setIsConnected(data.isConnected || false);
                    setHasClientSecret(data.hasClientSecret || false);
                    
                    // If it was disconnected but is now connected, fetch events automatically!
                    if (data.isConnected && !isConnected) {
                        fetchEvents();
                        setConfigSuccess('¡Conectado exitosamente con Google Calendar!');
                        setShowConfig(false);
                    }
                }
            } catch (err) {
                console.error('Focus check failed:', err);
            }
        };
        
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [isConnected]);

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingConfig(true);
        setConfigError(null);
        setConfigSuccess(null);
        try {
            const response = await fetch('/api/calendar/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId,
                    clientSecret: clientSecret || undefined, // Only send if user typed a new one
                    redirectUri,
                    calendarId,
                    bookingLink,
                    allowedDays,
                    allowedHours,
                    blockedDates
                })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                setConfigSuccess(data.message || 'Configuración guardada correctamente.');
                setClientSecret(''); // Clear input
                await fetchConfig();
                fetchEvents();
            } else {
                setConfigError(data.error || 'Error al guardar la configuración');
            }
        } catch (err) {
            setConfigError('No se pudo conectar con el servidor');
        } finally {
            setSavingConfig(false);
        }
    };

    const handleDisconnect = async () => {
        if (!window.confirm('¿Estás seguro de que deseas desconectar tu cuenta de Google Calendar?')) {
            return;
        }
        setDisconnecting(true);
        setConfigError(null);
        setConfigSuccess(null);
        try {
            const response = await fetch('/api/calendar/disconnect', {
                method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
                setConfigSuccess('Google Calendar desconectado correctamente');
                setIsConnected(false);
                setEvents([]);
                await fetchConfig();
            } else {
                setConfigError(data.error || 'Error al desconectar');
            }
        } catch (err) {
            setConfigError('No se pudo conectar con el servidor');
        } finally {
            setDisconnecting(false);
        }
    };

    const handleAuth = async () => {
        try {
            const response = await fetch('/api/calendar/auth');
            const data = await response.json();
            if (response.ok && data.url) {
                window.open(data.url, '_blank');
            } else {
                setError(data.error || 'Configura primero tu Client ID y Client Secret abajo.');
                setShowConfig(true);
            }
        } catch (err) {
            console.error('Error initiating auth:', err);
            setError('No se pudo conectar con el servidor para iniciar la autenticación.');
        }
    };

    const formatTime = (dateTimeStr?: string) => {
        if (!dateTimeStr) return 'Todo el día';
        return new Date(dateTimeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <DashboardLayout>
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-8"
            >
                {/* header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold text-slate-900">Agenda de Citas</h1>
                            {isConnected ? (
                                <Badge variant="success" className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold px-2 py-0.5 rounded-full text-xs">
                                    Conectado
                                </Badge>
                            ) : (
                                <Badge variant="neutral" className="bg-slate-100 text-slate-600 border border-slate-200 font-bold px-2 py-0.5 rounded-full text-xs">
                                    Desconectado
                                </Badge>
                            )}
                        </div>
                        <p className="text-slate-500 text-sm">Gestiona tus consultas y citas desde Google Calendar</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <a
                            href="/reservar?admin=true"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.02] text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-sm font-bold shadow-md shadow-emerald-500/10"
                        >
                            <CalendarIcon size={16} />
                            Agendar Cita (Admin)
                        </a>

                        <button
                            onClick={fetchEvents}
                            className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl border border-slate-200 transition-all flex items-center gap-2 text-sm font-medium shadow-sm"
                            disabled={loading}
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            Actualizar
                        </button>
                        
                        <button
                            onClick={() => setShowConfig(!showConfig)}
                            className={`px-4 py-2 rounded-xl border transition-all flex items-center gap-2 text-sm font-medium shadow-sm ${
                                showConfig 
                                    ? 'bg-primary-100 border-primary/30 text-primary-800' 
                                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                        >
                            <Settings size={16} />
                            Configuración
                        </button>

                        {isConnected ? (
                            <button
                                onClick={handleDisconnect}
                                disabled={disconnecting}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-sm font-bold"
                            >
                                <LogOut size={16} />
                                {disconnecting ? 'Desconectando...' : 'Desconectar'}
                            </button>
                        ) : (
                            <button
                                onClick={handleAuth}
                                className="bg-primary text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-primary/20 hover:scale-[1.02] flex items-center gap-2 text-sm font-bold"
                            >
                                <CalendarIcon size={16} />
                                Conectar Google
                            </button>
                        )}
                    </div>
                </div>

                {/* Configuration panel (Gear settings) */}
                <AnimatePresence>
                    {showConfig && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                        >
                            <Card className="border border-slate-100 bg-white p-6 space-y-6 shadow-sm">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                    <div className="flex items-center gap-2">
                                        <Settings className="text-primary" size={20} />
                                        <h3 className="text-slate-900 font-bold text-lg">Configuración de Google Calendar API</h3>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setShowInstructions(!showInstructions)}
                                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                                    >
                                        <HelpCircle size={14} />
                                        {showInstructions ? 'Ocultar guía' : 'Ver guía paso a paso'}
                                    </button>
                                </div>

                                {/* Step-by-step instructions */}
                                <AnimatePresence>
                                    {showInstructions && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-slate-600 text-sm space-y-3 overflow-hidden"
                                        >
                                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">¿Cómo obtener tus credenciales de Google?</h4>
                                            <ol className="list-decimal list-inside space-y-2 text-xs">
                                                <li>Entra a la <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink size={10} /></a>.</li>
                                                <li>Crea un proyecto nuevo (o selecciona uno existente).</li>
                                                <li>Busca y activa la API **Google Calendar API** desde la sección "APIs y Servicios".</li>
                                                <li>Configura la **Pantalla de Consentimiento OAuth** (OAuth consent screen): selecciona Tipo de Usuario **Externo**, llena los datos básicos y agrega el alcance (scope) <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[10px] text-slate-800 font-semibold">.../auth/calendar.readonly</code>.</li>
                                                <li>En la sección **Credenciales**, haz clic en *Crear Credenciales* &rarr; *ID de cliente de OAuth*. Selecciona **Aplicación Web** como tipo de aplicación.</li>
                                                <li>En **URIs de redireccionamiento autorizados**, añade la siguiente dirección exacta:
                                                    <div className="flex items-center gap-2 mt-1 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 font-mono text-[10px] text-amber-800 select-all">
                                                        {redirectUri}
                                                    </div>
                                                </li>
                                                <li>Guarda y copia el **ID de Cliente** (Client ID) y el **Secreto de Cliente** (Client Secret). Pégalos en el formulario de abajo.</li>
                                            </ol>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Form */}
                                <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">ID de Cliente (Google Client ID)</label>
                                        <input
                                            type="text"
                                            required
                                            value={clientId}
                                            onChange={(e) => setClientId(e.target.value)}
                                            placeholder="Introduce tu Client ID"
                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary/50 focus:bg-white text-sm transition-colors"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                                            Secreto de Cliente (Client Secret)
                                            {hasClientSecret && <span className="text-[10px] text-emerald-700 lowercase ml-2 font-normal">(Ya guardado en servidor)</span>}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showSecret ? 'text' : 'password'}
                                                value={clientSecret}
                                                onChange={(e) => setClientSecret(e.target.value)}
                                                placeholder={hasClientSecret ? "••••••••••••••••••••••••••••••••" : "Introduce tu Client Secret"}
                                                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary/50 focus:bg-white text-sm transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowSecret(!showSecret)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">URI de Redirección (Redirect URI)</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={redirectUri}
                                            className="w-full bg-slate-100 border border-slate-200 text-slate-500 rounded-xl px-4 py-2.5 text-xs font-mono select-all focus:outline-none"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">ID de Calendario (Calendar ID)</label>
                                        <input
                                            type="text"
                                            required
                                            value={calendarId}
                                            onChange={(e) => setCalendarId(e.target.value)}
                                            placeholder="primary o ID de calendario específico"
                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary/50 focus:bg-white text-sm transition-colors"
                                        />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Enlace de Reservas Personalizado (Opcional - por defecto usa /reservar)</label>
                                        <input
                                            type="url"
                                            id="bookingLinkInput"
                                            value={bookingLink}
                                            onChange={(e) => setBookingLink(e.target.value)}
                                            placeholder="https://calendly.com/tu-usuario/cita"
                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary/50 focus:bg-white text-sm transition-colors"
                                        />
                                    </div>

                                    {/* Días de Atención */}
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Días de Atención Permitidos para Reservas</label>
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {[
                                                { id: 1, label: 'Lun' },
                                                { id: 2, label: 'Mar' },
                                                { id: 3, label: 'Mié' },
                                                { id: 4, label: 'Jue' },
                                                { id: 5, label: 'Vie' },
                                                { id: 6, label: 'Sáb' },
                                                { id: 0, label: 'Dom' }
                                            ].map(day => {
                                                const dayNums = allowedDays.split(',').map(Number);
                                                const isSelected = dayNums.includes(day.id);
                                                return (
                                                    <button
                                                        type="button"
                                                        key={day.id}
                                                        onClick={() => {
                                                            let newDays = [...dayNums];
                                                            if (isSelected) {
                                                                newDays = newDays.filter(d => d !== day.id);
                                                            } else {
                                                                newDays.push(day.id);
                                                            }
                                                            setAllowedDays(newDays.sort().join(','));
                                                        }}
                                                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                                                            isSelected
                                                                ? 'bg-primary border-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                                                        }`}
                                                    >
                                                        {day.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Horas de Atención */}
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Horas de Consulta Permitidas (Hora local CDMX)</label>
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(hour => {
                                                const hourNums = allowedHours.split(',').map(Number);
                                                const isSelected = hourNums.includes(hour);
                                                return (
                                                    <button
                                                        type="button"
                                                        key={hour}
                                                        onClick={() => {
                                                            let newHours = [...hourNums];
                                                            if (isSelected) {
                                                                newHours = newHours.filter(h => h !== hour);
                                                            } else {
                                                                newHours.push(hour);
                                                            }
                                                            setAllowedHours(newHours.sort((a,b)=>a-b).join(','));
                                                        }}
                                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                            isSelected
                                                                ? 'bg-primary border-primary text-white shadow-md shadow-primary/15'
                                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        {String(hour).padStart(2, '0')}:00
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Fechas Bloqueadas */}
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Fechas Bloqueadas / Vacaciones (Separadas por coma AAAA-MM-DD)</label>
                                        <input
                                            type="text"
                                            value={blockedDates}
                                            onChange={(e) => setBlockedDates(e.target.value)}
                                            placeholder="Ej. 2026-06-01, 2026-06-25, 2026-12-25"
                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary/50 focus:bg-white text-sm transition-colors"
                                        />
                                        <p className="text-[10px] text-slate-500">Estas fechas específicas se bloquearán automáticamente de la disponibilidad en el portal público de pacientes.</p>
                                    </div>

                                    {/* Config alerts */}
                                    <div className="md:col-span-2">
                                        {configError && (
                                            <div className="bg-red-50 border border-red-200/60 text-red-700 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
                                                <AlertCircle size={14} />
                                                <span>{configError}</span>
                                            </div>
                                        )}
                                        {configSuccess && (
                                            <div className="bg-emerald-50 border border-emerald-200/60 text-emerald-700 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
                                                <CheckCircle2 size={14} />
                                                <span>{configSuccess}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action button inside form */}
                                    <div className="md:col-span-2 flex justify-end gap-3 border-t border-slate-100 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowConfig(false)}
                                            className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 transition-colors text-sm font-medium"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={savingConfig}
                                            className="bg-primary hover:scale-[1.02] text-white px-5 py-2 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center gap-2 text-sm font-bold"
                                        >
                                            <Save size={16} />
                                            {savingConfig ? 'Guardando...' : 'Guardar Configuración'}
                                        </button>
                                    </div>
                                </form>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Primary Alert (Error message) */}
                {error && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 text-red-400">
                            <div className="flex items-center gap-3">
                                <AlertCircle size={20} className="shrink-0" />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                            <div className="sm:ml-auto flex items-center gap-3 mt-2 sm:mt-0">
                                {clientId ? (
                                    <button
                                        onClick={handleAuth}
                                        className="underline text-xs font-bold hover:text-red-300"
                                    >
                                        Intentar Conexión
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setShowConfig(true)}
                                        className="underline text-xs font-bold hover:text-red-300"
                                    >
                                        Abrir Configuración
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Booking Link Sharing Card */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Card className="border border-emerald-500/20 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/20 p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shadow-lg shrink-0">
                                <CalendarIcon size={22} />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-base">Enlace de Reservas para Pacientes</h3>
                                <p className="text-slate-400 text-xs mt-0.5">Comparte esta liga para que tus pacientes agenden sus citas directamente en tu Google Calendar</p>
                            </div>
                        </div>

                        <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-white/5 font-mono text-xs text-emerald-400 select-all truncate max-w-full sm:max-w-xs md:max-w-md">
                                {bookingLink || `${window.location.origin}/reservar`}
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    onClick={handleCopyLink}
                                    className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow min-w-[90px]"
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                    {copied ? 'Copiado' : 'Copiar'}
                                </button>
                                <a
                                    href={bookingLink || `${window.location.origin}/reservar`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 sm:flex-none bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-bold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <ExternalLink size={14} />
                                    Abrir
                                </a>
                            </div>
                        </div>
                    </Card>
                </motion.div>

                {/* Events list */}
                <div className="grid grid-cols-1 gap-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            <p className="text-slate-400 font-medium">Cargando tu agenda...</p>
                        </div>
                    ) : !isConnected ? (
                        <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed border-2 border-slate-200 bg-slate-50/50">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
                                <CalendarIcon size={32} />
                            </div>
                            <h3 className="text-slate-900 font-bold text-lg mb-1">Google Calendar Desconectado</h3>
                            <p className="text-slate-500 max-w-sm mb-6 text-sm">
                                Conecta tu agenda de consultas para poder sincronizar tus próximas consultas Ayurvédicas directamente desde tu Google Calendar.
                            </p>
                            {clientId ? (
                                <button
                                    onClick={handleAuth}
                                    className="bg-primary text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-primary/20 hover:scale-[1.02] flex items-center gap-2 text-sm font-bold"
                                >
                                    <CalendarIcon size={16} />
                                    Conectar Google Calendar
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowConfig(true)}
                                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm font-bold shadow-sm"
                                >
                                    <Settings size={16} />
                                    Configurar Credenciales
                                </button>
                            )}
                        </Card>
                    ) : events.length === 0 ? (
                        <Card className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 mb-4">
                                <CalendarIcon size={32} />
                            </div>
                            <h3 className="text-slate-900 font-bold text-lg mb-1">No hay eventos próximos</h3>
                            <p className="text-slate-500 max-w-sm text-sm">No se encontraron citas programadas en tu calendario principal para los próximos días.</p>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            {/* View Mode Toggle Tabs */}
                            <div className="flex border-b border-slate-200 pb-1 mb-6">
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`pb-3 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                                        viewMode === 'list' 
                                            ? 'border-primary text-primary' 
                                            : 'border-transparent text-slate-400 hover:text-slate-800'
                                    }`}
                                >
                                    <List size={16} />
                                    Vista Lista (por Días)
                                </button>
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`pb-3 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                                        viewMode === 'grid' 
                                            ? 'border-primary text-primary' 
                                            : 'border-transparent text-slate-400 hover:text-slate-800'
                                    }`}
                                >
                                    <Grid size={16} />
                                    Vista Calendario (Cuadrícula)
                                </button>
                            </div>

                            {/* Render views */}
                            {viewMode === 'list' ? (
                                <div className="space-y-8 animate-fade-in-up">
                                    {(() => {
                                        const groupedEvents: Record<string, CalendarEvent[]> = {};
                                        events.forEach(event => {
                                            const dateStr = getEventDateString(event);
                                            if (dateStr) {
                                                if (!groupedEvents[dateStr]) {
                                                    groupedEvents[dateStr] = [];
                                                }
                                                groupedEvents[dateStr].push(event);
                                            }
                                        });
                                        const sortedDates = Object.keys(groupedEvents).sort();

                                        return sortedDates.map(dateStr => (
                                            <div key={dateStr} className="space-y-3">
                                                {/* Day Header Section */}
                                                <div className="flex items-center gap-3 border-l-4 border-primary pl-3 py-1">
                                                    <h3 className="text-slate-800 font-extrabold text-base tracking-tight capitalize">
                                                        {formatLongDate(dateStr)}
                                                    </h3>
                                                    <span className="text-[10px] font-bold px-2.5 py-0.5 bg-primary-100 text-primary-800 border border-primary/20 rounded-full">
                                                        {groupedEvents[dateStr].length} {groupedEvents[dateStr].length === 1 ? 'cita' : 'citas'}
                                                    </span>
                                                </div>

                                                {/* Cards container */}
                                                <div className="grid grid-cols-1 gap-4 pl-4">
                                                    {groupedEvents[dateStr].map(event => (
                                                        <motion.div key={event.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 350, damping: 25 }}>
                                                            <Card className={`hover:border-primary/20 transition-all duration-300 group ${isEventCanceled(event.summary, event.description) ? 'border-dashed border-red-200 bg-slate-50/80 opacity-75 shadow-none' : ''}`}>
                                                                <div className="flex flex-col md:flex-row gap-6">
                                                                    {/* Time Column */}
                                                                    <div className={`md:w-36 flex flex-col justify-center items-center md:items-start p-3 rounded-xl border shrink-0 ${isEventCanceled(event.summary, event.description) ? 'bg-red-50/60 border-red-200/40' : 'bg-primary-100/70 border-primary/20 shadow-sm'}`}>
                                                                        <div className={`flex items-center gap-1.5 font-extrabold ${isEventCanceled(event.summary, event.description) ? 'text-red-700/70 line-through' : 'text-primary-800'}`}>
                                                                            <Clock size={15} className="text-primary-600 shrink-0" />
                                                                            <span className="text-base">{formatTime(event.start?.dateTime || event.start?.date)}</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Info Column */}
                                                                    <div className="flex-1 space-y-3">
                                                                        <div className="flex items-start justify-between gap-4">
                                                                            <div>
                                                                                <h4 className={`text-base font-bold transition-colors ${isEventCanceled(event.summary, event.description) ? 'text-slate-400 line-through' : 'text-slate-900 group-hover:text-primary-700'}`}>
                                                                                    {event.summary}
                                                                                </h4>
                                                                                {event.description && (
                                                                                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                                                                                        {event.description}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                            {isEventCanceled(event.summary, event.description) ? (
                                                                                <Badge variant="neutral" className="bg-red-50 text-red-700 border border-red-200/60 font-bold px-2.5 py-0.5 rounded-full text-xs">
                                                                                    Cancelado
                                                                                </Badge>
                                                                            ) : (
                                                                                <Badge variant="success" className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold px-2.5 py-0.5 rounded-full text-xs">
                                                                                    Confirmado
                                                                                </Badge>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
                                                                            <div className="flex items-center gap-3">
                                                                                {/* Paciente Nombre Prominente y sin hover */}
                                                                                <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                                                                                    <User size={13} className="text-primary" />
                                                                                    <span>Paciente: <strong className="text-slate-900 font-extrabold">{getPatientName(event)}</strong></span>
                                                                                </div>
                                                                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                                                    <FileText size={13} className="text-slate-400" />
                                                                                    <span>Consulta</span>
                                                                                </div>
                                                                            </div>
                                                                            
                                                                            <div className="flex items-center gap-4">
                                                                                <button
                                                                                    onClick={() => openEditModal(event)}
                                                                                    className="flex items-center gap-1.5 text-xs text-primary-700 hover:text-primary-900 font-bold transition-colors"
                                                                                >
                                                                                    <Edit2 size={12} />
                                                                                    Editar
                                                                                </button>
                                                                                <a
                                                                                    href={event.htmlLink}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-bold transition-colors"
                                                                                >
                                                                                    Google Calendar
                                                                                    <ExternalLink size={12} />
                                                                                </a>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </Card>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            ) : (
                                <div className="space-y-4 animate-fade-in-up">
                                    {(() => {
                                        const MONTH_NAMES = [
                                            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                                            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                                        ];
                                        const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

                                        const firstDayIndex = new Date(gridYear, gridMonth, 1).getDay();
                                        const startPadding = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
                                        const totalDays = new Date(gridYear, gridMonth + 1, 0).getDate();
                                        const prevMonthTotalDays = new Date(gridYear, gridMonth, 0).getDate();

                                        const cells: Array<{ dayNum: number; isCurrentMonth: boolean; dateString: string }> = [];

                                        // Prev month padding
                                        for (let i = startPadding - 1; i >= 0; i--) {
                                            const d = prevMonthTotalDays - i;
                                            const prevMonth = gridMonth === 0 ? 11 : gridMonth - 1;
                                            const prevYear = gridMonth === 0 ? gridYear - 1 : gridYear;
                                            const dateString = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                            cells.push({ dayNum: d, isCurrentMonth: false, dateString });
                                        }

                                        // Current month
                                        for (let d = 1; d <= totalDays; d++) {
                                            const dateString = `${gridYear}-${String(gridMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                            cells.push({ dayNum: d, isCurrentMonth: true, dateString });
                                        }

                                        // Next month padding
                                        const totalCells = cells.length > 35 ? 42 : 35;
                                        const nextPadding = totalCells - cells.length;
                                        for (let d = 1; d <= nextPadding; d++) {
                                            const nextMonth = gridMonth === 11 ? 0 : gridMonth + 1;
                                            const nextYear = gridMonth === 11 ? gridYear + 1 : gridYear;
                                            const dateString = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                            cells.push({ dayNum: d, isCurrentMonth: false, dateString });
                                        }

                                        const handlePrevMonth = () => {
                                            if (gridMonth === 0) {
                                                setGridMonth(11);
                                                setGridYear(gridYear - 1);
                                            } else {
                                                setGridMonth(gridMonth - 1);
                                            }
                                        };

                                        const handleNextMonth = () => {
                                            if (gridMonth === 11) {
                                                setGridMonth(0);
                                                setGridYear(gridYear + 1);
                                            } else {
                                                setGridMonth(gridMonth + 1);
                                            }
                                        };

                                        return (
                                            <Card className="border border-slate-100 bg-white shadow-sm p-5">
                                                {/* Navigation bar */}
                                                <div className="flex items-center justify-between mb-6">
                                                    <h3 className="text-slate-800 font-extrabold text-lg flex items-center gap-2">
                                                        <CalendarIcon className="text-primary shrink-0" size={20} />
                                                        <span>{MONTH_NAMES[gridMonth]} de {gridYear}</span>
                                                    </h3>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={handlePrevMonth}
                                                            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors shadow-sm"
                                                        >
                                                            <ChevronLeft size={16} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setGridMonth(new Date().getMonth());
                                                                setGridYear(new Date().getFullYear());
                                                            }}
                                                            className="px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all shadow-sm"
                                                        >
                                                            Hoy
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleNextMonth}
                                                            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors shadow-sm"
                                                        >
                                                            <ChevronRight size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Weekday headers */}
                                                <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
                                                    {WEEKDAYS.map(w => (
                                                        <div key={w} className="text-slate-500 font-bold text-xs uppercase tracking-wider py-1.5">
                                                            {w}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Grid cells */}
                                                <div className="grid grid-cols-7 gap-1.5">
                                                    {cells.map((cell, idx) => {
                                                        const dayEvents = events.filter(e => getEventDateString(e) === cell.dateString);
                                                        const isToday = cell.dateString === new Date().toISOString().substring(0, 10);

                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`min-h-[110px] p-2 rounded-xl border flex flex-col justify-between transition-all ${
                                                                    cell.isCurrentMonth
                                                                        ? 'bg-white border-slate-100 hover:border-primary/20 hover:shadow-sm'
                                                                        : 'bg-slate-50/30 border-transparent text-slate-400 opacity-50'
                                                                } ${isToday ? 'border-primary bg-primary-100/20 ring-1 ring-primary/25' : ''}`}
                                                            >
                                                                <div className="flex items-center justify-between mb-1.5">
                                                                    <span className={`text-xs font-bold ${
                                                                        isToday
                                                                            ? 'w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center font-extrabold shadow-sm'
                                                                            : cell.isCurrentMonth ? 'text-slate-700' : 'text-slate-400'
                                                                    }`}>
                                                                        {cell.dayNum}
                                                                    </span>
                                                                    {dayEvents.length > 0 && cell.isCurrentMonth && (
                                                                        <span className="text-[9px] font-bold text-primary-700 bg-primary-100/50 border border-primary/20 px-1 py-0.5 rounded-full">
                                                                            {dayEvents.length} {dayEvents.length === 1 ? 'cita' : 'citas'}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Grid events list */}
                                                                <div className="flex-1 space-y-1 overflow-y-auto max-h-[70px] custom-scrollbar">
                                                                    {cell.isCurrentMonth && dayEvents.map(event => {
                                                                        const isCanceled = isEventCanceled(event.summary, event.description);
                                                                        return (
                                                                            <div
                                                                                key={event.id}
                                                                                onClick={() => openEditModal(event)}
                                                                                className={`text-[9px] px-1.5 py-0.5 rounded truncate text-left cursor-pointer transition-all font-semibold border ${
                                                                                    isCanceled
                                                                                        ? 'bg-red-50 text-red-700 border-red-200/50 line-through'
                                                                                        : 'bg-primary-100/80 text-primary-800 border-primary/20 hover:bg-primary-100'
                                                                                }`}
                                                                                title={`${formatTime(event.start?.dateTime || event.start?.date)} - ${getPatientName(event)}`}
                                                                            >
                                                                                <span className="opacity-80 font-normal mr-0.5">
                                                                                    {formatTime(event.start?.dateTime || event.start?.date)}
                                                                                </span>
                                                                                <strong>
                                                                                    {getPatientName(event)}
                                                                                </strong>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </Card>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Edit Event Modal */}
                <AnimatePresence>
                    {selectedEvent && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ type: "spring", duration: 0.3 }}
                                className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
                            >
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-primary">
                                        <Edit2 size={18} />
                                        <h3 className="text-slate-900 font-bold text-lg">Editar Cita Ayurvédica</h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedEvent(null)}
                                        className="text-slate-400 hover:text-slate-600 transition-colors text-xl font-bold"
                                    >
                                        &times;
                                    </button>
                                </div>

                                <form onSubmit={handleUpdateEvent} className="p-6 space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Título de la Cita</label>
                                        <input
                                            type="text"
                                            required
                                            value={editSummary}
                                            onChange={(e) => setEditSummary(e.target.value)}
                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary/50 focus:bg-white text-sm transition-colors"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Descripción / Detalles</label>
                                        <textarea
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            rows={4}
                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary/50 focus:bg-white text-sm transition-colors resize-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="space-y-1 sm:col-span-1">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Fecha</label>
                                            <input
                                                type="date"
                                                required
                                                value={editDate}
                                                onChange={(e) => setEditDate(e.target.value)}
                                                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary/50 focus:bg-white text-sm transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Inicio</label>
                                            <input
                                                type="time"
                                                required
                                                value={editStartTime}
                                                onChange={(e) => setEditStartTime(e.target.value)}
                                                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary/50 focus:bg-white text-sm transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Fin</label>
                                            <input
                                                type="time"
                                                required
                                                value={editEndTime}
                                                onChange={(e) => setEditEndTime(e.target.value)}
                                                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary/50 focus:bg-white text-sm transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-4">
                                        <button
                                            type="button"
                                            onClick={handleDeleteEvent}
                                            disabled={isDeletingEvent}
                                            className="bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 px-4 py-2 rounded-xl transition-colors flex items-center gap-2 text-xs font-bold"
                                        >
                                            <Trash2 size={14} />
                                            {isDeletingEvent ? 'Eliminando...' : 'Eliminar Cita'}
                                        </button>

                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedEvent(null)}
                                                className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 transition-colors text-xs font-medium"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSavingEvent}
                                                className="bg-primary hover:scale-[1.02] text-white px-5 py-2 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center gap-2 text-xs font-bold"
                                            >
                                                <Save size={14} />
                                                {isSavingEvent ? 'Guardando...' : 'Guardar Cambios'}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </motion.div>
        </DashboardLayout>
    );
}
