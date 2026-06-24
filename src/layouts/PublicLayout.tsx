import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface PublicLayoutProps {
    children: ReactNode;
    title?: string;
    subtitle?: string;
}

export const PublicLayout = ({ children, title = "VEDAMCONSULTATION", subtitle = "Formulario de Ingreso" }: PublicLayoutProps) => {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b border-slate-200 py-4 px-6 mb-8 flex items-center justify-center">
                <div className="flex items-center gap-3">
                    <img 
                        src="/LOGO_2020_VEDAMCI.png" 
                        alt="Logo VEDAMCI" 
                        className="w-10 h-10 object-contain rounded-lg"
                        onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                        }}
                    />
                    <div>
                        <h1 className="text-lg font-bold tracking-tight text-slate-900">{title}</h1>
                        <p className="text-[10px] uppercase tracking-widest text-primary/70 font-semibold">{subtitle}</p>
                    </div>
                </div>
            </header>
            <main className="flex-1 w-full max-w-3xl mx-auto px-4 pb-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {children}
                </motion.div>
            </main>
            <footer className="py-6 text-center text-slate-400 text-sm">
                &copy; {new Date().getFullYear()} VEDAMCI. Todos los derechos reservados.
            </footer>
        </div>
    );
};
