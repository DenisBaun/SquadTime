export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex justify-center">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-4">
          <img src="/logo.png" alt="SquadTime Logo" className="max-h-44 w-auto object-contain" />
        </div>
      </div>
      <h1 className="text-4xl font-bold mb-2">Willkommen bei SquadTime</h1>
      <p className="text-slate-400 mb-4">Dies ist dein Gaming Planner und Social Hub.</p>
      <p className="text-slate-500">Auf dieser Seite findest du später Übersichten und News. Verwende den Gamefinder für die Suche nach Spielen, die Freunde-Seite für soziale Features und die Library, um deine Spiele zu speichern.</p>
    </main>
  );
}
