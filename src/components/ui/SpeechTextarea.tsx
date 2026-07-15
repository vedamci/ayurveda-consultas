import { useRef, useState, useEffect } from 'react';
import type React from 'react';
import { Mic, MicOff, Sparkles, Loader2 } from 'lucide-react';

interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onend: (() => void) | null;
    onerror: ((event: { error: string }) => void) | null;
    start: () => void;
    stop: () => void;
}

declare global {
    interface Window {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognitionEventLike extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}

interface SpeechTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
    value: string;
    onValueChange: (value: string) => void;
    /** Set to false to hide the "improve with AI" button. Defaults to true. */
    enableAI?: boolean;
    /** Optional label for the field, given to the AI as context. */
    aiFieldLabel?: string;
}

const getFriendlyErrorMessage = (error: string) => {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isInsecure = !window.isSecureContext;

    switch (error) {
        case 'not-allowed':
            return 'Acceso al micrófono denegado. Permite el uso del micrófono en la barra de direcciones de tu navegador.';
        case 'service-not-allowed':
            return 'Dictado del sistema desactivado. Activa "Dictado" en Configuración del Sistema > Teclado (o activa Siri) en tu Mac.';
        case 'audio-capture':
            return 'No se detecta ningún micrófono. Conecta un micrófono e inténtalo de nuevo.';
        case 'no-speech':
            return 'No se detectó voz. Intenta hablar más fuerte o revisar tu micrófono.';
        case 'network':
            if (isSafari && isInsecure) {
                return 'Safari bloquea el dictado de voz sobre HTTP. Abre la aplicación en Google Chrome o configura HTTPS.';
            }
            if (isSafari) {
                return 'Safari no pudo iniciar su servicio de dictado. Verifica el permiso del micrófono y que Dictado o Siri estén activos; también puedes usar Google Chrome.';
            }
            return 'Error de red en el reconocimiento de voz. Revisa tu conexión e inténtalo de nuevo.';
        default:
            return `Error de dictado: ${error}`;
    }
};

