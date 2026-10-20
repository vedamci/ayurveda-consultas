import { useCallback, useEffect, useState } from 'react';
import type { PatientDetail } from '../types/patient';
import { TreatmentPDFModal } from '../components/patients/TreatmentPDFModal';

type RecordType = 'plan' | 'visit';
type NativePdfResult =
  | { status: 'loading' }
  | { status: 'ready'; pdfBase64: string }
  | { status: 'error'; error: string };

declare global {
  interface Window {
    __VEDAMCI_NATIVE_PDF_RESULT__?: NativePdfResult;
  }
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return window.btoa(binary);
};

export default function McpNativePdf() {
  const [patient, setPatient] = useState<(PatientDetail & { id?: string }) | null>(null);
  const [record, setRecord] = useState<any>(null);
  const [recordType, setRecordType] = useState<RecordType>('plan');

  const fail = useCallback((error: string) => {
    window.__VEDAMCI_NATIVE_PDF_RESULT__ = { status: 'error', error };
  }, []);

  const handlePdfReady = useCallback((bytes: Uint8Array) => {
    window.__VEDAMCI_NATIVE_PDF_RESULT__ = { status: 'ready', pdfBase64: toBase64(bytes) };
  }, []);

  useEffect(() => {
    window.__VEDAMCI_NATIVE_PDF_RESULT__ = { status: 'loading' };
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patient_id') || '';
    const recordId = params.get('record_id') || '';
    if (!patientId || !recordId) {
      fail('Faltan los identificadores de paciente y tratamiento.');
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const payload = await response.json();
        if (!response.ok || !payload?.success || !payload.patient) {
          throw new Error(payload?.error || 'No se pudo leer el expediente del paciente.');
        }
        const patientData = payload.patient;
        const plan = (patientData.treatmentPlans || []).find((item: any) => item?.id === recordId);
        const visit = (patientData.visits || []).find((item: any) => item?.id === recordId);
        const selectedRecord = plan || visit;
        if (!selectedRecord) throw new Error('El tratamiento no existe en el expediente.');
        if (cancelled) return;
        setPatient(patientData);
        setRecord(selectedRecord);
        setRecordType(plan ? 'plan' : 'visit');
      } catch (error: any) {
        if (!cancelled) fail(String(error?.message || error));
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [fail]);

  if (!patient || !record) return <main aria-hidden="true" />;

  const format = new URLSearchParams(window.location.search).get('format') === 'mobile'
    ? 'mobile'
    : 'desktop';

  return (
    <main aria-hidden="true">
      <TreatmentPDFModal
        isOpen
        onClose={() => undefined}
        patient={patient}
        patientId={patient.id}
        initialDiagnosis={record.diagnosis || null}
        editingRecord={{ type: recordType, record }}
        mcpAutoGenerate
        mcpPdfFormat={format}
        onMcpPdfReady={handlePdfReady}
        onMcpPdfError={fail}
      />
    </main>
  );
}
