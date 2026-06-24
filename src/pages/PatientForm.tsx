import { useState } from 'react';
import { motion } from 'framer-motion';
import { Save, User, Mail, Phone, CheckCircle, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export default function PatientForm() {
    const [formData, setFormData] = useState({
        patientName: '',
        age: '',
        email: '',
        phone: '',
        diet: '',
        commitment: '10',
        reason: '',
        consent: false,
        dataProtection: false,
        dosha: '',
        agniType: '',
        observations: ''
    });

    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setErrorMessage('');

        try {
            const response = await fetch('/api/consultation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                setStatus('success');
                setFormData({
                    patientName: '',
                    age: '',
                    email: '',
                    phone: '',
                    diet: '',
                    commitment: '10',
                    reason: '',
                    consent: false,
                    dataProtection: false,
                    dosha: '',
                    agniType: '',
                    observations: ''
                });
            } else {
                const data = await response.json();
                setStatus('error');
                setErrorMessage(data.error || 'Error desconocido');
            }
        } catch (error) {
            setStatus('error');
            setErrorMessage('Error de conexión con el servidor.');
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-bold text-gray-900">Ficha de Ingreso del Paciente</h1>
                    <p className="text-slate-500">Complete el formulario para registrar un nuevo paciente en el sistema.</p>
                </header>

                <form onSubmit={handleSubmit}>
                    <Card className="space-y-6">
                        {status === 'success' && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-3"
                            >
                                <CheckCircle size={24} />
                                <div>
                                    <p className="font-bold">¡Guardado con éxito!</p>
                                    <p className="text-sm">Los datos han sido enviados a Notion correctamente.</p>
                                </div>
                            </motion.div>
                        )}

                        {status === 'error' && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3"
                            >
                                <AlertCircle size={24} />
                                <div>
                                    <p className="font-bold">Error al guardar</p>
                                    <p className="text-sm">{errorMessage}</p>
                                </div>
                            </motion.div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Nombre Completo *</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-3 top-3.5 text-slate-400" />
                                    <input
                                        required
                                        name="patientName"
                                        value={formData.patientName}
                                        onChange={handleChange}
                                        type="text"
                                        className="w-full pl-10 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                                        placeholder="Juan Pérez"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Edad</label>
                                <input
                                    name="age"
                                    value={formData.age}
                                    onChange={handleChange}
                                    type="number"
                                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                                    placeholder="30"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Correo Electrónico *</label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3 top-3.5 text-slate-400" />
                                    <input
                                        required
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        type="email"
                                        className="w-full pl-10 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                                        placeholder="juan@ejemplo.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Teléfono / Celular *</label>
                                <div className="relative">
                                    <Phone size={18} className="absolute left-3 top-3.5 text-slate-400" />
                                    <input
                                        required
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        type="tel"
                                        className="w-full pl-10 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                                        placeholder="+52 555 555 5555"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">Hábitos Alimenticios (Dieta Actual)</label>
                            <textarea
                                name="diet"
                                value={formData.diet}
                                onChange={handleChange}
                                className="w-full h-32 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none resize-none"
                                placeholder="Describa desayuno, comida, cena, horarios y hábitos..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">Motivo de Consulta / Síntomas Principales</label>
                            <textarea
                                name="reason"
                                value={formData.reason}
                                onChange={handleChange}
                                className="w-full h-24 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none resize-none"
                                placeholder="Describa los síntomas principales..."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Compromiso con el Tratamiento (1-10)</label>
                                <input
                                    name="commitment"
                                    value={formData.commitment}
                                    onChange={handleChange}
                                    type="range"
                                    min="1"
                                    max="10"
                                    className="w-full accent-primary"
                                />
                                <div className="text-center font-bold text-xl text-primary">{formData.commitment}</div>
                            </div>

                            <div className="space-y-4 pt-6">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        name="dataProtection"
                                        checked={formData.dataProtection}
                                        onChange={handleChange}
                                        type="checkbox"
                                        className="w-5 h-5 rounded text-primary focus:ring-primary border-gray-300"
                                    />
                                    <span className="text-sm text-gray-600">Acepto la política de protección de datos.</span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        name="consent"
                                        checked={formData.consent}
                                        onChange={handleChange}
                                        type="checkbox"
                                        className="w-5 h-5 rounded text-primary focus:ring-primary border-gray-300"
                                    />
                                    <span className="text-sm text-gray-600">Doy mi consentimiento informado para la consulta.</span>
                                </label>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 flex justify-end">
                            <Button
                                type="submit"
                                disabled={status === 'loading'}
                                className="w-full md:w-auto min-w-[200px] flex items-center justify-center gap-2"
                            >
                                {status === 'loading' ? 'Guardando...' : 'Guardar Ficha'} <Save size={18} />
                            </Button>
                        </div>
                    </Card>
                </form>
            </div>
        </DashboardLayout>
    );
}
