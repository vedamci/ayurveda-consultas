import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, Activity, Droplets, Sparkles, TrendingUp, Calendar as CalendarIcon, User } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Link } from 'react-router-dom';
import { PatientDetailPanel } from '../components/patients/PatientDetailPanel';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08
        }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: "spring" as const, stiffness: 300, damping: 24 }
    }
};

export default function Dashboard() {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [recentPatients, setRecentPatients] = useState<any[]>([]);
    const [patientsLoading, setPatientsLoading] = useState(true);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

    const fetchRecentPatients = async () => {
        try {
            const response = await fetch('/api/patients/recent-dashboard');
            const data = await response.json();
            if (data.success) {
                setRecentPatients(data.results || []);
            }
        } catch (err) {
            console.error('Failed to fetch recent patients:', err);
        } finally {
            setPatientsLoading(false);
        }
    };

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const response = await fetch('/api/calendar/events');
                const data = await response.json();
                if (data.success) {
                    setEvents(data.events || []);
                }
            } catch (err) {
                console.error('Failed to fetch agenda:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
        fetchRecentPatients();
    }, []);

    const formatTime = (dateTimeStr?: string) => {
        if (!dateTimeStr) return 'TBD';
        return new Date(dateTimeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Sin fecha';
        return new Date(dateString).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatDateTime = (dateTimeStr?: string) => {
        if (!dateTimeStr) return 'Sin agendar';
        const dateObj = new Date(dateTimeStr);
        return dateObj.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
        }) + ' a las ' + dateObj.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Helper to check if a patient was seen recently or has a future appointment to show as active (green dot)
    const isPatientActive = (patient: any) => {
        if (patient.nextAppt) return true;
        if (!patient.lastVisit) return false;
        const lastVisitDate = new Date(patient.lastVisit);
        const daysDiff = (now.getTime() - lastVisitDate.getTime()) / (1000 * 3600 * 24);
        return daysDiff >= 0 && daysDiff <= 30;
    };

    return (
        <DashboardLayout>
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-8"
            >
                {/* Hero Greeting */}
                <motion.div variants={itemVariants} className="relative overflow-hidden rounded-2xl p-8"
                    style={{
                        background: 'linear-gradient(135deg, #1A1814 0%, #2C261A 50%, #3D3522 100%)',
                    }}
                >
                    <div className="absolute top-0 right-0 w-64 h-64 opacity-10"
                        style={{
                            background: 'radial-gradient(circle, #D4A853 0%, transparent 70%)',
                        }}
                    />
                    <div className="absolute bottom-0 left-1/3 w-80 h-40 opacity-5"
                        style={{
                            background: 'radial-gradient(circle, #F5E6C8 0%, transparent 70%)',
                        }}
                    />
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <p className="text-amber-400/70 text-sm font-medium mb-1">{greeting}</p>
                            <h1 className="text-2xl font-bold text-white mb-1">Dr. Krishna Das</h1>
                            <p className="text-slate-400 text-sm">
                                Tienes <span className="text-amber-400 font-semibold">{events.length} consultas</span> programadas hoy
                            </p>
                        </div>
                        <div className="hidden md:flex items-center gap-6">
                            <StatPill icon={TrendingUp} label="Atendidos" value="8" />
                            <StatPill icon={Sparkles} label="Pendientes" value="4" />
                        </div>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column (2/3) */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Daily Agenda Section */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Agenda del Día</h3>
                                <Link to="/schedule" className="text-xs font-semibold text-primary flex items-center gap-1 hover:gap-2 transition-all duration-200">
                                    Ver Calendario <ArrowRight size={14} />
                                </Link>
                            </div>

                            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 snap-x custom-scrollbar">
                                {loading ? (
                                    <div className="flex gap-4 w-full">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="min-w-[280px] h-40 bg-slate-100/80 animate-pulse rounded-2xl border border-slate-100" />
                                        ))}
                                    </div>
                                ) : events.length === 0 ? (
                                    <div className="w-full py-10 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                        <CalendarIcon className="text-slate-400 mb-2" size={24} />
                                        <p className="text-slate-500 text-sm font-medium">No hay citas para hoy</p>
                                    </div>
                                ) : (
                                    events.map((event, index) => (
                                        <motion.div key={index} variants={itemVariants} className="snap-start">
                                            <Card className="min-w-[280px] hover:border-primary/20 transition-all duration-200 cursor-pointer group">
                                                <div className="flex justify-between items-start mb-4">
                                                    <Badge variant="success">Confirmada</Badge>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded-lg">
                                                        <Clock size={11} />
                                                        {formatTime(event.start.dateTime || event.start.date)}
                                                    </div>
                                                </div>
                                                <h4 className="font-bold text-gray-900 mb-0.5 group-hover:text-primary transition-colors">{event.summary}</h4>
                                                <p className="text-xs text-slate-500 mb-4 line-clamp-1">{event.description || 'Consulta de seguimiento'}</p>
                                                <div className="flex items-center gap-2 pt-3 border-t border-slate-50">
                                                    <div className="w-6 h-6 rounded-full bg-slate-100 overflow-hidden ring-2 ring-white text-[10px] flex items-center justify-center font-bold text-slate-400">
                                                        {event.summary?.charAt(0) || 'P'}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Paciente: Google Contact</span>
                                                </div>
                                            </Card>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </section>

                        {/* Recent Patients Section */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Pacientes Recientes</h3>
                                <Link to="/patients" className="text-xs font-semibold text-slate-400 hover:text-primary transition-colors">
                                    Ver todos
                                </Link>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {patientsLoading ? (
                                    <div className="flex gap-4 w-full col-span-2">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="flex-1 min-h-[180px] bg-slate-50 animate-pulse rounded-2xl border border-slate-100" />
                                        ))}
                                    </div>
                                ) : recentPatients.length === 0 ? (
                                    <div className="w-full col-span-2 py-10 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                        <p className="text-slate-400 text-sm font-medium">No se encontraron pacientes atendidos por ti</p>
                                    </div>
                                ) : (
                                    recentPatients.map((patient) => {
                                        const isActive = isPatientActive(patient);
                                        return (
                                            <motion.div key={patient.id} variants={itemVariants}>
                                                <Card 
                                                    className="group cursor-pointer hover:border-primary/15 transition-all duration-200 h-full flex flex-col justify-between"
                                                    onClick={() => setSelectedPatientId(patient.id)}
                                                >
                                                    <div>
                                                        <div className="flex items-start justify-between gap-2 mb-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="relative bg-slate-100 rounded-xl overflow-hidden ring-2 ring-white shadow-sm flex items-center justify-center font-bold text-primary w-12 h-12">
                                                                    {patient.name ? (
                                                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${patient.name}`} alt={patient.name} />
                                                                    ) : (
                                                                        <User size={18} />
                                                                    )}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <h5 className="font-bold text-gray-900 group-hover:text-primary transition-colors text-sm truncate max-w-[130px]" title={patient.name}>{patient.name}</h5>
                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-primary shadow-sm shadow-primary/30' : 'bg-slate-300'}`}></div>
                                                                        <Badge variant="neutral" className="text-[8px] px-1 py-0">
                                                                            {patient.condition || 'General'}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Badge variant={patient.treatmentSent ? "success" : "warning"} className="text-[8px] shrink-0 px-1.5 py-0">
                                                                {patient.treatmentSent ? "Enviado" : "Pendiente"}
                                                            </Badge>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50 text-left">
                                                            <div>
                                                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-1">Última Visita</p>
                                                                <p className="text-xs text-slate-600 font-medium leading-tight">
                                                                    {patient.isNew ? 'Ingreso: ' : ''}
                                                                    {formatDate(patient.lastVisit)}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-1">Próx Cita</p>
                                                                <p className={`text-xs font-medium leading-tight ${patient.nextAppt ? 'text-slate-600 font-semibold' : 'text-slate-300 italic'}`}>
                                                                    {patient.nextAppt ? formatDateTime(patient.nextAppt) : 'Sin agendar'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 flex justify-between items-center pt-2">
                                                        <div className="flex gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-primary/30"></span>
                                                            <span className="w-1.5 h-1.5 rounded-full bg-primary/30"></span>
                                                            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                                        </div>
                                                        <Activity size={16} className="text-slate-200 group-hover:text-primary transition-colors duration-200" />
                                                    </div>
                                                </Card>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Right Column (1/3) - Daily Insights */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Resumen del Día</h3>
                        </div>

                        <Card className="flex flex-col gap-8 h-full min-h-[500px]">
                            {/* Consultation Progress */}
                            <div>
                                <div className="flex justify-between items-end mb-3">
                                    <p className="text-xs text-slate-400 font-medium">Progreso de Consultas</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-bold text-gray-900 font-mono">{events.length}</span>
                                        <span className="text-sm text-slate-400 font-medium">/ 12</span>
                                    </div>
                                </div>
                                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, Math.round((events.length / 12) * 100))}%` }}
                                        transition={{ duration: 1.2, ease: "easeOut" }}
                                        className="h-full rounded-full"
                                        style={{
                                            background: 'linear-gradient(90deg, #F5E6C8, #D4A853, #B8922E)',
                                            boxShadow: '0 0 12px rgba(212, 168, 83, 0.35)'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Prakriti Trends */}
                            <div>
                                <p className="text-xs text-slate-400 font-medium mb-6">Tendencias Prakriti Hoy</p>
                                <div className="flex items-end justify-between gap-4 h-32 px-2">
                                    <Bar height="40%" label="Vata" color="from-blue-300 to-blue-400" />
                                    <Bar height="80%" label="Pitta" color="from-amber-300 to-amber-400" />
                                    <Bar height="60%" label="Kapha" color="from-emerald-300 to-emerald-400" />
                                </div>
                            </div>

                            {/* Herbal Scripts */}
                            <div className="mt-auto">
                                <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 transition-colors hover:border-primary/20"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(212,168,83,0.08) 0%, rgba(245,230,200,0.02) 100%)'
                                    }}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                        <Droplets size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Recetas Herbales</p>
                                        <p className="text-xl font-bold text-gray-900 leading-none mt-1">14</p>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                </div>
            </motion.div>

            {/* Detail Panel */}
            <PatientDetailPanel
                patientId={selectedPatientId}
                onClose={() => {
                    setSelectedPatientId(null);
                    fetchRecentPatients();
                }}
            />
        </DashboardLayout>
    );
}

const StatPill = ({ icon: Icon, label, value }: { icon: any, label: string, value: string }) => (
    <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/5">
        <Icon size={16} className="text-amber-400" />
        <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{label}</p>
            <p className="text-lg font-bold text-white leading-none">{value}</p>
        </div>
    </div>
);

const Bar = ({ height, label, color }: { height: string, label: string, color: string }) => (
    <div className="flex-1 flex flex-col items-center gap-3 group cursor-pointer">
        <motion.div
            initial={{ height: 0 }}
            animate={{ height }}
            transition={{ type: "spring", damping: 14, stiffness: 100 }}
            className={`w-full rounded-xl transition-all opacity-80 group-hover:opacity-100 bg-gradient-to-t ${color} group-hover:shadow-lg`}
        />
        <span className="text-[10px] font-bold text-slate-400 uppercase group-hover:text-slate-600 transition-colors">{label}</span>
    </div>
);
