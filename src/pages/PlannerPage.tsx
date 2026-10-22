import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE, authHeaders } from '../utils/api';
import UserAvatar from '../components/UserAvatar';

type Friend = {
  id: number;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

function parseJsonSafe(value: any) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
}

export default function PlannerPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [gameId, setGameId] = useState('');
  // Date + time range (open end supported)
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [openEnd, setOpenEnd] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [invites, setInvites] = useState<any[]>([]);

  // game selection + library + RAWG search
  const [library, setLibrary] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<any | null>(null);

  const [activeTab, setActiveTab] = useState<'create'|'all'|'invites'>('create');
  const [showOldSessions, setShowOldSessions] = useState(false);
  const [mySessions, setMySessions] = useState<any[]>([]);

  useEffect(() => {
    fetchFriends();
    fetchInvites();
    fetchLibrary();
    fetchMySessions();

    const interval = setInterval(() => {
      fetchInvites();
      fetchMySessions();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'all') {
      fetchMySessions();
    }
  }, [activeTab]);

  async function fetchMySessions() {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`, { headers: authHeaders() });
      if (res.status === 401) {
        localStorage.removeItem('squadtime_token');
        setMessage('Ungültiger Token. Bitte neu einloggen.');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.message || 'Sessions konnten nicht geladen werden');
        return;
      }
      const data = await res.json();
      setMySessions(data);
    } catch (e) {}
  }

  async function fetchFriends() {
    try {
      const res = await fetch(`${API_BASE}/api/users/friends`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setFriends(data);
    } catch (e) {}
  }

  async function fetchInvites() {
    try {
      const res = await fetch(`${API_BASE}/api/sessions/invites`, { headers: authHeaders() });
      if (res.status === 401) {
        localStorage.removeItem('squadtime_token');
        setMessage('Ungültiger Token. Bitte neu einloggen.');
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setInvites(data);
    } catch (e) {}
  }

  async function fetchLibrary() {
    try {
      const res = await fetch(`${API_BASE}/api/library`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setLibrary(data);
    } catch (e) {}
  }

  // replace with debounced search
  const debouncedSearchGames = (function() {
    let t: ReturnType<typeof setTimeout> | null = null;
    return (q: string) => {
      setSearchQuery(q);
      if (t) clearTimeout(t);
      t = setTimeout(async () => {
        if (!q || q.trim().length < 2) { setSearchResults([]); return; }
        try {
          const params = new URLSearchParams({ key: import.meta.env.VITE_RAWG_API_KEY || '', page_size: '10', search: q });
          const resp = await fetch(`https://api.rawg.io/api/games?${params.toString()}`);
          if (!resp.ok) { setSearchResults([]); return; }
          const data = await resp.json();
          setSearchResults(data.results || []);
        } catch (e) { setSearchResults([]); }
      }, 300);
    };
  })();

  function pickGameFromLibrary(item: any) {
    setSelectedGame(item.rawg || { id: item.game_id, title: item.title || item.game_id });
    setGameId(item.game_id || '');
  }

  function pickGameFromSearch(item: any) {
    setSelectedGame(item);
    setGameId(String(item.id || item.slug || ''));
    setSearchResults([]);
    setSearchQuery('');
  }

  function toggleFriend(id: number) {
    setSelectedFriends((s) => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  }

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    if (!date || !startTime) { setMessage('Bitte Datum und Startzeit angeben'); return; }
    // if not open end, endTime is required
    if (!openEnd && !endTime) { setMessage('Bitte Endzeit angeben oder Open end aktivieren'); return; }

    try {
      const start_at = `${date}T${startTime}:00`;
      const end_at = openEnd ? null : (endTime ? `${date}T${endTime}:00` : null);
      const body = { game_id: gameId, title, description, start_at, end_at, invitedUserIds: selectedFriends, rawg_json: selectedGame ? JSON.stringify(selectedGame) : null };
      const res = await fetch(`${API_BASE}/api/sessions`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
      const data = await res.json();
      if (res.status === 401) {
        // token invalid or missing
        localStorage.removeItem('squadtime_token');
        setMessage('Ungültiger Token. Bitte neu einloggen.');
        return;
      }
      if (!res.ok) throw new Error(data.message || 'Fehler');
      setMessage('Session erstellt');
      setTitle(''); setDescription(''); setGameId(''); setSelectedGame(null); setSearchQuery(''); setSearchResults([]);
      setDate(''); setStartTime(''); setEndTime(''); setOpenEnd(false); setSelectedFriends([]);
      // refresh my sessions list
      fetchMySessions();
    } catch (e:any) { setMessage(e.message || 'Fehler beim Erstellen'); }
  }

  async function respond(inviteId: number, sessionId: number, status: 'accepted' | 'declined') {
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/respond`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ status }) });
      const data = await res.json();
      if (res.status === 401) {
        localStorage.removeItem('squadtime_token');
        setMessage('Ungültiger Token. Bitte neu einloggen.');
        return;
      }
      if (!res.ok) throw new Error(data.message || 'Fehler');
      setMessage('Antwort gesendet');
      fetchInvites();
      fetchMySessions();
    } catch (e:any) { setMessage(e.message || 'Fehler beim Antworten'); }
  }

  function getSessionGameOverview(session: any) {
    const fromSession = parseJsonSafe(session.rawg_json);
    const fromGamesTable = parseJsonSafe(session.game_rawg_json);
    const source = fromSession || fromGamesTable;
    if (source) {
      return {
        name: source.name || source.title || session.game_title || session.game_id,
        image: source.background_image || session.game_cover_image_url || '',
        released: source.released || session.game_released || '',
        rating: typeof source.rating === 'number' ? source.rating : session.game_rating
      };
    }
    if (!session.game_title && !session.game_cover_image_url && !session.game_released && !session.game_rating) return null;
    return {
      name: session.game_title || session.game_id,
      image: session.game_cover_image_url || '',
      released: session.game_released || '',
      rating: session.game_rating
    };
  }

  const now = Date.now();
  const activeSessions = mySessions.filter((s) => !s.end_at || new Date(s.end_at).getTime() >= now);
  const oldSessions = mySessions.filter((s) => s.end_at && new Date(s.end_at).getTime() < now);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Session Planner</h1>

      <div className="mb-4 flex gap-2">
        <button onClick={() => setActiveTab('create')} className={`px-3 py-1 rounded ${activeTab==='create' ? 'bg-cyan-500 text-black' : 'bg-slate-800'}`}>Planner</button>
        <button onClick={() => setActiveTab('all')} className={`px-3 py-1 rounded ${activeTab==='all' ? 'bg-cyan-500 text-black' : 'bg-slate-800'}`}>Alle Sessions</button>
        <button onClick={() => setActiveTab('invites')} className={`px-3 py-1 rounded ${activeTab==='invites' ? 'bg-cyan-500 text-black' : 'bg-slate-800'}`}>Einladungen</button>
      </div>

      {activeTab === 'create' && (
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-lg font-semibold mb-2">Neue Session erstellen</h2>
          <form onSubmit={createSession} className="grid gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel (optional)" className="rounded px-3 py-2 text-black" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Beschreibung (optional)" className="rounded px-3 py-2 text-black min-h-20" />
            {/* Game picker: Library dropdown and RAWG search */}
            <div>
              <label className="block text-sm mb-1">Spiel wählen</label>
              <div className="flex gap-2">
                <select className="rounded px-3 py-2 text-black flex-1" onChange={(e) => {
                  const v = e.target.value;
                  if (!v) { setSelectedGame(null); setGameId(''); return; }
                  const libItem = library.find((x:any) => String(x.game_id) === v || String(x.id) === v);
                  if (libItem) pickGameFromLibrary(libItem);
                }} value={selectedGame && (selectedGame.id || selectedGame.slug || '') || ''}>
                  <option value="">-- Aus Library wählen --</option>
                  {library.map(item => (
                    <option key={item.id} value={item.game_id || item.id}>{item.title || item.game_id}</option>
                  ))}
                </select>
                <input className="rounded px-3 py-2 text-black w-64" placeholder="Suchen..." value={searchQuery} onChange={(e) => debouncedSearchGames(e.target.value)} />
              </div>
              {searchResults.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-auto bg-slate-800 rounded border border-slate-700 p-2 z-50">
                  {searchResults.map((g:any) => (
                    <li key={g.id} className="p-2 hover:bg-slate-700 rounded cursor-pointer" onClick={() => pickGameFromSearch(g)}>
                      <div className="font-medium">{g.name}</div>
                      <div className="text-sm text-slate-400">{g.released || ''}</div>
                    </li>
                  ))}
                </ul>
              )}
              {selectedGame && (
                <div className="mt-2 p-2 rounded bg-slate-800 border border-slate-700">
                  <div className="font-medium">Ausgewählt: {selectedGame.name || selectedGame.title || selectedGame.id}</div>
                </div>
              )}
            </div>

            <div className="mt-3">
              <Link to={`/sessions/${/* placeholder will be replaced after create */ ''}`} className="text-sm text-slate-400">(Session-Detail nach Erstellung verfügbar)</Link>
            </div>
            <label className="block">Datum</label>
            <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="rounded px-3 py-2 text-black" />

            <label className="block">Uhrzeit (Zeitraum)</label>
            <div className="flex gap-2 items-center">
              <input value={startTime} onChange={(e) => setStartTime(e.target.value)} type="time" className="rounded px-3 py-2 text-black" />
              <span className="mx-1">—</span>
              <input value={endTime} onChange={(e) => setEndTime(e.target.value)} type="time" className="rounded px-3 py-2 text-black" disabled={openEnd} />
              <label className="flex items-center ml-3 text-sm">
                <input type="checkbox" checked={openEnd} onChange={(e) => setOpenEnd(e.target.checked)} className="mr-2" /> Offenes Ende
              </label>
            </div>

            <div>
              <h3 className="font-medium">Freunde einladen</h3>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {friends.map(f => (
                  <label
                    key={f.id}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                      selectedFriends.includes(f.id)
                        ? 'border-cyan-500 bg-cyan-950/30'
                        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar name={f.display_name || f.username} avatarUrl={f.avatar_url} sizeClassName="h-10 w-10" />
                      <div className="min-w-0">
                        <Link
                          to={`/u/${encodeURIComponent(f.username)}`}
                          className="text-sm font-medium text-cyan-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {f.display_name || f.username}
                        </Link>
                        <div className="text-xs text-slate-400">@{f.username}</div>
                      </div>
                    </div>
                    <input type="checkbox" checked={selectedFriends.includes(f.id)} onChange={() => toggleFriend(f.id)} />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button type="submit" className="rounded bg-cyan-500 px-4 py-2 text-black">Erstellen</button>
            </div>
          </form>
          {message && <div className="mt-3 text-sm text-slate-300">{message}</div>}
        </section>
      )}

      {activeTab === 'all' && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-lg font-semibold mb-2">Alle geplanten Sessions</h2>
          {activeSessions.length === 0 && <div className="text-slate-400">Keine geplanten Sessions</div>}
          <ul className="space-y-3">
            {activeSessions.map(s => {
              const gameOverview = getSessionGameOverview(s);
              const startLabel = new Date(s.start_at).toLocaleString();
              const endLabel = s.end_at ? new Date(s.end_at).toLocaleString() : 'Offenes Ende';
              return (
                <li key={s.id} className="rounded-2xl border border-slate-700 bg-slate-800 p-4 shadow-lg">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="font-semibold text-white">{s.title || s.game_id || 'Session'}</div>
                    <Link to={`/sessions/${s.id}`} className="rounded-full bg-cyan-500 px-3 py-1 text-sm font-semibold text-slate-950">
                      Details
                    </Link>
                  </div>
                  <div className="mb-3 rounded-xl border border-cyan-700/60 bg-cyan-950/30 p-3">
                    <div className="text-xs uppercase tracking-wide text-cyan-300">Datum & Zeit</div>
                    <div className="mt-1 text-sm font-semibold text-cyan-100">{startLabel}</div>
                    <div className="text-sm text-cyan-200">bis {endLabel}</div>
                  </div>
                  <div>
                    {s.description && <div className="text-sm text-slate-300 mt-1">{s.description}</div>}
                    {gameOverview && (
                      <div className="mt-3 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
                        {gameOverview.image && (
                          <img
                            src={gameOverview.image}
                            alt={gameOverview.name || 'Spiel'}
                            className="h-40 w-full object-cover"
                          />
                        )}
                        <div className="p-3 text-sm text-slate-200">
                          <div className="font-semibold">Spiel: {gameOverview.name}</div>
                          <div className="text-xs text-slate-400">
                            {gameOverview.released ? `Release: ${gameOverview.released}` : 'Release: -'}
                            {' · '}
                            {gameOverview.rating !== null && gameOverview.rating !== undefined ? `Rating: ${Number(gameOverview.rating).toFixed(1)}` : 'Rating: -'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 border-t border-slate-700 pt-4">
            <button
              type="button"
              onClick={() => setShowOldSessions((v) => !v)}
              className="flex items-center gap-2 rounded bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
            >
              <span>{showOldSessions ? '▾' : '▸'}</span>
              Alte Sessions ({oldSessions.length})
            </button>

            {showOldSessions && (
              <div className="mt-3">
                {oldSessions.length === 0 ? (
                  <div className="text-slate-400">Keine abgelaufenen Sessions</div>
                ) : (
                  <ul className="space-y-3">
                    {oldSessions.map(s => {
                      const gameOverview = getSessionGameOverview(s);
                      const startLabel = new Date(s.start_at).toLocaleString();
                      const endLabel = s.end_at ? new Date(s.end_at).toLocaleString() : 'Offenes Ende';
                      return (
                        <li key={s.id} className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4 shadow">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="font-semibold text-slate-200">{s.title || s.game_id || 'Session'}</div>
                            <Link to={`/sessions/${s.id}`} className="rounded-full bg-slate-700 px-3 py-1 text-sm font-semibold text-slate-200">
                              Details
                            </Link>
                          </div>
                          <div className="mb-3 rounded-xl border border-slate-600 bg-slate-900 p-3">
                            <div className="text-xs uppercase tracking-wide text-slate-400">Abgelaufen am</div>
                            <div className="mt-1 text-sm font-semibold text-slate-200">{endLabel}</div>
                            <div className="text-xs text-slate-400">Start: {startLabel}</div>
                          </div>
                          {gameOverview && (
                            <div className="mt-3 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
                              {gameOverview.image && (
                                <img
                                  src={gameOverview.image}
                                  alt={gameOverview.name || 'Spiel'}
                                  className="h-32 w-full object-cover"
                                />
                              )}
                              <div className="p-3 text-sm text-slate-200">
                                <div className="font-semibold">Spiel: {gameOverview.name}</div>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'invites' && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 mt-6">
          <h2 className="text-lg font-semibold mb-2">Eingehende Einladungen</h2>
          {invites.length === 0 && <div className="text-slate-400">Keine Einladungen</div>}
          <ul className="space-y-3">
            {invites.map(inv => (
              <li key={inv.invite_id} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Link to={`/u/${encodeURIComponent(inv.creator_username)}`} className="shrink-0">
                      <UserAvatar
                        name={inv.creator_display_name || inv.creator_username}
                        avatarUrl={inv.creator_avatar_url}
                        sizeClassName="h-11 w-11"
                      />
                    </Link>
                    <div>
                      <Link to={`/u/${encodeURIComponent(inv.creator_username)}`} className="font-medium text-cyan-400 hover:underline">
                        {inv.creator_display_name || inv.creator_username}
                      </Link>
                      <div className="text-xs text-slate-400">@{inv.creator_username}</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">{new Date(inv.start_at).toLocaleString()}</div>
                </div>
                <div>
                  <div className="font-medium">{inv.title || inv.game_id || 'Session'}</div>
                  {inv.description && <div className="text-sm text-slate-300 mt-1">{inv.description}</div>}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => respond(inv.invite_id, inv.session_id, 'accepted')} className="rounded bg-green-600 px-3 py-1">Annehmen</button>
                  <button onClick={() => respond(inv.invite_id, inv.session_id, 'declined')} className="rounded bg-red-600 px-3 py-1">Ablehnen</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