export const SpeechTextarea = ({ value, onValueChange, className = '', enableAI = true, aiFieldLabel = '', ...props }: SpeechTextareaProps) => {
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isImproving, setIsImproving] = useState(false);
    const [improveError, setImproveError] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const startValueRef = useRef<string>('');
    const sessionTextRef = useRef<string>('');
    const latestTranscriptRef = useRef<string>('');
    const isListeningRef = useRef<boolean>(false);

    const SpeechRecognitionApi = (window.SpeechRecognition || window.webkitSpeechRecognition) as SpeechRecognitionConstructor | undefined;
    const isSupported = Boolean(SpeechRecognitionApi);

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isInsecure = !window.isSecureContext;
    const isSafariHTTP = isSafari && isInsecure;

    // Keep track of the current textarea value so we can capture it when dictation starts
    const valueRef = useRef(value);
    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    // Clean up recognition on unmount
    useEffect(() => {
        return () => {
            isListeningRef.current = false;
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const startListening = () => {
        if (!SpeechRecognitionApi) return;

        const recognition = new SpeechRecognitionApi();
        recognition.lang = navigator.language || 'es-MX';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0]?.transcript || '';
            }

            const cleanTranscript = transcript.trim();
            if (cleanTranscript) {
                latestTranscriptRef.current = cleanTranscript;

                const prefix = startValueRef.current.trim();
                const previousSessions = sessionTextRef.current.trim();
                const fullPrefix = [prefix, previousSessions].filter(Boolean).join(' ');
                const newValue = fullPrefix ? `${fullPrefix} ${cleanTranscript}` : cleanTranscript;
                onValueChange(newValue);
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setError(event.error);
            // If it's not a no-speech error, we abort restarting
            if (event.error !== 'no-speech') {
                isListeningRef.current = false;
                setIsListening(false);
            }
        };

        recognition.onend = () => {
            // Append the latest transcript of the session that just ended
            if (latestTranscriptRef.current) {
                sessionTextRef.current = [sessionTextRef.current.trim(), latestTranscriptRef.current.trim()]
                    .filter(Boolean)
                    .join(' ');
                latestTranscriptRef.current = '';
            }

            // Restart if the user wants to continue listening
            if (isListeningRef.current) {
                try {
                    // 500ms delay to give Safari ample time to release the microphone audio session
                    setTimeout(() => {
                        if (isListeningRef.current) {
                            startListening();
                        }
                    }, 500);
                } catch (err) {
                    console.error('Failed to restart speech recognition:', err);
                    setIsListening(false);
                    isListeningRef.current = false;
                }
            } else {
                setIsListening(false);
            }
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
        } catch (startError) {
            console.error('Failed to start speech recognition:', startError);
            isListeningRef.current = false;
            setIsListening(false);
            setError('not-allowed');
        }
    };

    const toggleDictation = () => {
        if (!SpeechRecognitionApi) return;

        if (isListeningRef.current) {
            isListeningRef.current = false;
            setIsListening(false);
            recognitionRef.current?.stop();
            return;
        }

        // Capture the value of the textarea before we begin recording
        startValueRef.current = valueRef.current;
        sessionTextRef.current = '';
        latestTranscriptRef.current = '';
        setError(null);
        isListeningRef.current = true;
        setIsListening(true);
        startListening();
    };

    const improveWithAI = async () => {
        if (!value.trim() || isImproving) return;
        setImproveError(null);
        setIsImproving(true);
        try {
            const token = localStorage.getItem('token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/ai/improve-text', {
                method: 'POST',
                headers,
                body: JSON.stringify({ text: value, field: aiFieldLabel })
            });
            const data = await res.json();
            if (data.success && data.improvedText) {
                onValueChange(data.improvedText);
            } else {
                setImproveError(data.error || 'No se pudo mejorar el texto.');
            }
        } catch (err) {
            console.error('Error improving text:', err);
            setImproveError('Error al conectar con la IA.');
        } finally {
            setIsImproving(false);
        }
    };

    return (
        <div className="flex flex-col flex-1">
            <div className="relative w-full flex-1">
                <textarea
                    {...props}
                    value={value}
                    onChange={(event) => onValueChange(event.target.value)}
                    className={`${className} pr-11`}
                />
                {enableAI && (
                    <button
                        type="button"
                        onClick={improveWithAI}
                        disabled={isImproving || !value.trim()}
                        title="Mejorar redacción con IA (mantiene tu estilo)"
                        className={`absolute right-2 top-12 w-8 h-8 rounded-lg flex items-center justify-center transition-all border ${
                            improveError
                                ? 'bg-amber-50 text-amber-600 border-amber-300 hover:bg-amber-100'
                                : 'bg-white/80 text-violet-500 hover:text-violet-600 hover:bg-violet-50 border-violet-200/80'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                        {isImproving ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    </button>
                )}
                <button
                    type="button"
                    onClick={toggleDictation}
                    disabled={!isSupported}
                    title={
                        isSafariHTTP
                            ? 'Safari bloquea el dictado de voz sobre HTTP. Usa Google Chrome.'
                            : error
                                ? getFriendlyErrorMessage(error)
                                : isSupported
                                    ? 'Dictar con voz'
                                    : 'Dictado no disponible en este navegador'
                    }
                    className={`absolute right-2 top-2.5 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        isListening
                            ? 'bg-red-100 text-red-600 animate-pulse border-red-300'
                            : error || isSafariHTTP
                                ? 'bg-amber-50 text-amber-600 border-amber-300 hover:bg-amber-100'
                                : 'bg-white/80 text-slate-400 hover:text-primary hover:bg-slate-50 border-slate-200/80'
                    } disabled:opacity-40 disabled:cursor-not-allowed border`}
                >
                    {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
            </div>
            {(error && error !== 'no-speech') || isSafariHTTP ? (
                <p className="mt-1 text-xs text-amber-700 font-medium bg-amber-50 px-2 py-1.5 rounded border border-amber-200 flex items-center gap-1.5 animate-fadeIn">
                    <span>⚠️</span>{' '}
                    {isSafariHTTP
                        ? 'Safari bloquea el dictado de voz sobre HTTP. Abre la aplicación en Google Chrome o configura HTTPS.'
                        : getFriendlyErrorMessage(error || '')}
                </p>
            ) : null}
            {improveError ? (
                <p className="mt-1 text-xs text-amber-700 font-medium bg-amber-50 px-2 py-1.5 rounded border border-amber-200 flex items-center gap-1.5 animate-fadeIn">
                    <span>⚠️</span> {improveError}
                </p>
            ) : null}
        </div>
    );
};
