
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { motion } from 'framer-motion';
import { Users, CalendarCheck, TrendingUp, DollarSign } from 'lucide-react';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

const statCards = [
    { label: 'Pacientes Activos', value: '128', delta: '+12 este mes', icon: Users, colors: 'from-emerald-400 to-emerald-500' },
    { label: 'Consultas', value: '56', delta: '+8 esta semana', icon: CalendarCheck, colors: 'from-blue-400 to-blue-500' },
    { label: 'Tasa de Éxito', value: '89%', delta: '+2.4% vs Q3', icon: TrendingUp, colors: 'from-amber-400 to-amber-500' },
    { label: 'Ingresos Est.', value: '$42.5k', delta: '+18% MoM', icon: DollarSign, colors: 'from-violet-400 to-violet-500' },
];

const doshaData = [
    { label: 'Vata', percentage: 35, color: 'from-blue-300 to-blue-400' },
    { label: 'Pitta', percentage: 45, color: 'from-amber-300 to-amber-400' },
    { label: 'Kapha', percentage: 20, color: 'from-emerald-300 to-emerald-400' },
];

const commonPathologies = [
    { name: 'Indigestión Crónica', count: 34, percent: 27 },
    { name: 'Desequilibrio Vata-Pitta', count: 28, percent: 22 },
    { name: 'Ansiedad & Estrés', count: 22, percent: 17 },
    { name: 'Insomnio', count: 18, percent: 14 },
    { name: 'Problemas de Piel', count: 12, percent: 10 },
];

export default function Analytics() {
    return (
        <DashboardLayout>
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-8"
            >
                {/* Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {statCards.map((stat, i) => (
                        <motion.div key={i} variants={itemVariants}>
                            <Card className="group hover:border-primary/15 cursor-pointer">
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.colors} flex items-center justify-center text-white shadow-sm`}>
                                        <stat.icon size={20} />
                                    </div>
                                </div>
                                <p className="text-2xl font-bold text-gray-900 font-mono leading-none">{stat.value}</p>
                                <p className="text-xs text-slate-400 font-medium mt-1">{stat.label}</p>
                                <p className="text-[11px] font-semibold text-emerald-500 mt-3">{stat.delta}</p>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Dosha Distribution */}
                    <motion.div variants={itemVariants}>
                        <Card>
                            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400 mb-6">Distribución Dosha</h3>
                            <div className="flex items-end justify-center gap-8 h-44 mb-6">
                                {doshaData.map((dosha, i) => (
                                    <div key={i} className="flex flex-col items-center gap-3 flex-1 group cursor-pointer">
                                        <span className="text-xs font-bold text-slate-500">{dosha.percentage}%</span>
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: `${dosha.percentage * 1.5}%` }}
                                            transition={{ type: "spring", damping: 12, stiffness: 100, delay: i * 0.15 }}
                                            className={`w-full max-w-[60px] rounded-xl bg-gradient-to-t ${dosha.color} group-hover:shadow-lg transition-shadow`}
                                        />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{dosha.label}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </motion.div>

                    {/* Common Pathologies */}
                    <motion.div variants={itemVariants}>
                        <Card>
                            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400 mb-6">Patologías Comunes</h3>
                            <div className="space-y-4">
                                {commonPathologies.map((path, i) => (
                                    <div key={i} className="group cursor-pointer">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-sm font-medium text-slate-700 group-hover:text-primary transition-colors">{path.name}</span>
                                            <span className="text-xs font-bold text-slate-400 font-mono">{path.count}</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${path.percent}%` }}
                                                transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: "easeOut" }}
                                                className="h-full rounded-full"
                                                style={{
                                                    background: `linear-gradient(90deg, #22C55E, #16A34A)`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </motion.div>
                </div>
            </motion.div>
        </DashboardLayout>
    );
}
