import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Set up global fetch interceptor to append the Authorization header
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' 
    ? input 
    : input instanceof URL 
      ? input.toString() 
      : input.url;
  
  // Attach token to all /api/ requests
  if (url.includes('/api/')) {
    const token = localStorage.getItem('token');
    if (token) {
      init = init || {};
      const headers = init.headers || {};
      
      if (headers instanceof Headers) {
        headers.set('Authorization', `Bearer ${token}`);
      } else if (Array.isArray(headers)) {
        headers.push(['Authorization', `Bearer ${token}`]);
      } else {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }
      init.headers = headers;
    }
  }
  return originalFetch(input, init);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check login state on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setUser(data.user);
          } else {
            localStorage.removeItem('token');
          }
        } else {
          localStorage.removeItem('token');
        }
      } catch (err) {
        console.error('Error during auto-auth verification:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Credenciales inválidas' };
      }

      localStorage.setItem('token', data.token);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      console.error('Error in login function:', err);
      return { success: false, error: 'Error de red al iniciar sesión. Inténtelo de nuevo.' };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Error al registrar usuario' };
      }

      localStorage.setItem('token', data.token);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      console.error('Error in register function:', err);
      return { success: false, error: 'Error de red al registrarse. Inténtelo de nuevo.' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
