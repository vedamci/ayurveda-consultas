import React from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

/**
 * Error Boundary global (fix #4 — estabilidad).
 *
 * Antes, un error de render en cualquier pantalla (p. ej. al generar el PDF o al
 * abrir una ficha con datos inesperados) podía tumbar toda la ventana de Electron
 * y dar la sensación de que "la app se reinicia". Con este límite de error, el
 * fallo queda contenido: se muestra un mensaje recuperable y el resto del estado
 * en memoria no se pierde de golpe. El profesional puede reintentar o recargar.
 */
export class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    ErrorBoundaryState
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Log para diagnóstico (visible en la consola de Electron).
        console.error('[ErrorBoundary] Error de render capturado:', error, info);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: undefined });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div
                    style={{
                        minHeight: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem',
                        background: '#f8fafc',
                        fontFamily: 'system-ui, sans-serif'
                    }}
                >
                    <div
                        style={{
                            maxWidth: 520,
                            background: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 16,
                            padding: '2rem',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.06)'
                        }}
                    >
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                            Algo salió mal en esta pantalla
                        </h1>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1rem' }}>
                            La aplicación detuvo esta vista para no cerrarse por completo. Tu información
                            guardada sigue a salvo. Puedes intentar continuar o recargar la app.
                        </p>
                        {this.state.error?.message && (
                            <pre
                                style={{
                                    background: '#f1f5f9',
                                    color: '#b91c1c',
                                    padding: '0.75rem',
                                    borderRadius: 8,
                                    fontSize: '0.8rem',
                                    overflowX: 'auto',
                                    marginBottom: '1rem',
                                    whiteSpace: 'pre-wrap'
                                }}
                            >
                                {this.state.error.message}
                            </pre>
                        )}
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={this.handleReset}
                                style={{
                                    background: '#0f766e',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 10,
                                    padding: '0.6rem 1.1rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                Intentar de nuevo
                            </button>
                            <button
                                onClick={this.handleReload}
                                style={{
                                    background: '#e2e8f0',
                                    color: '#0f172a',
                                    border: 'none',
                                    borderRadius: 10,
                                    padding: '0.6rem 1.1rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                Recargar la app
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
