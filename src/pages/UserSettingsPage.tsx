import { FormEvent, useEffect, useState } from 'react';
import { API_BASE, authHeaders } from '../utils/api';
import UserAvatar from '../components/UserAvatar';
import { processAvatarImage } from '../utils/imageUpload';

type SettingsResponse = {
  id: number;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string;
  avatar_path: string;
  bio: string;
  library_private: boolean;
  library_visibility: 'nobody' | 'friends' | 'everyone';
};

export default function UserSettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [libraryVisibility, setLibraryVisibility] = useState<'nobody' | 'friends' | 'everyone'>('everyone');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function loadSettings() {
    try {
      const res = await fetch(`${API_BASE}/api/users/me/settings`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Fehler beim Laden');
      setSettings(data);
      setDisplayName(data.display_name || '');
      setAvatarUrl(data.avatar_url || '');
      setBio(data.bio || '');
      setLibraryVisibility(data.library_visibility || 'everyone');
    } catch (e: any) {
      setMessage(e.message || 'Fehler beim Laden der Einstellungen');
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function saveProfileSettings(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/users/me/settings`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ display_name: displayName, avatar_url: avatarUrl, bio, library_visibility: libraryVisibility })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Fehler beim Speichern');
      setSettings(data);
      setDisplayName(data.display_name || '');
      setAvatarUrl(data.avatar_url || '');
      setBio(data.bio || '');
      setLibraryVisibility(data.library_visibility || 'everyone');
      setMessage('Einstellungen gespeichert');
    } catch (e: any) {
      setMessage(e.message || 'Fehler beim Speichern');
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/users/me/change-password`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Fehler beim Passwortwechsel');
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Passwort geändert');
    } catch (e: any) {
      setMessage(e.message || 'Fehler beim Passwortwechsel');
    }
  }

  async function uploadAvatarFile(file: File) {
    setUploadingAvatar(true);
    setMessage('');
    try {
      const token = localStorage.getItem('squadtime_token');
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = 'Bearer ' + token;
      const processed = await processAvatarImage(file, 512, 0.82);
      const formData = new FormData();
      formData.append('avatar', processed);
      const res = await fetch(`${API_BASE}/api/users/me/avatar-upload`, {
        method: 'POST',
        headers,
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Avatar-Upload fehlgeschlagen');
      const nextUrl = data.avatar_url || '';
      setAvatarUrl(nextUrl);
      setSettings((prev) => (prev ? { ...prev, avatar_url: nextUrl, avatar_path: data.avatar_path || prev.avatar_path } : prev));
      setMessage('Avatar erfolgreich hochgeladen');
    } catch (e: any) {
      setMessage(e.message || 'Avatar-Upload fehlgeschlagen');
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="mb-2 text-3xl font-bold">User Einstellungen</h1>
      <p className="mb-6 text-slate-400">Passe deinen angezeigten Namen, Privatsphäre und Passwort an.</p>

      {settings && (
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
          <div className="mb-3 flex items-center gap-3">
            <UserAvatar name={displayName || settings.username} avatarUrl={avatarUrl || settings.avatar_url} sizeClassName="h-12 w-12" />
            <div>
              <div>Benutzername: {settings.username}</div>
              <div>E-Mail: {settings.email}</div>
              <div className="max-w-xl truncate text-xs text-slate-500">Avatar-Pfad (Server): {settings.avatar_path || '-'}</div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={saveProfileSettings} className="mb-6 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-xl font-semibold">Profil</h2>
        <label className="grid gap-2">
          <span className="text-sm text-slate-300">Angezeigter Name</span>
          <input
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-slate-300">Avatar URL</span>
          <input
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            maxLength={500}
            placeholder="https://..."
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-slate-300">Avatar hochladen</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files && e.target.files[0];
              if (file) uploadAvatarFile(file);
            }}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          />
          {uploadingAvatar && <span className="text-xs text-slate-400">Upload läuft…</span>}
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-slate-300">Bio</span>
          <textarea
            className="min-h-24 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-slate-300">Library Sichtbarkeit</span>
          <select
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            value={libraryVisibility}
            onChange={(e) => setLibraryVisibility(e.target.value as 'nobody' | 'friends' | 'everyone')}
          >
            <option value="nobody">Niemand</option>
            <option value="friends">Freunde</option>
            <option value="everyone">Jeder</option>
          </select>
        </label>
        <button type="submit" className="w-fit rounded bg-cyan-500 px-4 py-2 font-semibold text-slate-950">Speichern</button>
      </form>

      <form onSubmit={changePassword} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-xl font-semibold">Passwort ändern</h2>
        <label className="grid gap-2">
          <span className="text-sm text-slate-300">Aktuelles Passwort</span>
          <input
            type="password"
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-slate-300">Neues Passwort</span>
          <input
            type="password"
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
          />
        </label>
        <button type="submit" className="w-fit rounded bg-cyan-500 px-4 py-2 font-semibold text-slate-950">Passwort ändern</button>
      </form>

      {message && <div className="mt-4 text-sm text-slate-300">{message}</div>}
    </main>
  );
}
