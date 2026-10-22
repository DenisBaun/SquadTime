import { FormEvent, useEffect, useState } from 'react';
import EventCard from '../components/EventCard';
import GameDetailsModal from '../components/GameDetailsModal';
import GenresPanel from '../components/GenresPanel';
import { fetchGameDetails, fetchGames, fetchGenres, fetchTags } from '../utils/rawg';
import { API_BASE, authHeaders } from '../utils/api';
import type { RawgGame } from '../types/game';
import type { RawgGenre } from '../types/genre';

const FILTER_KEY = 'squadtime_filters_v1';
const LIB_KEY = 'squadtime_library_v1';

const defaultFilters = {
  minPlaytime: 0,
  maxPlaytime: 10,
  minRating: 40,
  minReviews: 10,
  genres: [] as string[],
  tags: [] as string[],
  genreMode: 'soft' as 'soft' | 'hard',
  minGenreMatches: 1,
  localCoop: false,
  onlineCoop: false,
  multiplayer: false,
  search: '',
  exactSearch: false
};

export default function GamefinderPage() {
  const [filters, setFilters] = useState(() => {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      if (raw) return { ...defaultFilters, ...JSON.parse(raw) };
    } catch (e) {
      /* ignore */
    }
    return defaultFilters;
  });

  const [games, setGames] = useState<RawgGame[]>([]);
  const [genres, setGenres] = useState<RawgGenre[]>([]);
  const [tags, setTags] = useState<Array<{ id: number; name: string; slug: string }>>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [message, setMessage] = useState('Gib Filter ein und klicke auf "Suchen".');
  const [library, setLibrary] = useState<RawgGame[]>([]);
  const [searchResults, setSearchResults] = useState<RawgGame[]>([]);
  const [query, setQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const hasUnappliedChanges = JSON.stringify(filters) !== JSON.stringify(appliedFilters);
  const [selectedGameDetails, setSelectedGameDetails] = useState<RawgGame | null>(null);


  useEffect(() => {
    fetchGenres()
      .then((result) => setGenres(result.results))
      .catch(() => setMessage('Genres konnten nicht geladen werden.'));

    fetchTags()
      .then((result) => setTags(result.results))
      .catch(() => console.warn('Tags konnten nicht geladen werden.'));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
    } catch (e) {
      console.warn('Could not persist filters', e);
    }
  }, [filters]);

  // load library from server (if logged in)
  useEffect(() => {
    async function loadLibrary() {
      try {
        const token = localStorage.getItem('squadtime_token');
        if (!token) return setLibrary([]);
        const res = await fetch(`${API_BASE}/api/library`, { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        setLibrary(data.map((r: any) => r.rawg));
      } catch (e) {
        console.warn('Could not load library', e);
      }
    }
    loadLibrary();
  }, []);


  const resetFilters = () => {
    setFilters(defaultFilters);
    try { localStorage.removeItem(FILTER_KEY); } catch (e) {}
  };

  function buildCombinedTags(): string[] {
    const out = new Set<string>(filters.tags || []);
    function addByKeywords(keywords: string[]) {
      for (const t of tags) {
        const s = (t.slug + ' ' + t.name).toLowerCase();
        for (const k of keywords) {
          if (s.includes(k)) {
            out.add(t.slug);
            break;
          }
        }
      }
    }

    if (filters.localCoop) addByKeywords(['local', 'co-op', 'co op', 'coop']);
    if (filters.onlineCoop) addByKeywords(['online', 'co-op', 'co op', 'coop']);
    if (filters.multiplayer) addByKeywords(['multiplayer', 'multi-player']);

    return Array.from(out);
  }

  function applyStrictFilters(results: RawgGame[], currentFilters: typeof defaultFilters): RawgGame[] {
    const selectedGenreNames = (currentFilters.genres || [])
      .map((slug) => genres.find((g) => g.slug === slug)?.name?.toLowerCase())
      .filter((v): v is string => Boolean(v));

    const unlimitedMax = currentFilters.maxPlaytime >= 1000;

    return results.filter((game) => {
      const playtime = Number(game.playtime || 0);
      if (playtime < currentFilters.minPlaytime) return false;
      if (!unlimitedMax && playtime > currentFilters.maxPlaytime) return false;
      if ((game.metacritic ?? 0) < currentFilters.minRating) return false;
      if ((game.ratings_count ?? 0) < currentFilters.minReviews) return false;
      if (currentFilters.search && currentFilters.search.trim().length > 0 && currentFilters.exactSearch) {
        const searchNormalized = currentFilters.search.trim().toLowerCase();
        const gameNameNormalized = (game.name || '').trim().toLowerCase();
        if (gameNameNormalized !== searchNormalized) return false;
      }

      if (selectedGenreNames.length > 0) {
        const gameGenreNames = (game.genres || []).map((g) => g.name.toLowerCase());
        if (currentFilters.genreMode === 'hard') {
          if (!selectedGenreNames.every((name) => gameGenreNames.includes(name))) return false;
        } else {
          const matchCount = selectedGenreNames.filter((name) => gameGenreNames.includes(name)).length;
          const requiredMatches = Math.max(1, Math.min(currentFilters.minGenreMatches, selectedGenreNames.length));
          if (matchCount < requiredMatches) return false;
        }
      }

      return true;
    });
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('loading');
    setMessage('Spiele werden geladen…');

    try {
      const combinedTags = buildCombinedTags();
      const callFilters = { ...filters, tags: combinedTags } as any;
      const result = await fetchGames(callFilters);
      const strictResults = applyStrictFilters(result.results, callFilters);

      if (strictResults.length === 0) {
        setMessage('Keine Spiele gefunden. Probiere andere Filter.');
      } else {
        setMessage(`Gefundene Spiele: ${strictResults.length} (RAWG Treffer: ${result.results.length})`);
      }

      setGames(strictResults);
      setAppliedFilters(filters);
      setStatus('done');
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Fehler beim Abrufen der Spiele. Prüfe deinen API-Schlüssel.'
      );
    }
  };

  // Autocomplete search (debounced)
  import('../utils/debounce').then(({ debounce }) => {
    // no-op to ensure module available for bundlers; actual usage below via dynamic import
  }).catch(() => {});

  const debouncedSearch = (function() {
    let t: ReturnType<typeof setTimeout> | null = null;
    return (q: string) => {
      if (t) clearTimeout(t);
      t = setTimeout(async () => {
        if (!q || q.trim().length < 2) { setSearchResults([]); return; }
        try {
          const params = new URLSearchParams({ key: import.meta.env.VITE_RAWG_API_KEY || '', page_size: '8', search: q });
          const resp = await fetch(`https://api.rawg.io/api/games?${params.toString()}`);
          if (!resp.ok) { setSearchResults([]); return; }
          const data = await resp.json();
          setSearchResults(data.results || []);
        } catch (e) { setSearchResults([]); }
      }, 350);
    };
  })();

  function pickSuggestion(g: RawgGame) {
    setFilters({ ...filters, search: g.name });
    setGames([g]);
    setSearchResults([]);
    setQuery('');
  }

  async function updateLibraryDetails(game: RawgGame) {
    try {
      const token = localStorage.getItem('squadtime_token');
      if (!token) return;
      await fetch(`${API_BASE}/api/library/by-game/${game.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ game })
      });
      setLibrary((prev) => prev.map((g) => (g.id === game.id ? game : g)));
    } catch (e) {
      console.warn('Could not update library details', e);
    }
  }

  async function openGameDetails(game: RawgGame) {
    try {
      const details = await fetchGameDetails(game.id);
      setSelectedGameDetails(details);
      if (library.some((g) => g.id === game.id)) {
        await updateLibraryDetails(details);
      }
    } catch (e) {
      console.warn('Could not fetch game details', e);
      setSelectedGameDetails(game);
    }
  }


  async function addToLibrary(game: RawgGame) {
    try {
      const token = localStorage.getItem('squadtime_token');
      if (!token) return setMessage('Bitte einloggen, um Spiele zu speichern');
      let gameToStore: RawgGame = game;
      try {
        gameToStore = await fetchGameDetails(game.id);
      } catch (e) {
        console.warn('Could not enrich game details before saving', e);
      }
      const res = await fetch(`${API_BASE}/api/library`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ game: gameToStore }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Fehler');
      setLibrary((prev) => {
        if (prev.find((g) => g.id === gameToStore.id)) return prev;
        return [...prev, gameToStore];
      });
      setMessage('Spiel zur Library hinzugefügt');
    } catch (e: any) {
      setMessage(e.message || 'Konnte Spiel nicht speichern');
    }
  }

  async function removeFromLibrary(id: number) {
    try {
      const token = localStorage.getItem('squadtime_token');
      if (!token) return setMessage('Bitte einloggen');
      const resEntries = await fetch(`${API_BASE}/api/library`, { headers: authHeaders() });
      if (!resEntries.ok) throw new Error('Fehler beim Abrufen der Library');
      const entries = await resEntries.json();
      const entry = entries.find((e: any) => e.game_id === id);
      if (!entry) return setMessage('Nicht in Library');

      const del = await fetch(`${API_BASE}/api/library/${entry.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!del.ok) throw new Error('Konnte nicht entfernen');
      setLibrary((prev) => prev.filter((g) => g.id !== id));
      setMessage('Spiel aus Library entfernt');
    } catch (e: any) {
      setMessage(e.message || 'Konnte nicht entfernen');
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-4xl font-bold mb-2">Gamefinder</h1>
      <p className="text-slate-400 mb-8">
        Suche nach Spielen nach Namen oder verwende Filter, um passende Titel zu finden.
      </p>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl md:grid-cols-4"
      >
        <div className="md:col-span-2">
          <div className="mb-4">
            <div className="relative">
               <input
                 type="text"
                 placeholder="Spiele-Name eingeben"
                 value={filters.search}
                 onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setQuery(e.target.value); debouncedSearch(e.target.value); }}
                 className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
               />
               {searchResults.length > 0 && (
                 <ul className="absolute left-0 right-0 mt-2 max-h-56 overflow-auto rounded bg-slate-800 border border-slate-700 z-50">
                   {searchResults.map((g) => (
                     <li key={g.id} className="p-3 hover:bg-slate-700 cursor-pointer" onClick={() => pickSuggestion(g)}>
                       <div className="font-medium">{g.name}</div>
                       <div className="text-sm text-slate-400">{(g as any).released || ''}</div>
                     </li>
                   ))}
                 </ul>
               )}
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={filters.exactSearch}
                onChange={(e) => setFilters({ ...filters, exactSearch: e.target.checked })}
              />
              Nur exakte Suche (Name muss exakt passen)
            </label>
          </div>

          <GenresPanel
            genres={genres}
            tags={tags}
            selectedGenres={filters.genres}
            selectedTags={filters.tags}
            onChange={(g, t) => setFilters({ ...filters, genres: g, tags: t })}
          />
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-3">
            <div className="mb-2 text-sm text-slate-300">Genre-Filter Modus</div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="genreMode"
                  checked={filters.genreMode === 'soft'}
                  onChange={() => setFilters({ ...filters, genreMode: 'soft' })}
                />
                Soft (mindestens ein Genre passt)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="genreMode"
                  checked={filters.genreMode === 'hard'}
                  onChange={() => setFilters({ ...filters, genreMode: 'hard' })}
                />
                Hard (alle Genres müssen passen)
              </label>
            </div>
            {filters.genreMode === 'soft' && (
              <div className="mt-3">
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-slate-300">Mind. Genre-Treffer (Soft-Modus)</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, filters.genres.length || 1)}
                    value={Math.max(1, Math.min(filters.minGenreMatches, Math.max(1, filters.genres.length || 1)))}
                    onChange={(e) => {
                      const rawValue = Number(e.target.value);
                      const capped = Math.max(1, Math.min(rawValue, Math.max(1, filters.genres.length || 1)));
                      setFilters({ ...filters, minGenreMatches: capped });
                    }}
                    className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-slate-400">Spielzeit (Stunden)</span>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="range-track-container">
                  <div className="range-track" />
                  <div
                    className="range-fill"
                    style={{
                      left: `${(Math.min(filters.minPlaytime, 100) / 100) * 100}%`,
                      width: `${((filters.maxPlaytime >= 1000 ? 100 : Math.min(filters.maxPlaytime, 100)) - Math.min(filters.minPlaytime, 100))}%`
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.min(filters.minPlaytime, 100)}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const nextMin = Math.min(v, filters.maxPlaytime);
                      setFilters({ ...filters, minPlaytime: nextMin });
                    }}
                    className="w-full h-8"
                    style={{ position: 'relative' }}
                  />
                </div>
                <div className="text-sm text-slate-400 mt-1">Min: {filters.minPlaytime}h</div>
              </div>
              <div className="flex-1">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={filters.maxPlaytime >= 1000 ? 100 : Math.min(filters.maxPlaytime, 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const nextMax = Math.max(v, filters.minPlaytime);
                    setFilters({ ...filters, maxPlaytime: nextMax });
                  }}
                  className="w-full h-8"
                  style={{ position: 'relative', zIndex: 3 }}
                  disabled={filters.maxPlaytime >= 1000}
                />
                <div className="text-sm text-slate-400 mt-1">Max: {filters.maxPlaytime >= 1000 ? 'unbegrenzt' : filters.maxPlaytime + 'h'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.maxPlaytime >= 1000}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFilters({ ...filters, maxPlaytime: 10000 });
                    } else {
                      setFilters({ ...filters, maxPlaytime: Math.max(filters.minPlaytime, 10) });
                    }
                  }}
                />
                Unbegrenzt (kein oberes Limit)
              </label>
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm text-slate-400">Mindestwertung (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              value={filters.minRating}
              onChange={(event) =>
                setFilters({ ...filters, minRating: Number(event.target.value) })
              }
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm text-slate-400">Minimale Review-Anzahl</span>
            <input
              type="number"
              min="0"
              value={filters.minReviews}
              onChange={(event) =>
                setFilters({ ...filters, minReviews: Number(event.target.value) })
              }
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="flex-1 rounded-2xl bg-cyan-500 px-6 py-4 text-base font-semibold text-slate-950 transition hover:bg-cyan-400"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Lade…' : 'Suchen'}
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-2xl bg-slate-700 px-4 py-2 text-sm text-slate-200"
            >
              Filter zurücksetzen
            </button>
          </div>
          {hasUnappliedChanges && (
            <div className="text-sm text-amber-300">Es gibt ungeprüfte Filter-Änderungen. Klicke auf „Suchen“ zum Anwenden.</div>
          )}

          <div className="mt-3 flex gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={filters.localCoop} onChange={(e) => setFilters({ ...filters, localCoop: e.target.checked })} />
              <span className="text-sm">Local Co-op</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={filters.onlineCoop} onChange={(e) => setFilters({ ...filters, onlineCoop: e.target.checked })} />
              <span className="text-sm">Online Co-op</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={filters.multiplayer} onChange={(e) => setFilters({ ...filters, multiplayer: e.target.checked })} />
              <span className="text-sm">Multiplayer</span>
            </label>
          </div>
        </div>
      </form>

      <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 px-6 py-5 text-slate-300 shadow-xl">
        {message}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {games.map((game) => (
          <EventCard key={game.id} game={game} onSelect={openGameDetails} onAddToLibrary={addToLibrary} isInLibrary={!!library.find(l => l.id === game.id)} />
        ))}
      </div>
      <GameDetailsModal game={selectedGameDetails} onClose={() => setSelectedGameDetails(null)} />
    </main>
  );
}
