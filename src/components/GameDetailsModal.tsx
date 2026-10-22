import type { RawgGame } from '../types/game';

interface GameDetailsModalProps {
  game: RawgGame | null;
  onClose: () => void;
}

function stripHtml(input?: string) {
  if (!input) return '';
  return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function GameDetailsModal({ game, onClose }: GameDetailsModalProps) {
  if (!game) return null;

  const description = game.description_raw || stripHtml(game.description) || 'Keine Beschreibung verfügbar.';
  const platforms = (game.platforms || [])
    .map((p) => p.platform?.name)
    .filter((name): name is string => Boolean(name));
  const publishers = (game.publishers || [])
    .map((p) => p.name)
    .filter((name): name is string => Boolean(name));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-2xl font-semibold text-white">{game.name}</h2>
          <button className="rounded bg-slate-700 px-3 py-1 text-sm" onClick={onClose}>Schließen</button>
        </div>
        {game.background_image && <img src={game.background_image} alt={game.name} className="mb-4 h-56 w-full rounded object-cover" />}
        <div className="space-y-2 text-slate-300">
          <p><strong>Beschreibung:</strong> {description}</p>
          <p><strong>Release:</strong> {game.released || 'n/a'}</p>
          <p><strong>Metacritic:</strong> {game.metacritic ?? 'n/a'}</p>
          <p><strong>Spielzeit:</strong> {game.playtime} Std.</p>
          <p><strong>Genres:</strong> {(game.genres || []).map((g) => g.name).join(', ') || 'n/a'}</p>
          <p><strong>Plattformen:</strong> {platforms.join(', ') || 'n/a'}</p>
          <p><strong>Publisher:</strong> {publishers.join(', ') || 'n/a'}</p>
          {game.website && (
            <p>
              <strong>Website:</strong>{' '}
              <a className="text-cyan-400" href={game.website} target="_blank" rel="noreferrer">{game.website}</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
