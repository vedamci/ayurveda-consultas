import React from 'react';
import { createRoot } from 'react-dom/client';
import { TreatmentPDFModal } from '../src/components/patients/TreatmentPDFModal';
import '../src/index.css';

// Keep test failures inside the fixture instead of interrupting the user's UI.
window.alert = message => {
    let output = document.getElementById('pdf-test-error');
    if (!output) {
        output = document.createElement('output');
        output.id = 'pdf-test-error';
        output.style.cssText = 'position:fixed;inset:0 0 auto;z-index:9999;background:white;color:#7a1f2b;padding:1rem';
        document.body.appendChild(output);
    }
    output.textContent = String(message);
};

const patient = {
    name: 'PRUEBA PDF SIN DATOS PERSONALES', age: '', email: '', dosha: 'Vata',
    fullNotes: '', symptomCalibrations: [], plainSymptoms: [], visits: [], treatmentPlans: [],
};
const record = {
    title: 'Prueba técnica de descarga', date: '2026-10-16', visitDate: '2026-10-16',
    diagnosis: 'Contenido ficticio para comprobar el PDF.',
    patientDiagnosis: 'Documento de prueba sin información personal.',
    treatment: 'Texto de prueba: áéíóú, ñ y enlaces.',
    patientTreatment: 'Texto ficticio con acentos: áéíóú, ñ. [Enlace de prueba](https://example.com/pdf-test).\n\n![Imagen ficticia](/tests/pdf-fixture-image.svg)',
    lifestyle: '', patientLifestyle: '', dosha: 'Vata', herbs: [], categories: [], recipes: [],
    showLifestylePage: false, showDiagnosis: true, showHealthyEatingGuide: false,
    showRecipesSection: false, showTherapiesSection: false, healthyEatingHabits: [],
};
if (new URLSearchParams(window.location.search).has('long')) {
    record.patientTreatment += '\n\n' + Array.from({ length: 16 }, (_, index) => `Párrafo ficticio ${index + 1}. ` + 'Texto largo de prueba para comprobar márgenes, tipografía y saltos de renglón. '.repeat(8)).join('\n\n');
}
createRoot(document.getElementById('root')!).render(<TreatmentPDFModal
    isOpen={true} onClose={() => {}} patient={patient} initialDiagnosis={null}
    editingRecord={{ type: 'plan', record }}
/>);
