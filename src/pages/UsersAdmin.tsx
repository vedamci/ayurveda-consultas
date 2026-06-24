import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { User, Loader2, ShieldCheck, Mail, Calendar, Key, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
}

const UsersAdmin: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      } else {
        setError(data.error || 'Error al cargar los usuarios.');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Error de conexión al cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      setUpdatingId(userId);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setUsers(prev =>
          prev.map(u => (u.id === userId ? { ...u, role: newRole } : u))
        );
        setSuccessMsg(`Rol actualizado correctamente para el usuario.`);
        
        // Auto fade success message after 4s
        setTimeout(() => {
          setSuccessMsg(null);
        }, 4000);
      } else {
        setError(data.error || 'No se pudo actualizar el rol.');
      }
    } catch (err) {
      console.error('Error changing role:', err);
      setError('Error de conexión al cambiar el rol.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Control de Accesos y Perfiles</h1>
            <p className="text-sm text-slate-500 mt-1">Gestiona los roles y permisos de los profesionales del sistema.</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-100">
            <ShieldCheck size={16} />
            <span>Administrador Principal Activo</span>
          </div>
        </div>

        {/* Notifications */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-start gap-3"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-semibold">Ha ocurrido un error</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-start gap-3"
            >
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold">Operación exitosa</p>
                <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table Card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3">
              <Loader2 size={36} className="text-emerald-600 animate-spin" />
              <span className="text-sm text-slate-500 font-medium">Obteniendo lista de usuarios…</span>
            </div>
          ) : users.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-center">
              <User size={48} className="text-slate-300" />
              <h3 className="text-base font-semibold text-slate-700">Sin usuarios registrados</h3>
              <p className="text-xs text-slate-400 max-w-xs">Actualmente no existen otros profesionales registrados en el sistema.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-4 px-6">Usuario</th>
                    <th className="py-4 px-6">Correo</th>
                    <th className="py-4 px-6">Fecha Registro</th>
                    <th className="py-4 px-6 text-right">Rol de Acceso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {users.map(u => {
                    const isPrimaryAdmin = u.email === 'krishnadas@vedamci.com.mx';
                    const isUpdating = updatingId === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-semibold border border-slate-200/50">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{u.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">ID: {u.id.substring(0, 8)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm text-slate-600 font-medium">
                          <div className="flex items-center gap-2">
                            <Mail size={14} className="text-slate-400" />
                            <span>{u.email}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm text-slate-500">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-slate-400" />
                            <span>{new Date(u.createdAt).toLocaleDateString('es-MX', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="inline-flex items-center gap-2.5">
                            {isUpdating && <Loader2 size={13} className="animate-spin text-emerald-600" />}
                            
                            {isPrimaryAdmin ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-xl border border-amber-100 select-none">
                                <Key size={13} />
                                <span>Admin Principal</span>
                              </div>
                            ) : (
                              <select
                                disabled={isUpdating}
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value as 'admin' | 'user')}
                                className={`text-xs font-semibold rounded-xl px-3 py-1.5 border focus:outline-none focus:ring-2 focus:ring-emerald-500/10 cursor-pointer ${
                                  u.role === 'admin'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 focus:border-emerald-500/50'
                                    : 'bg-slate-50 border-slate-200 text-slate-600 focus:border-slate-400'
                                }`}
                              >
                                <option value="user">Usuario (Consulta)</option>
                                <option value="admin">Administrador</option>
                              </select>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default UsersAdmin;
