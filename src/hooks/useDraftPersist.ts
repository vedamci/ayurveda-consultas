import { useEffect, useRef } from 'react';

/**
 * Autosave "local" para cajas de texto que componen un registro NUEVO (nota de
 * profesional, lectura de pulso) en vez de editar uno ya existente. Estas cajas no
 * tienen un endpoint de edición-en-sitio: cada clic en "Guardar" crea una entrada
 * nueva en el historial (y en Notion, en el caso de las notas). Autoguardar cada
 * pulsación de tecla directamente contra el backend generaría entradas duplicadas
 * o incompletas.
 *
 * En su lugar, este hook guarda el borrador en localStorage con debounce, para que
 * no se pierda si cierras el panel o la app antes de darle clic a "Guardar". Se debe
 * llamar a `clearDraft()` justo después de un guardado manual exitoso.
 */
export function useDraftPersist(key: string | null, value: string, delay = 500) {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!key) return;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            try {
                if (value && value.trim()) {
                    localStorage.setItem(key, value);
                } else {
                    localStorage.removeItem(key);
                }
            } catch {
                // localStorage puede fallar (modo privado, cuota); no es crítico.
            }
        }, delay);
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [key, value, delay]);
}

export function readDraft(key: string | null): string {
    if (!key) return '';
    try {
        return localStorage.getItem(key) || '';
    } catch {
        return '';
    }
}

export function clearDraft(key: string | null) {
    if (!key) return;
    try {
        localStorage.removeItem(key);
    } catch {
        // no-op
    }
}
