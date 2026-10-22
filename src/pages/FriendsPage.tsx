import SocialPanel from '../components/SocialPanel';

export default function FriendsPage() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">Freunde</h1>
        <p className="text-slate-400">
          Suche nach Spielern, sende Freundschaftsanfragen und verwalte deinen Freundeskreis.
        </p>
      </div>
      <SocialPanel />
    </main>
  );
}
