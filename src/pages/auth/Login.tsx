import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { Rocket } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { session } = useAuth();
  
  // If already logged in, redirect
  if (session) {
    navigate('/teacher/classes', { replace: true });
    return null;
  }

  const isMock = import.meta.env.VITE_DATA_SOURCE !== 'supabase';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (isMock) {
      // Mock mode handles auto-login in context, but if they reach here, we just navigate
      navigate('/teacher/classes', { replace: true });
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      navigate('/teacher/classes', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cosmic-navy flex items-center justify-center p-4 font-sans text-white">
      <div className="w-full max-w-md bg-cosmic-panel border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-cosmic-cyan/10 blur-3xl rounded-full pointer-events-none"></div>
        
        <div className="relative z-10 text-center mb-8">
          <div className="bg-slate-800/50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
            <Rocket className="text-cosmic-cyan" size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Teacher Login</h1>
          <p className="text-slate-400 text-sm">Welcome back to your cosmic classroom.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-cosmic-cyan focus:ring-1 focus:ring-cosmic-cyan transition-all"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-cosmic-cyan focus:ring-1 focus:ring-cosmic-cyan transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center py-3 bg-cosmic-cyan text-slate-900 font-bold rounded-xl hover:bg-cyan-400 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-cosmic-cyan hover:underline font-medium">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
};
