import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { API_BASE, authHeaders } from '../utils/api';

function toInputDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any | null>(null);
  const [invites, setInvites] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStartAt, setEditStartAt] = useState('');
  const [editEndAt, setEditEndAt] = useState('');
  const [editOpenEnd, setEditOpenEnd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [leavingSession, setLeavingSession] = useState(false);
  const [kickingInviteId, setKickingInviteId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const canManage = !!session && currentUserId !== null && session.creator === currentUserId;
  const currentInvite = currentUserId !== null ? invites.find((inv) => inv.to_user === currentUserId) : null;
  const canLeaveSession = !!session && currentInvite?.status === 'accepted';

  async function loadSession() {
    if (!id) return;
    const res = await fetch(`${API_BASE}/api/sessions/${id}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Session nicht gefunden');
    const data = await res.json();
    setSession(data.session);
    setInvites(data.invites || []);
    setEditTitle(data.session?.title || '');
    setEditDescription(data.session?.description || '');
    setEditStartAt(toInputDateTime(data.session?.start_at));
    setEditEndAt(toInputDateTime(data.session?.end_at));
    setEditOpenEnd(!data.session?.end_at);
  }

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const meRes = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() });
        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUserId(meData?.user?.id ?? null);
        }
        await loadSession();
      } catch (e:any) { setMessage(e.message || 'Fehler'); }
    })();
  }, [id]);

  async function saveChanges(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (!editStartAt) {
      setMessage('Startzeit ist erforderlich');
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      const startAtIso = new Date(editStartAt).toISOString();
      const endAtIso = editOpenEnd || !editEndAt ? null : new Date(editEndAt).toISOString();
      const res = await fetch(`${API_BASE}/api/sessions/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          title: editTitle || null,
          description: editDescription || null,
          start_at: startAtIso,
          end_at: endAtIso
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Änderungen konnten nicht gespeichert werden');
      setMessage('Session aktualisiert');
      setIsEditing(false);
      await loadSession();
    } catch (e:any) {
      setMessage(e.message || 'Änderungen konnten nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  }

  async function kickUser(inviteId: number) {
    if (!id) return;
    try {
      setKickingInviteId(inviteId);
      setMessage('');
      const res = await fetch(`${API_BASE}/api/sessions/${id}/invites/${inviteId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'User konnte nicht entfernt werden');
      setMessage('User wurde aus der Session entfernt');
      await loadSession();
    } catch (e:any) {
      setMessage(e.message || 'User konnte nicht entfernt werden');
    } finally {
      setKickingInviteId(null);
    }
  }

  async function deleteSession() {
    if (!id) return;
    const phrase = window.prompt('Zur Sicherheit bitte genau "LÖSCHEN" eingeben:');
    if (phrase !== 'LÖSCHEN') {
      setMessage('Löschen abgebrochen: Bestätigungswort war nicht korrekt.');
      return;
    }

    const needsTitleConfirmation = !!session?.title;
    if (needsTitleConfirmation) {
      const typedTitle = window.prompt(`Bitte den Session-Titel exakt eingeben:\n${session.title}`);
      if (typedTitle !== session.title) {
        setMessage('Löschen abgebrochen: Session-Titel stimmt nicht überein.');
        return;
      }
    }

    try {
      setDeletingSession(true);
      setMessage('');
      const res = await fetch(`${API_BASE}/api/sessions/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({
          confirmPhrase: phrase,
          confirmTitle: session?.title || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Session konnte nicht gelöscht werden');
      navigate('/planner');
    } catch (e:any) {
      setMessage(e.message || 'Session konnte nicht gelöscht werden');
    } finally {
      setDeletingSession(false);
    }
  }

  async function leaveSession() {
    if (!id) return;
    const confirmed = window.confirm('Session wirklich verlassen?');
    if (!confirmed) return;

    try {
      setLeavingSession(true);
      setMessage('');
      const res = await fetch(`${API_BASE}/api/sessions/${id}/leave`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ reason: leaveReason || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Session konnte nicht verlassen werden');
      setMessage('Du hast die Session verlassen');
      setLeaveReason('');
      await loadSession();
    } catch (e:any) {
      setMessage(e.message || 'Session konnte nicht verlassen werden');
    } finally {
      setLeavingSession(false);
    }
  }

  const gameLabel = (() => {
    if (!session?.rawg_json && !session?.game_rawg_json) {
      return session?.game_title || null;
    }
    try {
      const parsed = JSON.parse(session.rawg_json || session.game_rawg_json);
      return parsed.name || parsed.title || null;
    } catch (e) {
      return session?.game_title || null;
    }
  })();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-4">
        <Link to="/planner" className="text-sm text-cyan-400">← Zurück zum Planner</Link>
      </div>
      {!session && <div className="text-slate-400">{message || 'Lade...'}</div>}
      {session && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h1 className="text-2xl font-bold mb-2">{session.title || session.game_id || 'Session'}</h1>
          <div className="text-sm text-slate-400 mb-4">Erstellt von: {session.creator_username}</div>
          {canManage && (
            <div className="mb-4">
              <button
                type="button"
                className="rounded bg-cyan-500 px-3 py-1 text-sm font-semibold text-slate-950"
                onClick={() => setIsEditing((prev) => !prev)}
              >
                {isEditing ? 'Bearbeiten schließen' : 'Session bearbeiten'}
              </button>
            </div>
          )}
          {session.description && (
            <div className="mb-4 text-slate-300">
              <strong>Beschreibung:</strong> {session.description}
            </div>
          )}
          <div className="mb-4">
            <strong>Wann:</strong>{' '}
            {new Date(session.start_at).toLocaleString()} 
            {session.end_at ? (
              <span> – {new Date(session.end_at).toLocaleString()}</span>
            ) : (
              <span> – offen (kein Endzeitpunkt angegeben)</span>
            )}
          </div>

          {gameLabel && (
            <div className="mb-4">
              <strong>Spiel:</strong> {gameLabel}
            </div>
          )}

          {canManage && isEditing && (
            <form onSubmit={saveChanges} className="mb-6 grid gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
              <h2 className="text-lg font-semibold">Session bearbeiten</h2>
              <label className="grid gap-2">
                <span className="text-sm text-slate-300">Titel</span>
                <input
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={255}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-slate-300">Beschreibung</span>
                <textarea
                  className="min-h-20 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  maxLength={1000}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-slate-300">Start</span>
                <input
                  type="datetime-local"
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  value={editStartAt}
                  onChange={(e) => setEditStartAt(e.target.value)}
                  required
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={editOpenEnd}
                  onChange={(e) => setEditOpenEnd(e.target.checked)}
                />
                Offenes Ende
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-slate-300">Ende</span>
                <input
                  type="datetime-local"
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  value={editEndAt}
                  onChange={(e) => setEditEndAt(e.target.value)}
                  disabled={editOpenEnd}
                />
              </label>
              <button
                type="submit"
                className="w-fit rounded bg-cyan-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-70"
                disabled={saving}
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
              <button
                type="button"
                onClick={deleteSession}
                className="w-fit rounded bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-70"
                disabled={deletingSession}
              >
                {deletingSession ? 'Lösche...' : 'Session löschen'}
              </button>
            </form>
          )}

          {canLeaveSession && (
            <div className="mb-6 grid gap-3 rounded-xl border border-red-800 bg-slate-950 p-4">
              <h2 className="text-lg font-semibold">Session verlassen</h2>
              <label className="grid gap-2">
                <span className="text-sm text-slate-300">Optionaler Absagegrund</span>
                <textarea
                  className="min-h-20 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  maxLength={1000}
                  placeholder="z. B. Keine Zeit mehr"
                />
              </label>
              <button
                type="button"
                onClick={leaveSession}
                className="w-fit rounded bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-70"
                disabled={leavingSession}
              >
                {leavingSession ? 'Verlasse...' : 'Session verlassen'}
              </button>
            </div>
          )}

          <h2 className="text-lg font-semibold mt-4 mb-2">Teilnehmer</h2>
          <ul className="space-y-2">
            {invites.map(inv => (
              <li key={inv.invite_id ?? `user-${inv.to_user}`} className="flex items-center justify-between rounded p-3 border border-slate-700">
                <div>
              <div className="font-medium">
                <Link to={`/u/${encodeURIComponent(inv.username)}`} className="text-cyan-400 hover:underline">
                  {inv.username}
                </Link>
                {inv.is_creator && <span className="ml-2 rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-200">Creator</span>}
              </div>
              {inv.response_reason && (
                <div className="mt-1 text-xs text-slate-400">Grund: {inv.response_reason}</div>
              )}
            </div>
            <div className="flex items-center gap-3">
                  <div className="text-sm text-slate-300">{inv.status}</div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => kickUser(inv.invite_id)}
                      className="rounded bg-red-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-70"
                      disabled={kickingInviteId === inv.invite_id}
                    >
                      {kickingInviteId === inv.invite_id ? 'Entferne...' : 'Kicken'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {message && <div className="mt-4 text-sm text-slate-300">{message}</div>}
    </div>
  );
}
