import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { Rocket } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext';

export const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { session } = useAuth();
  
  if (session) {
    navigate('/teacher/classes', { replace: true });
    return null;
  }

  const isMock = import.meta.env.VITE_DATA_SOURCE !== 'supabase';

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    if (isMock) {
      navigate('/teacher/classes', { replace: true });
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        // Create teacher profile
        const { error: profileError } = await supabase
          .from('teacher_profiles')
          .insert({
            id: data.user.id,
            full_name: fullName
          });
          
        if (profileError) {
          console.error("Error creating profile:", profileError);
          // Don't throw here, user is already created, but we should handle it gracefully
        }
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cosmic-navy flex items-center justify-center p-4 font-sans text-white">
      <div className="w-full max-w-md bg-cosmic-panel border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-cosmic-purple/10 blur-3xl rounded-full pointer-events-none"></div>
        
        <div className="relative z-10 text-center mb-8">
          <div className="bg-slate-800/50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
            <Rocket className="text-cosmic-purple" size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Create Account</h1>
          <p className="text-slate-400 text-sm">Join the cosmic classroom and gamify learning.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm">
              Registration successful! You can now log in.
              (If email confirmation is enabled, please check your inbox).
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center py-3 bg-cosmic-cyan text-slate-900 font-bold rounded-xl hover:bg-cyan-400 transition-colors"
            >
              Go to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-cosmic-purple focus:ring-1 focus:ring-cosmic-purple transition-all"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-cosmic-purple focus:ring-1 focus:ring-cosmic-purple transition-all"
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
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-cosmic-purple focus:ring-1 focus:ring-cosmic-purple transition-all"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-cosmic-purple focus:ring-1 focus:ring-cosmic-purple transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center py-3 mt-2 bg-cosmic-purple hover:bg-purple-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-slate-200/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Register'
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-cosmic-purple hover:text-purple-400 hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
