import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import PatientBooking from '../src/pages/PatientBooking';
import { AuthProvider } from '../src/context/AuthContext';
import '../src/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <PatientBooking />
    </AuthProvider>
  </StrictMode>,
);
