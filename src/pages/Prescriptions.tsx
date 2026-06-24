
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { motion } from 'framer-motion';
import { Plus, Pill, Clock, User } from 'lucide-react';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

const prescriptions = [
    {
        formula: 'Triphala Churna',
        dosage: '5g con agua tibia',
        patient: 'Rahul S.',
        date: 'Feb 09, 2026',
        status: 'active',
        dosha: 'Vata-Pitta',
    },
    {
        formula: 'Ashwagandha Rasayana',
        dosage: '10ml después de comidas',
        patient: 'Meera K.',
        date: 'Feb 07, 2026',
        status: 'active',
        dosha: 'Kapha',
    },
    {
        formula: 'Brahmi Ghrita',
        dosage: '1 cuchara antes de dormir',
        patient: 'Siddharth J.',
        date: 'Feb 05, 2026',
        status: 'completed',
        dosha: 'Pitta',
    },
    {
        formula: 'Dashamoola Kvatha',
        dosage: '15ml por la mañana',
        patient: 'Anjali M.',
        date: 'Feb 03, 2026',
        status: 'active',
        dosha: 'Vata',
    },
];

export default function Prescriptions() {
    return (
        <DashboardLayout>
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
            >
                {/* Header */}
                <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Recetas Herbales</h1>
                        <p className="text-slate-400 text-sm mt-1">Gestiona las fórmulas y prescripciones</p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        className="shimmer-btn flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold shadow-md shadow-primary/20"
                    >
                        <Plus size={16} />
                        Nueva Receta
                    </motion.button>
                </motion.div>

                {/* Prescription Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {prescriptions.map((rx, i) => (
                        <motion.div key={i} variants={itemVariants}>
                            <Card className="hover:border-primary/15 transition-all cursor-pointer group">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                            style={{
                                                background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(212,168,83,0.08) 100%)',
                                                border: '1px solid rgba(34,197,94,0.1)'
                                            }}
                                        >
                                            <Pill size={18} className="text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 group-hover:text-primary transition-colors">{rx.formula}</h4>
                                            <p className="text-xs text-slate-400 mt-0.5">{rx.dosage}</p>
                                        </div>
                                    </div>
                                    <Badge variant={rx.status === 'active' ? 'success' : 'neutral'} pulse={rx.status === 'active'}>
                                        {rx.status === 'active' ? 'Activa' : 'Completada'}
                                    </Badge>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <User size={14} className="text-slate-300" />
                                        <span className="font-medium">{rx.patient}</span>
                                        <span className="text-slate-300">·</span>
                                        <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">{rx.dosha}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                        <Clock size={12} />
                                        {rx.date}
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </DashboardLayout>
    );
}
