import React, { useState } from 'react';
import type { RawgGenre } from '../types/genre';
import genreToTags from '../utils/genreMapping';

type Tag = { id: number; name: string; slug: string };

interface Props {
  genres: RawgGenre[];
  tags: Tag[];
  selectedGenres: string[];
  selectedTags: string[];
  onChange: (genres: string[], tags: string[]) => void;
}

export default function GenresPanel({ genres, tags, selectedGenres, selectedTags, onChange }: Props) {
  const [openGenre, setOpenGenre] = useState<string | null>(null);

  function toggleGenre(genreSlug: string) {
    const exists = selectedGenres.includes(genreSlug);
    if (exists) {
      const next = selectedGenres.filter((g) => g !== genreSlug);
      onChange(next, selectedTags);
    } else {
      const next = [...selectedGenres, genreSlug];
      onChange(next, selectedTags);
    }
  }

  function toggleTag(tagSlug: string) {
    const exists = selectedTags.includes(tagSlug);
    const next = exists ? selectedTags.filter((t) => t !== tagSlug) : [...selectedTags, tagSlug];
    onChange(selectedGenres, next);
  }

    // helper: mapped tags + heuristic fallback
    function relatedTagsForGenre(genre: RawgGenre) {
      // try manual mapping first
      const mapped = genreToTags[genre.slug];
      const mappedTags: Tag[] = [];
      if (mapped && mapped.length > 0) {
        mapped.forEach((slug) => {
          const found = tags.find((t) => t.slug === slug);
          if (found) mappedTags.push(found);
        });
      }

      // heuristic fallback (tags containing genre name)
      const lower = genre.name.toLowerCase();
      const heuristic = tags.filter((t) => t.name.toLowerCase().includes(lower));

      // merge, keep uniqueness, limit to 20
      const combined = [...mappedTags, ...heuristic.filter((h) => !mappedTags.find((m) => m.slug === h.slug))];
      return combined.slice(0, 20);
    }

    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
        <h3 className="text-lg font-semibold mb-3">Genres & Untergenres</h3>
        <div className="grid gap-2">
          {genres.map((g) => (
            <div key={g.id} className="border-b border-slate-800 pb-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedGenres.includes(g.slug)}
                    onChange={() => toggleGenre(g.slug)}
                    className="w-4 h-4"
                  />
                  <span>{g.name}</span>
                </label>
                <div>
                  <button
                    type="button"
                    onClick={() => setOpenGenre(openGenre === g.slug ? null : g.slug)}
                    className="text-sm text-cyan-400"
                  >
                    {openGenre === g.slug ? 'Verbergen' : 'Untergenres'}
                  </button>
                </div>
              </div>

              {openGenre === g.slug && (
                <div className="mt-2 grid gap-2 pl-6">
                  {relatedTagsForGenre(g).length === 0 ? (
                    <div className="text-sm text-slate-400">Keine Untergenres gefunden.</div>
                  ) : (
                    relatedTagsForGenre(g).map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(t.slug)}
                          onChange={() => toggleTag(t.slug)}
                          className="w-4 h-4"
                        />
                        <span>{t.name}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
