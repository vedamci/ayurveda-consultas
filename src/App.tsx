import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';

import DiagnosticMap from './pages/DiagnosticMap';
import Patients from './pages/Patients';
import Prescriptions from './pages/Prescriptions';
import Analytics from './pages/Analytics';
import Schedule from './pages/Schedule';
import PatientIntakeForm from './pages/PatientIntakeForm';
import PatientBooking from './pages/PatientBooking';
import Login from './pages/Login';
import Register from './pages/Register';
import UsersAdmin from './pages/UsersAdmin';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Public Patient Routes */}
          <Route path="/ingreso-paciente" element={<PatientIntakeForm />} />
          <Route path="/reservar" element={<PatientBooking />} />

          {/* Protected Clinical Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/consultation" element={<Navigate to="/patients" replace />} />
            <Route path="/map" element={<DiagnosticMap />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/prescriptions" element={<Prescriptions />} />
            <Route path="/analytics" element={<Analytics />} />
          </Route>

          {/* Protected Admin Routes */}
          <Route element={<AdminRoute />}>
            <Route path="/usuarios" element={<UsersAdmin />} />
          </Route>

          {/* Catch-all redirect to login or dashboard depending on auth */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
