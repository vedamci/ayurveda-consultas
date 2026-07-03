import { useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions {
    /** Si es false, el hook no dispara guardados (útil cuando el panel/modal está cerrado). */
    enabled?: boolean;
    /** Milisegundos de inactividad antes de guardar. */
    delay?: number;
}

/**
 * Autosave genérico con debounce. Observa `value` (normalmente un fingerprint/JSON de los
 * campos editables) y llama a `save(value)` automáticamente `delay` ms después del último
 * cambio, sin necesidad de un botón "Guardar".
 *
 * - No guarda en el primer render ni la primera vez que `enabled` pasa a true (evita
 *   guardar de inmediato al abrir un formulario con datos ya existentes).
 * - Si llega un cambio nuevo mientras se está guardando, se re-encola automáticamente
 *   para no perder la última edición.
 */
export function useAutosave<T>(
    value: T,
    save: (value: T) => Promise<unknown> | void,
    { enabled = true, delay = 1200 }: UseAutosaveOptions = {}
) {
    const [status, setStatus] = useState<AutosaveStatus>('idle');
    const skippedFirstRun = useRef(false);
    const wasEnabled = useRef(enabled);
    const latestValueRef = useRef(value);
    const savingRef = useRef(false);
    const pendingRef = useRef(false);
    const saveRef = useRef(save);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    latestValueRef.current = value;
    saveRef.current = save;

    useEffect(() => {
        if (!enabled) {
            wasEnabled.current = false;
            return;
        }
        // La primera vez que el autosave queda habilitado con datos (al abrir el
        // formulario, al cargar un registro existente) no hay nada que guardar todavía.
        if (!wasEnabled.current || !skippedFirstRun.current) {
            skippedFirstRun.current = true;
            wasEnabled.current = true;
            return;
        }

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            runSave();
        }, delay);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, enabled, delay]);

    const runSave = async () => {
        if (savingRef.current) {
            pendingRef.current = true;
            return;
        }
        savingRef.current = true;
        setStatus('saving');
        try {
            await saveRef.current(latestValueRef.current);
            setStatus('saved');
        } catch (error) {
            console.error('Autosave error:', error);
            setStatus('error');
        } finally {
            savingRef.current = false;
            if (pendingRef.current) {
                pendingRef.current = false;
                runSave();
            }
        }
    };

    return status;
}
