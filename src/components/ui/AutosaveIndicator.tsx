import { Check, Loader2, AlertCircle } from 'lucide-react';
import type { AutosaveStatus } from '../../hooks/useAutosave';

interface Props {
    status: AutosaveStatus;
    className?: string;
    /** Mensaje de error específico a mostrar en vez del genérico. */
    errorMessage?: string;
}

/**
 * Pastilla de estado para reemplazar los botones "Guardar" en secciones con autosave.
 * Muestra: nada (idle), "Guardando..." (saving), "Guardado" (saved) o un error.
 */
export const AutosaveIndicator = ({ status, className = '', errorMessage }: Props) => {
    if (status === 'idle') return null;

    if (status === 'saving') {
        return (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 ${className}`}>
                <Loader2 size={12} className="animate-spin" />
                Guardando...
            </span>
        );
    }

    if (status === 'error') {
        return (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold text-red-500 ${className}`} title={errorMessage || 'No se pudo guardar automáticamente.'}>
                <AlertCircle size={12} />
                {errorMessage ? 'Error al guardar' : 'No se pudo guardar'}
            </span>
        );
    }

    return (
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 ${className}`}>
            <Check size={12} />
            Guardado
        </span>
    );
};
