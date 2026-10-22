import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import EventCard from '../components/EventCard';
import GameDetailsModal from '../components/GameDetailsModal';
import UserAvatar from '../components/UserAvatar';
import { API_BASE, authHeaders } from '../utils/api';
import type { RawgGame } from '../types/game';
import { processAvatarImage } from '../utils/imageUpload';

type ProfileData = {
  user: {
    id: number;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    avatar_path: string | null;
    bio: string | null;
    library_private: boolean;
    library_visibility?: 'nobody' | 'friends' | 'everyone';
    created_at: string;
  };
  viewer: {
    is_self: boolean;
    is_friend: boolean;
    can_view_library: boolean;
  };
  library: Array<{
    id: number;
    game_id: number;
    title: string;
    rawg: RawgGame | null;
    is_favorite: boolean;
    user_rating: number | null;
  }>;
};

export default function UserProfilePage() {
  const { id, username } = useParams();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [message, setMessage] = useState('');
  const [selectedGame, setSelectedGame] = useState<RawgGame | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLibraryVisibility, setEditLibraryVisibility] = useState<'nobody' | 'friends' | 'everyone'>('everyone');
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function loadProfile() {
    try {
      const endpoint = id
        ? `${API_BASE}/api/users/${id}/profile`
        : `${API_BASE}/api/users/by-username/${encodeURIComponent(username || '')}/profile`;
      const res = await fetch(endpoint, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Profil konnte nicht geladen werden');
      setProfile(data);
      setEditDisplayName(data.user.display_name || '');
      setEditAvatarUrl(data.user.avatar_url || '');
      setEditBio(data.user.bio || '');
      setEditLibraryVisibility(data.user.library_visibility || 'everyone');
    } catch (e: any) {
      setMessage(e.message || 'Profil konnte nicht geladen werden');
    }
  }

  useEffect(() => {
    loadProfile();
  }, [id, username]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/users/me/settings`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          display_name: editDisplayName,
          avatar_url: editAvatarUrl,
          bio: editBio,
          library_visibility: editLibraryVisibility
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Profil konnte nicht gespeichert werden');
      setMessage('Profil gespeichert');
      setIsEditing(false);
      await loadProfile();
    } catch (e: any) {
      setMessage(e.message || 'Profil konnte nicht gespeichert werden');
    }
  }

  async function uploadAvatarFile(file: File) {
    setUploadingAvatar(true);
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
      setEditAvatarUrl(data.avatar_url || '');
      setProfile((prev) => prev ? ({ ...prev, user: { ...prev.user, avatar_url: data.avatar_url || null, avatar_path: data.avatar_path || prev.user.avatar_path || null } }) : prev);
      setMessage('Avatar hochgeladen');
    } catch (e: any) {
      setMessage(e.message || 'Avatar-Upload fehlgeschlagen');
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      {!profile && <div className="text-slate-300">{message || 'Lade Profil...'}</div>}
      {profile && (
        <>
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-3 flex items-center gap-4">
              <UserAvatar name={profile.user.display_name || profile.user.username} avatarUrl={profile.user.avatar_url} sizeClassName="h-16 w-16" />
              <div>
                <h1 className="text-3xl font-bold">{profile.user.display_name || profile.user.username}</h1>
                <p className="text-slate-400">@{profile.user.username}</p>
              </div>
            </div>
            {profile.user.bio && <p className="mb-2 text-slate-300">{profile.user.bio}</p>}
            <p className="mt-2 text-sm text-slate-400">
              {profile.viewer.is_self ? 'Das ist dein Profil.' : profile.viewer.is_friend ? 'Ihr seid befreundet.' : 'Nicht befreundet.'}
            </p>
            {profile.viewer.is_self && (
              <div className="mt-3 flex gap-2">
                <button type="button" className="rounded bg-cyan-500 px-3 py-1 text-sm font-semibold text-slate-950" onClick={() => setIsEditing((v) => !v)}>
                  {isEditing ? 'Bearbeiten schließen' : 'Profil bearbeiten'}
                </button>
                <Link to="/settings" className="rounded bg-slate-700 px-3 py-1 text-sm font-semibold text-slate-100 hover:bg-slate-600">
                  Erweiterte Einstellungen
                </Link>
              </div>
            )}
          </div>

          {profile.viewer.is_self && isEditing && (
            <form onSubmit={saveProfile} className="mb-6 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-xl font-semibold">Profil bearbeiten</h2>
              <label className="grid gap-2">
                <span className="text-sm text-slate-300">Angezeigter Name</span>
                <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white" value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} maxLength={60} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-slate-300">Avatar URL</span>
                <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white" value={editAvatarUrl} onChange={(e) => setEditAvatarUrl(e.target.value)} maxLength={500} />
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
                <textarea className="min-h-24 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white" value={editBio} onChange={(e) => setEditBio(e.target.value)} maxLength={500} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-slate-300">Library Sichtbarkeit</span>
                <select
                  className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  value={editLibraryVisibility}
                  onChange={(e) => setEditLibraryVisibility(e.target.value as 'nobody' | 'friends' | 'everyone')}
                >
                  <option value="nobody">Niemand</option>
                  <option value="friends">Freunde</option>
                  <option value="everyone">Jeder</option>
                </select>
              </label>
              <button type="submit" className="w-fit rounded bg-cyan-500 px-4 py-2 font-semibold text-slate-950">Speichern</button>
            </form>
          )}

          {message && (
            <div className="mb-6 rounded border border-slate-700 bg-slate-900 p-3 text-sm text-slate-300">{message}</div>
          )}

          {!profile.viewer.can_view_library ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
              Die Library dieses Users ist privat.
            </div>
          ) : (
            <div>
              <h2 className="mb-3 text-2xl font-semibold">Library</h2>
              {profile.library.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">Keine Spiele in der Library.</div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {profile.library.filter((entry) => entry.rawg).map((entry) => (
                    <div key={entry.id} className="space-y-2">
                      <EventCard game={entry.rawg as RawgGame} onSelect={setSelectedGame} />
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300">
                        <div>{entry.is_favorite ? '★ Favorit' : '☆ Kein Favorit'}</div>
                        <div>Bewertung: {entry.user_rating ? `${entry.user_rating}/10` : 'Keine'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <GameDetailsModal game={selectedGame} onClose={() => setSelectedGame(null)} />
        </>
      )}
    </main>
  );
}
