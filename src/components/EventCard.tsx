import type { RawgGame } from '../types/game';

interface EventCardProps {
    game: RawgGame;
    onAddToLibrary?: (game: RawgGame) => void;
    onRemoveFromLibrary?: (id: number) => void;
    isInLibrary?: boolean;
    onSelect?: (game: RawgGame) => void;
}

export default function EventCard({ game, onAddToLibrary, onRemoveFromLibrary, isInLibrary, onSelect }: EventCardProps) {
    const name = game.name || (game as any).title || 'Unbekanntes Spiel';
    const image =
        game.background_image ?? 'https://placehold.co/600x400/0f172a/94a3b8?text=Kein+Cover';
    const genres = Array.isArray(game.genres) ? game.genres : [];
    const genreText = genres.length > 0 ? genres.map((genre) => genre.name).join(', ') : 'n/a';

    return (
        <article onClick={() => onSelect && onSelect(game)} className="cursor-pointer overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-xl">
            <img src={image} alt={name} className="h-56 w-full object-cover" />
            <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                    <h2 className="text-xl font-semibold text-white">{name}</h2>
                    <div>
                        {isInLibrary ? (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemoveFromLibrary && onRemoveFromLibrary(game.id); }}
                                className="rounded-md bg-red-600 px-3 py-1 text-sm font-medium"
                            >
                                Entfernen
                            </button>
                        ) : (
                            <button
                                onClick={(e) => { e.stopPropagation(); onAddToLibrary && onAddToLibrary(game); }}
                                className="rounded-md bg-cyan-500 px-3 py-1 text-sm font-medium text-slate-900"
                            >
                                Zur Library
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-3 space-y-2 text-slate-400">
                    <p>Metacritic: {game.metacritic ?? 'n/a'}</p>
                    <p>Spielzeit: {game.playtime ?? 'n/a'} Std.</p>
                    <p>Review-Anzahl: {game.ratings_count ?? 'n/a'}</p>
                    <p>Genres: {genreText}</p>
                </div>
                <div className="mt-4">
                    <button
                        onClick={(e) => { e.stopPropagation(); onSelect && onSelect(game); }}
                        className="rounded-md bg-slate-700 px-3 py-1 text-sm font-medium text-slate-100"
                    >
                        Mehr Infos
                    </button>
                </div>
            </div>
        </article>
    );
}