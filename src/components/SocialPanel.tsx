import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE, authHeaders as apiAuthHeaders } from '../utils/api';
import UserAvatar from './UserAvatar';

type UserSummary = { id: number; username: string; display_name?: string | null; avatar_url?: string | null; library_private?: boolean };

type FriendRequest = { id: number; from_user: number; from_username: string; created_at: string };

export default function SocialPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [friends, setFriends] = useState<UserSummary[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [message, setMessage] = useState('');

  const API_ROOT = `${API_BASE}/api/users`;

  function authHeaders() {
    return apiAuthHeaders();
  }

  async function search() {
    if (!query) return setResults([]);
    try {
      const res = await fetch(`${API_ROOT}/search?q=${encodeURIComponent(query)}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data);
    } catch (err) {
      setMessage('Fehler bei der Suche');
    }
  }

  async function fetchFriends() {
    try {
      const res = await fetch(`${API_ROOT}/friends`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setFriends(data);
    } catch (e) {}
  }

  async function fetchRequests() {
    try {
      const res = await fetch(`${API_ROOT}/requests`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setRequests(data);
    } catch (e) {}
  }

  useEffect(() => {
    fetchFriends();
    fetchRequests();
  }, []);

  async function sendRequest(userId: number) {
    try {
      const res = await fetch(`${API_ROOT}/friends/request`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ toUserId: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Request failed');
      setMessage('Anfrage gesendet');
    } catch (e) {
      setMessage('Konnte Anfrage nicht senden');
    }
  }

  async function acceptRequest(fromUserId: number) {
    try {
      const res = await fetch(`${API_ROOT}/friends/accept`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ fromUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Accept failed');
      setMessage('Anfrage angenommen');
      fetchFriends();
      fetchRequests();
    } catch (e) {
      setMessage('Konnte Anfrage nicht annehmen');
    }
  }

  async function removeFriend(userId: number) {
    try {
      const res = await fetch(`${API_ROOT}/friends/remove`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Remove failed');
      setMessage('Freund entfernt');
      fetchFriends();
    } catch (e) {
      setMessage('Konnte Freund nicht entfernen');
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
      <h2 className="text-2xl font-semibold mb-3">Freunde & Suche</h2>
      <div className="flex gap-2 mb-3">
        <input
          className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-white"
          placeholder="Nach Benutzernamen oder E-Mail suchen"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="rounded-2xl bg-cyan-500 px-4 py-2" onClick={search}>Suchen</button>
      </div>

      {message && <div className="text-sm text-slate-300 mb-3">{message}</div>}

      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <h3 className="text-lg font-medium mb-2">Treffer</h3>
          <ul className="flex flex-col gap-2">
            {results.map((u) => (
              <li key={u.id} className="flex items-center justify-between rounded-xl border border-slate-700 p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <UserAvatar name={u.display_name || u.username} avatarUrl={u.avatar_url} sizeClassName="h-8 w-8" />
                    <div>
                      <Link className="text-cyan-400 hover:underline" to={`/u/${u.username}`}>{u.display_name || u.username}</Link>
                      <div className="text-xs text-slate-500">@{u.username}</div>
                    </div>
                  </div>
                </div>
                <div>
                  <button className="rounded-lg bg-slate-700 px-3 py-1 text-sm" onClick={() => sendRequest(u.id)}>Freundschaftsanfrage</button>
                </div>
              </li>
            ))}
            {results.length === 0 && <li className="text-slate-400">Keine Treffer</li>}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Freunde</h3>
          <ul className="flex flex-col gap-2">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-xl border border-slate-700 p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <UserAvatar name={f.display_name || f.username} avatarUrl={f.avatar_url} sizeClassName="h-8 w-8" />
                    <div>
                      <Link className="text-cyan-400 hover:underline" to={`/u/${f.username}`}>{f.display_name || f.username}</Link>
                      <div className="text-xs text-slate-500">@{f.username}</div>
                    </div>
                  </div>
                </div>
                <div>
                  <button className="rounded-lg bg-red-600 px-3 py-1 text-sm" onClick={() => removeFriend(f.id)}>Entfernen</button>
                </div>
              </li>
            ))}
            {friends.length === 0 && <li className="text-slate-400">Keine Freunde</li>}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Eingehende Anfragen</h3>
          <ul className="flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-xl border border-slate-700 p-3">
                <div>
                  <Link className="text-cyan-400 hover:underline" to={`/u/${r.from_username}`}>{r.from_username}</Link>
                </div>
                <div>
                  <button className="rounded-lg bg-cyan-600 px-3 py-1 text-sm mr-2" onClick={() => acceptRequest(r.from_user)}>Annehmen</button>
                </div>
              </li>
            ))}
            {requests.length === 0 && <li className="text-slate-400">Keine Anfragen</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
