import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Search, FileText, User, Link, Plus, Check, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { PatientDetailPanel } from '../components/patients/PatientDetailPanel';
import PatientIntakeForm from './PatientIntakeForm';
import { motion, AnimatePresence } from 'framer-motion';

interface Patient {
    id: string;
    name: string;
    email: string;
    phone: string;
    professional: string;
    createdAt: string;
    lastEdited: string;
}

export default function Patients() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [showFormModal, setShowFormModal] = useState(false);
    const [copied, setCopied] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchParams, setSearchParams] = useSearchParams();

    const PAGE_SIZE = 100;
    const totalPages = Math.max(1, Math.ceil(patients.length / PAGE_SIZE));
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    const pagedPatients = patients.slice(pageStart, pageStart + PAGE_SIZE);

    useEffect(() => {
        if (searchParams.get('nueva') === 'true') {
            setShowFormModal(true);
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('nueva');
            setSearchParams(newParams, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const fetchPatients = async (query = '') => {
        setLoading(true);
        try {
            const res = await fetch(`/api/patients/search?query=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.success) {
                setPatients(data.results);
            }
        } catch (error) {
            console.error('Error fetching patients:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchPatients(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Volver a la primera página cuando cambia la lista de pacientes (búsqueda/recarga).
    useEffect(() => {
        setCurrentPage(1);
    }, [patients.length, searchTerm]);

    const copyPublicLink = () => {
        const link = `${window.location.origin}/ingreso-paciente`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('es-ES', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Mis Pacientes</h1>
                        <p className="text-slate-400 text-sm mt-1">Pacientes atendidos por Krishna Das, más recientes primero</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={copyPublicLink}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                        >
                            {copied ? <Check size={16} className="text-emerald-500" /> : <Link size={16} />}
                            {copied ? 'Enlace Copiado' : 'Copiar Enlace Público'}
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.02, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowFormModal(true)}
                            className="shimmer-btn flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition-all shadow-md shadow-primary/20"
                        >
                            <Plus size={16} />
                            Nueva Ficha
                        </motion.button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors duration-200" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 w-full md:w-96 transition-all duration-300 shadow-sm placeholder:text-slate-400"
                    />
                </div>

                {/* Table */}
                <Card noPadding>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                                <tr>
                                    <th className="px-6 py-4">Paciente</th>
                                    <th className="px-6 py-4">Contacto</th>
                                    <th className="px-6 py-4 text-center">Formulario</th>
                                    <th className="px-6 py-4">Registro</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading && patients.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-16">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                                <span className="text-slate-400 text-sm">Cargando pacientes de Notion...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : patients.length > 0 ? (
                                    pagedPatients.map((patient, i) => (
                                        <motion.tr
                                            key={patient.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: Math.min(i * 0.02, 0.4) }}
                                            className="hover:bg-slate-50/70 transition-all duration-200 cursor-pointer group"
                                            onClick={() => setSelectedPatientId(patient.id)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold overflow-hidden shrink-0 border"
                                                        style={{
                                                            background: patient.name
                                                                ? `linear-gradient(135deg, rgba(34,197,94,0.1), rgba(212,168,83,0.1))`
                                                                : '#f1f5f9',
                                                            borderColor: patient.name ? 'rgba(34,197,94,0.15)' : '#e2e8f0',
                                                            color: '#22C55E'
                                                        }}
                                                    >
                                                        {patient.name ? patient.name.charAt(0).toUpperCase() : <User size={18} />}
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold text-slate-800 block group-hover:text-primary transition-colors duration-200">{patient.name || 'Sin Nombre'}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">ID: {patient.id.slice(-8)}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-slate-600 font-medium">{patient.email || 'N/A'}</span>
                                                    <span className="text-slate-400 text-xs">{patient.phone || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Badge variant="success">Completado</Badge>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-sm">
                                                {formatDate(patient.createdAt || patient.lastEdited)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    className="text-slate-300 hover:text-primary transition-colors p-2 rounded-xl hover:bg-primary/5"
                                                    title="Ver Ficha Completa"
                                                >
                                                    <FileText size={18} />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="text-center py-20">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-slate-200"
                                                    style={{
                                                        background: 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(212,168,83,0.05))',
                                                        border: '1px solid rgba(0,0,0,0.04)'
                                                    }}
                                                >
                                                    <Users size={28} />
                                                </div>
                                                <div className="max-w-xs mx-auto">
                                                    <p className="text-slate-900 font-bold text-lg">No hay pacientes de la app</p>
                                                    <p className="text-slate-400 text-sm mt-1">Solo se muestran pacientes atendidos por Krishna Das.</p>
                                                </div>
                                                <button
                                                    onClick={() => setShowFormModal(true)}
                                                    className="mt-2 text-primary font-bold hover:underline text-sm"
                                                >
                                                    Crear primera ficha
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {patients.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100">
                            <p className="text-xs text-slate-500">
                                Mostrando <span className="font-bold text-slate-700">{pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, patients.length)}</span> de <span className="font-bold text-slate-700">{patients.length}</span> pacientes
                            </p>
                            {totalPages > 1 && (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft size={14} /> Anterior
                                    </button>
                                    {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                        .map((p, idx, arr) => (
                                            <span key={p} className="flex items-center">
                                                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-slate-300">…</span>}
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentPage(p)}
                                                    className={`min-w-[2rem] px-2 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                                                        p === currentPage
                                                            ? 'bg-primary text-white border-primary'
                                                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {p}
                                                </button>
                                            </span>
                                        ))}
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Siguiente <ChevronRight size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>

            {/* Detail Panel */}
            <PatientDetailPanel
                patientId={selectedPatientId}
                onClose={() => setSelectedPatientId(null)}
            />

            {/* Modal for internal form filling */}
            <AnimatePresence>
                {showFormModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                            onClick={() => setShowFormModal(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">Nueva Ficha de Ingreso</h2>
                                    <p className="text-sm text-slate-400 mt-0.5">Completa la información del paciente directamente</p>
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.1, rotate: 90 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setShowFormModal(false)}
                                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                                >
                                    <Plus size={24} className="rotate-45" />
                                </motion.button>
                            </div>
                            <div className="flex-1 overflow-y-auto bg-slate-50/50 custom-scrollbar">
                                <div className="p-6 max-w-6xl mx-auto">
                                    <PatientIntakeForm isInternal={true} onSuccess={() => {
                                        setShowFormModal(false);
                                        fetchPatients();
                                    }} />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
}
