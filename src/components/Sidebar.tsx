import { motion } from 'framer-motion';
import { LayoutDashboard, Calendar, Users, FileText, PieChart, Plus, Map, Leaf, Shield, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NavItem = ({ icon: Icon, label, path }: { icon: any, label: string, path: string }) => {
    const location = useLocation();
    const active = location.pathname === path;

    return (
        <Link to={path} className="relative block">
            <motion.div
                whileHover={{ x: 4, backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${active
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
            >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${active
                    ? 'bg-primary/15 shadow-sm shadow-primary/20'
                    : 'bg-transparent group-hover:bg-white/5'
                    }`}>
                    <Icon size={18} className={`transition-colors duration-200 ${active ? 'text-primary' : 'text-slate-400 group-hover:text-slate-200'}`} />
                </div>
                <span className="text-[13px] tracking-wide">{label}</span>
                {active && (
                    <motion.div
                        layoutId="active-nav"
                        className="absolute left-0 w-[3px] h-7 rounded-r-full"
                        style={{
                            background: 'linear-gradient(180deg, #22C55E 0%, #D4A853 100%)',
                            boxShadow: '0 0 12px rgba(34, 197, 94, 0.4)'
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    />
                )}
            </motion.div>
        </Link>
    );
};

export const Sidebar = () => {
    const { user, logout } = useAuth();

    return (
        <aside className="w-64 h-screen text-white flex flex-col py-6 px-4 fixed left-0 top-0 z-50"
            style={{
                background: 'linear-gradient(180deg, #0d1a13 0%, #07110c 50%, #0a0f0c 100%)',
                borderRight: '1px solid rgba(255,255,255,0.04)'
            }}
        >
            {/* Brand */}
            <div className="flex items-center gap-3 px-3 mb-10">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center relative"
                     style={{
                         background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(212,168,83,0.1) 100%)',
                         border: '1px solid rgba(34,197,94,0.15)'
                     }}
                >
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    >
                        <Leaf size={20} className="text-primary" />
                    </motion.div>
                </div>
                <div>
                    <h1 className="text-sm font-bold tracking-tight text-white">PranaCare</h1>
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-gradient-gold" style={{
                        background: 'linear-gradient(90deg, #D4A853, #F5E6C8)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>Ayurvedic Clinic</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 flex flex-col gap-1">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em] px-3 mb-2">Menú</p>
                <NavItem icon={LayoutDashboard} label="Inicio" path="/dashboard" />
                <NavItem icon={Plus} label="Nueva Consulta" path="/patients?nueva=true" />
                <NavItem icon={Map} label="Mapa Diagnóstico" path="/map" />
                <NavItem icon={Calendar} label="Agenda" path="/schedule" />
                <NavItem icon={Users} label="Pacientes" path="/patients" />
                <NavItem icon={FileText} label="Recetas" path="/prescriptions" />
                <NavItem icon={PieChart} label="Analíticas" path="/analytics" />
                {user?.role === 'admin' && (
                    <NavItem icon={Shield} label="Usuarios" path="/usuarios" />
                )}
            </nav>

            {/* User Profile */}
            <div className="mt-auto flex flex-col gap-4 px-1">
                {user && (
                    <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-9 h-9 rounded-full bg-emerald-800 flex items-center justify-center border border-white/10 text-white font-bold text-xs select-none">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#07110c]" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-white/90 max-w-[120px] truncate">{user.name}</span>
                                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">
                                    {user.role === 'admin' ? 'Administrador' : 'Profesional'}
                                </span>
                            </div>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.1, backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
                            whileTap={{ scale: 0.9 }}
                            onClick={logout}
                            title="Cerrar sesión"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors duration-200 cursor-pointer"
                        >
                            <LogOut size={15} />
                        </motion.button>
                    </div>
                )}
            </div>
        </aside>
    );
};
