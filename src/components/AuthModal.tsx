import React, { useState } from 'react';
import { register as apiRegister, login as apiLogin, saveToken, clearToken, getToken } from '../utils/auth';

const AuthModal: React.FC<{ open: boolean; onClose: () => void; onLoginSuccess?: () => void }> = ({ open, onClose, onLoginSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // login fields (username or email)
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // register fields
  const [username, setUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRegister(username.trim(), regEmail.trim(), regPassword);
      if (res && res.errors) {
        setError(res.errors.map((x: any) => x.msg).join(', '));
      } else if (res && res.message) {
        // success
        setTab('login');
      } else {
        setError('Unknown response from server');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiLogin(identifier.trim(), password);
      if (res && res.token) {
        saveToken(res.token);
        if (onLoginSuccess) onLoginSuccess();
        onClose();
      } else if (res && res.message) {
        setError(res.message);
      } else if (res && res.errors) {
        setError(res.errors.map((x: any) => x.msg).join(', '));
      } else {
        setError('Login failed');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-slate-800 p-6 text-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">{tab === 'login' ? 'Login' : 'Registrieren'}</h3>
          <div>
            <button
              onClick={() => setTab('login')}
              className={`px-3 py-1 rounded ${tab === 'login' ? 'bg-cyan-500 text-black' : 'bg-slate-700'}`}
            >
              Login
            </button>
            <button
              onClick={() => setTab('register')}
              className={`ml-2 px-3 py-1 rounded ${tab === 'register' ? 'bg-cyan-500 text-black' : 'bg-slate-700'}`}
            >
              Registrieren
            </button>
          </div>
        </div>

        {error && <div className="mb-3 rounded bg-red-600/60 px-3 py-2">{error}</div>}

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="grid gap-3">
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Benutzername oder Email" type="text" className="rounded px-3 py-2 text-black" required />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passwort" type="password" className="rounded px-3 py-2 text-black" required />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { clearToken(); onClose(); }} className="px-4 py-2 rounded bg-slate-600">Abbrechen</button>
              <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-cyan-500 text-black">{loading ? '…' : 'Login'}</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="grid gap-3">
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Benutzername" className="rounded px-3 py-2 text-black" required minLength={3} />
            <input value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="Email" type="email" className="rounded px-3 py-2 text-black" required />
            <input value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Passwort" type="password" className="rounded px-3 py-2 text-black" required minLength={6} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => onClose()} className="px-4 py-2 rounded bg-slate-600">Abbrechen</button>
              <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-cyan-500 text-black">{loading ? '…' : 'Registrieren'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
