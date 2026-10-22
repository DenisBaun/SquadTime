import { useEffect, useState } from 'react';
import type { RawgGame } from '../types/game';
import EventCard from '../components/EventCard';
import GameDetailsModal from '../components/GameDetailsModal';
import { API_BASE, authHeaders } from '../utils/api';
import { fetchGameDetails } from '../utils/rawg';

type LibraryEntry = {
  id: number;
  game_id: number;
  rawg: RawgGame | null;
  is_favorite: boolean;
  user_rating: number | null;
};

export default function LibraryPage() {
  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry[]>([]);
  const [selectedGameDetails, setSelectedGameDetails] = useState<RawgGame | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/api/library`, { headers: authHeaders() });
      if (!res.ok) return setLibraryEntries([]);
      const data = await res.json();
      setLibraryEntries(data.map((r: any) => ({ id: r.id, game_id: r.game_id, rawg: r.rawg, is_favorite: !!r.is_favorite, user_rating: r.user_rating ?? null })));
    } catch (e) {
      console.warn('Could not load library', e);
    }
  }

  useEffect(() => { load(); }, []);

  async function remove(id: number) {
    try {
      const entry = libraryEntries.find((e) => e.game_id === id);
      if (!entry) return;
      const del = await fetch(`${API_BASE}/api/library/${entry.id}`, { method: 'DELETE', headers: authHeaders() });
      if (!del.ok) throw new Error('Fehler');
      setLibraryEntries((prev) => prev.filter((e) => e.game_id !== id));
    } catch (e) {
      console.warn(e);
    }
  }

  async function openDetails(entry: LibraryEntry) {
    if (!entry.rawg) return;
    try {
      const details = await fetchGameDetails(entry.rawg.id);
      setSelectedGameDetails(details);
      await fetch(`${API_BASE}/api/library/by-game/${entry.game_id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ game: details })
      });
      setLibraryEntries((prev) => prev.map((e) => (e.game_id === entry.game_id ? { ...e, rawg: details } : e)));
    } catch (e) {
      console.warn('Could not load details for library game', e);
      setSelectedGameDetails(entry.rawg);
    }
  }

  async function updatePreferences(entryId: number, patch: { is_favorite?: boolean; user_rating?: number | null }) {
    try {
      const res = await fetch(`${API_BASE}/api/library/${entryId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(patch)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Fehler beim Speichern');
      setLibraryEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, is_favorite: !!data.is_favorite, user_rating: data.user_rating ?? null } : e)));
    } catch (e) {
      console.warn(e);
    }
  }

  const filteredEntries = libraryEntries.filter((entry) => {
    const gameName = ((entry.rawg && ((entry.rawg as any).name || (entry.rawg as any).title)) || '').toLowerCase();
    const titleMatch = !nameFilter.trim() || gameName.includes(nameFilter.trim().toLowerCase());
    const favoriteMatch = !onlyFavorites || entry.is_favorite;
    const ratingMatch = !ratingFilter || (entry.user_rating !== null && entry.user_rating >= Number(ratingFilter));
    return titleMatch && favoriteMatch && ratingMatch;
  });

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-4xl font-bold mb-2">Library</h1>
      <p className="text-slate-400 mb-6">Gespeicherte Spiele in deiner persönlichen Library.</p>
      <div className="mb-6 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-3">
        <input
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          placeholder="Nach Spielname filtern..."
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        >
          <option value="">Alle Bewertungen</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
            <option key={r} value={r}>Ab {r}/10</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={onlyFavorites}
            onChange={(e) => setOnlyFavorites(e.target.checked)}
          />
          Nur Favoriten
        </label>
      </div>

      {libraryEntries.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">Deine Library ist noch leer.</div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">Keine Spiele entsprechen den Filtern.</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredEntries.filter((e) => e.rawg).map((entry) => (
            <div key={entry.id} className="space-y-3">
              <EventCard game={entry.rawg as RawgGame} onSelect={() => openDetails(entry)} isInLibrary onRemoveFromLibrary={remove} />
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => updatePreferences(entry.id, { is_favorite: !entry.is_favorite })}
                    className={`rounded px-3 py-1 text-sm ${entry.is_favorite ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-100'}`}
                  >
                    {entry.is_favorite ? '★ Favorit' : '☆ Als Favorit markieren'}
                  </button>
                  <span className="text-xs text-slate-400">Eigene Bewertung</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={entry.user_rating ?? ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? null : Number(e.target.value);
                      updatePreferences(entry.id, { user_rating: value });
                    }}
                    className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Keine Bewertung</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                      <option key={r} value={r}>{r}/10</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <GameDetailsModal game={selectedGameDetails} onClose={() => setSelectedGameDetails(null)} />
    </main>
  );
}
