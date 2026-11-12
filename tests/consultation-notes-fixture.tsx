import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConsultationNotes } from '../src/components/patients/ConsultationNotes';
import '../src/index.css';
function Fixture() {
    const [expanded, setExpanded] = useState(false);
    const params = new URLSearchParams(location.search);
    const patient = params.has('empty') ? { fullNotes: '' } : {
        fullNotes: '**Salud y Antecedentes**\n- Motivo Consulta: Objetivo ficticio conservado.\n- Antecedente: Texto de prueba.\n\n**Detalles Dieta**\n- Cantidad ficticia: **½ taza**, 25 minutos.\n\n**Notas del Profesional**\nSegunda línea conservada.\n\n| Campo | Valor |\n|---|---|\n| Cantidad ficticia | 0.25 g |',
        clinicalData: params.has('legacy') ? undefined : { 'Propósito de Consulta': '**Objetivo de prueba**\nTexto completo de la ficha de ingreso.' },
    };
    const record = params.has('empty') ? undefined : { treatment: '## Tratamiento sintético\n1. Fórmula ficticia: **0.25 g**.\n2. Cantidad ficticia: ½ taza, 1–2 veces.\n\n![Imagen de prueba](https://example.invalid/tracker)\n\n<script>window.__unsafe = true</script>' };
    return <main className="mx-auto my-6 max-w-[480px]"><h1 className="mb-4 px-6 text-lg font-bold">Prueba sintética de notas</h1><ConsultationNotes patient={patient} record={record} expanded={expanded} onToggle={() => setExpanded(value => !value)} /></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
