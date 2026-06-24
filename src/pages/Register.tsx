import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Leaf, AlertCircle, Loader2, ArrowRight, CheckCircle } from 'lucide-react';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Por favor, completa todos los campos.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await register(name, email, password);
      if (res.success) {
        navigate('/dashboard');
      } else {
        setError(res.error || 'Error al registrar el usuario');
      }
    } catch (err) {
      setError('Ocurrió un error al intentar registrar el usuario. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const isSpecialAdmin = email.trim().toLowerCase() === 'krishnadas@vedamci.com.mx';

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden select-none"
      style={{
        background: 'radial-gradient(circle at top left, #0e1e15 0%, #060e0a 50%, #040705 100%)'
      }}
    >
      {/* Decorative Blur Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Brand/Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <div 
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 relative"
            style={{
              background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(212,168,83,0.1) 100%)',
              border: '1px solid rgba(34,197,94,0.15)'
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
            >
              <Leaf size={28} className="text-emerald-500" />
            </motion.div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">PranaCare</h1>
          <p 
            className="text-xs uppercase tracking-widest font-semibold mt-1"
            style={{
              background: 'linear-gradient(90deg, #D4A853, #F5E6C8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Clínica Ayurvédica
          </p>
        </div>

        {/* Register Card */}
        <div 
          className="rounded-3xl p-8 backdrop-blur-xl border shadow-2xl relative"
          style={{
            backgroundColor: 'rgba(15, 27, 20, 0.45)',
            borderColor: 'rgba(255, 255, 255, 0.05)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">Crear Cuenta</h2>
            <p className="text-slate-400 text-xs mt-1">Regístrate para acceder al panel clínico</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl p-3 text-xs flex items-start gap-2.5 overflow-hidden"
                >
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Nombre Completo
              </label>
              <div className="relative group">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu Nombre Completo"
                  className="w-full bg-black/30 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Correo Electrónico
              </label>
              <div className="relative group">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@vedamci.com.mx"
                  className="w-full bg-black/30 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-slate-600"
                />
              </div>
              <AnimatePresence>
                {isSpecialAdmin && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5 text-[10px] text-amber-400 font-semibold px-1 mt-1"
                  >
                    <CheckCircle size={10} className="text-amber-400" />
                    <span>Este correo se registrará automáticamente como Administrador Principal.</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Contraseña
              </label>
              <div className="relative group">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-black/30 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <span>Registrarse y Acceder</span>
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/[0.04] text-center text-xs">
            <span className="text-slate-500">¿Ya tienes una cuenta? </span>
            <Link 
              to="/login" 
              className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors ml-1"
            >
              Inicia sesión aquí
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
