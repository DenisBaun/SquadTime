import type { RawgGame } from '../types/game';
import type { RawgGenre } from '../types/genre';

const RAWG_API_URL = 'https://api.rawg.io/api';
const RAWG_API_KEY = import.meta.env.VITE_RAWG_API_KEY;

interface FilterParams {
    minPlaytime: number;
    maxPlaytime: number;
    minRating: number;
    minReviews: number;
    genres: string[];
    tags?: string[];
    search?: string;
}

export interface RawgResponse {
    results: RawgGame[];
}

export interface RawgGenresResponse {
    results: RawgGenre[];
}

export interface RawgTagsResponse {
    results: Array<{ id: number; name: string; slug: string }>;
}

const CACHE_TTL_MS = Number(import.meta.env.VITE_RAWG_CACHE_TTL_MS || 86400000); // default 24h
const CACHE_PREFIX = 'rawg_cache_v1_';

function readCache(key: string) {
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed.ts || !parsed.data) return null;
        if (Date.now() - parsed.ts > CACHE_TTL_MS) {
            localStorage.removeItem(CACHE_PREFIX + key);
            return null;
        }
        return parsed.data;
    } catch (e) {
        return null;
    }
}

function writeCache(key: string, data: any) {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) {
        // ignore
    }
}

export async function fetchGenres(): Promise<RawgGenresResponse> {
    // try cache first
    try {
        const cached = readCache('genres');
        if (cached) return cached as RawgGenresResponse;
    } catch (e) { }

    if (!RAWG_API_KEY) {
        throw new Error('Kein RAWG-API-Schlüssel gesetzt. Lege VITE_RAWG_API_KEY in .env an.');
    }

    const params = new URLSearchParams({
        key: RAWG_API_KEY,
        page_size: '40'
    });

    const response = await fetch(`${RAWG_API_URL}/genres?${params.toString()}`);

    if (!response.ok) {
        throw new Error('RAWG-Genres konnten nicht geladen werden.');
    }

    const json = await response.json();
    try { writeCache('genres', json); } catch (e) { }
    return json;
}

export async function fetchTags(): Promise<RawgTagsResponse> {
    // try cache first
    try {
        const cached = readCache('tags');
        if (cached) return cached as RawgTagsResponse;
    } catch (e) { }

    if (!RAWG_API_KEY) {
        throw new Error('Kein RAWG-API-Schlüssel gesetzt. Lege VITE_RAWG_API_KEY in .env an.');
    }

    const params = new URLSearchParams({
        key: RAWG_API_KEY,
        page_size: '100'
    });

    const response = await fetch(`${RAWG_API_URL}/tags?${params.toString()}`);

    if (!response.ok) {
        throw new Error('RAWG-Tags konnten nicht geladen werden.');
    }

    const json = await response.json();
    try { writeCache('tags', json); } catch (e) { }
    return json;
}

export async function fetchGames(filters: FilterParams): Promise<RawgResponse> {
    if (!RAWG_API_KEY) {
        throw new Error('Kein RAWG-API-Schlüssel gesetzt. Lege VITE_RAWG_API_KEY in .env an.');
    }

    const playtimeParam = (filters.maxPlaytime && filters.maxPlaytime >= 1000)
        ? `${filters.minPlaytime},10000` // treat large value as "unlimited" upper bound
        : `${filters.minPlaytime},${filters.maxPlaytime}`;

    const params = new URLSearchParams({
        key: RAWG_API_KEY,
        page_size: '18',
        ordering: '-metacritic',
        metacritic: `${filters.minRating},100`,
        playtime: playtimeParam,
        ratings_count: `${filters.minReviews}`
    });

    if (filters.genres.length > 0) {
        params.set('genres', filters.genres.join(','));
    }

    if (filters.tags && filters.tags.length > 0) {
        params.set('tags', filters.tags.join(','));
    }

    if (filters.search && filters.search.trim().length > 0) {
        params.set('search', filters.search.trim());
    }

    const response = await fetch(`${RAWG_API_URL}/games?${params.toString()}`);

    if (!response.ok) {
        throw new Error('RAWG-API-Anfrage fehlgeschlagen.');
    }

    return response.json();
}

export async function fetchGameDetails(gameId: number): Promise<RawgGame> {
    if (!RAWG_API_KEY) {
        throw new Error('Kein RAWG-API-Schlüssel gesetzt. Lege VITE_RAWG_API_KEY in .env an.');
    }

    const cacheKey = `game_details_${gameId}`;
    try {
        const cached = readCache(cacheKey);
        if (cached) return cached as RawgGame;
    } catch (e) { }

    const params = new URLSearchParams({ key: RAWG_API_KEY });
    const response = await fetch(`${RAWG_API_URL}/games/${gameId}?${params.toString()}`);
    if (!response.ok) {
        throw new Error('RAWG-Game-Details konnten nicht geladen werden.');
    }

    const json = await response.json();
    try { writeCache(cacheKey, json); } catch (e) { }
    return json as RawgGame;
}