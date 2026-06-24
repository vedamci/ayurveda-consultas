import { useEffect, useState } from 'react';
import { Search, Bell, HelpCircle, Minus, Plus, Type } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const pageNames: Record<string, string> = {
    '/dashboard': 'Inicio',
    '/consultation': 'Nueva Consulta',
    '/map': 'Mapa Diagnóstico',
    '/patients': 'Pacientes',
    '/prescriptions': 'Recetas',
    '/analytics': 'Analíticas',
    '/schedule': 'Agenda',
};

export const TopBar = () => {
    const location = useLocation();
    const pageName = pageNames[location.pathname] || 'VEDAMCONSULTATION';
    const [fontScale, setFontScale] = useState(() => {
        const stored = Number(localStorage.getItem('vedamci-font-scale'));
        return Number.isFinite(stored) && stored >= 0.9 && stored <= 1.25 ? stored : 1;
    });

    useEffect(() => {
        document.documentElement.style.setProperty('--app-font-scale', String(fontScale));
        localStorage.setItem('vedamci-font-scale', String(fontScale));
    }, [fontScale]);

    const updateFontScale = (delta: number) => {
        setFontScale((current) => Math.min(1.25, Math.max(0.9, Number((current + delta).toFixed(2)))));
    };

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });

    return (
        <header className="h-[72px] bg-white/80 backdrop-blur-xl border-b border-slate-100/80 px-8 flex items-center justify-between sticky top-0 z-10 w-full">
            <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-900 capitalize">{pageName}</h2>
                <div className="w-px h-5 bg-slate-200" />
                <span className="text-sm text-slate-400 font-medium capitalize">{dateStr}</span>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative group">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors duration-200" />
                    <input
                        type="text"
                        placeholder="Buscar pacientes… (⌘K)"
                        className="pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/60 rounded-xl w-56 focus:w-72 text-sm focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all duration-300 placeholder:text-slate-400"
                    />
                </div>

                <div className="flex items-center gap-1">
                    <div className="h-10 rounded-xl border border-slate-200/70 bg-slate-50/70 flex items-center px-1">
                        <button
                            type="button"
                            onClick={() => updateFontScale(-0.05)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white transition-all"
                            title="Reducir fuente"
                        >
                            <Minus size={15} />
                        </button>
                        <div className="w-10 flex items-center justify-center text-slate-500" title={`Fuente ${Math.round(fontScale * 100)}%`}>
                            <Type size={16} />
                        </div>
                        <button
                            type="button"
                            onClick={() => updateFontScale(0.05)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white transition-all"
                            title="Aumentar fuente"
                        >
                            <Plus size={15} />
                        </button>
                    </div>
                    <IconButton icon={Bell} badge={3} />
                    <IconButton icon={HelpCircle} />
                </div>
            </div>
        </header>
    );
};

const IconButton = ({ icon: Icon, badge }: { icon: any, badge?: number }) => (
    <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className="relative w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all duration-200"
    >
        <Icon size={19} />
        {badge && (
            <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm shadow-red-500/30">
                {badge}
            </span>
        )}
    </motion.button>
);
