import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import type { Clue, Game, Round } from '../../../shared/types';
import { api } from '../api';
import ClueEditor, { ClueFields } from '../components/ClueEditor';
import { mediaIcon } from '../components/MediaView';
import { blankRound, countIncomplete, formatMoney, isClueComplete, resizeRound } from '../gameEdit';

type Tab = number | 'final';
interface Cell {
  categoryIndex: number;
  rowIndex: number;
}

export default function Editor() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>(0);
  const [editing, setEditing] = useState<Cell | null>(null);
  const [baseValue, setBaseValue] = useState(200);
  // ref so the navigation blocker sees the latest value right after a save
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  useEffect(() => {
    api
      .getGame(id)
      .then(setGame)
      .catch((e) => setError(e.message));
  }, [id]);

  const update = useCallback((fn: (g: Game) => Game) => {
    setGame((g) => (g ? fn(g) : g));
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!game) return false;
    setSaving(true);
    setError('');
    try {
      await api.saveGame(id, game);
      dirtyRef.current = false;
      setDirty(false);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [game, id]);

  // Ctrl/Cmd+S to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  // warn about unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirtyRef.current && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (confirm('You have unsaved changes. Leave without saving?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  if (!game) {
    return (
      <div className="page">
        {error ? <div className="alert">{error}</div> : <p className="muted">Loading…</p>}
        <Link to="/">← Back to games</Link>
      </div>
    );
  }

  const roundIndex = typeof tab === 'number' ? Math.min(tab, game.rounds.length - 1) : -1;
  const round = roundIndex >= 0 ? game.rounds[roundIndex] : undefined;

  const updateRound = (fn: (r: Round) => Round) =>
    update((g) => ({ ...g, rounds: g.rounds.map((r, i) => (i === roundIndex ? fn(r) : r)) }));

  const updateClue = (cell: Cell, patch: Partial<Clue>) =>
    updateRound((r) => ({
      ...r,
      categories: r.categories.map((c, ci) =>
        ci !== cell.categoryIndex
          ? c
          : { ...c, clues: c.clues.map((cl, ri) => (ri === cell.rowIndex ? { ...cl, ...patch } : cl)) },
      ),
    }));

  const addRound = () => {
    const last = game.rounds[game.rounds.length - 1];
    const names = ['Jeopardy!', 'Double Jeopardy!', 'Triple Jeopardy!'];
    const name = names[game.rounds.length] ?? `Round ${game.rounds.length + 1}`;
    const next = last
      ? blankRound(name, last.values.length, last.categories.length, (last.values[0] || 200) * 2)
      : blankRound(name);
    if (last) next.values = last.values.map((v) => v * 2);
    update((g) => ({ ...g, rounds: [...g.rounds, next] }));
    setTab(game.rounds.length);
  };

  const moveRound = (dir: -1 | 1) => {
    const to = roundIndex + dir;
    if (to < 0 || to >= game.rounds.length) return;
    update((g) => {
      const rounds = [...g.rounds];
      [rounds[roundIndex], rounds[to]] = [rounds[to], rounds[roundIndex]];
      return { ...g, rounds };
    });
    setTab(to);
  };

  const deleteRound = () => {
    if (game.rounds.length <= 1) return alert('A game needs at least one round.');
    if (!confirm(`Delete round "${round?.name}" and all its clues?`)) return;
    update((g) => ({ ...g, rounds: g.rounds.filter((_, i) => i !== roundIndex) }));
    setTab(Math.max(0, roundIndex - 1));
  };

  const incomplete = countIncomplete(game);
  const editingClue = round && editing ? round.categories[editing.categoryIndex]?.clues[editing.rowIndex] : undefined;

  // navigate the clue editor left-to-right, top-to-bottom
  const neighbour = (dir: -1 | 1): Cell | undefined => {
    if (!round || !editing) return;
    const rows = round.values.length;
    const cols = round.categories.length;
    const flat = editing.categoryIndex * rows + editing.rowIndex + dir;
    if (flat < 0 || flat >= rows * cols) return;
    return { categoryIndex: Math.floor(flat / rows), rowIndex: flat % rows };
  };
  const prevCell = neighbour(-1);
  const nextCell = neighbour(1);

  return (
    <div className="page editor">
      <header className="editor-header">
        <Link to="/" className="btn">
          ← Games
        </Link>
        <input
          className="title-input"
          value={game.title}
          onChange={(e) => update((g) => ({ ...g, title: e.target.value }))}
          placeholder="Game title"
          aria-label="Game title"
        />
        <span className="muted small">
          {incomplete > 0 ? `${incomplete} incomplete clue${incomplete === 1 ? '' : 's'}` : 'All clues complete'}
        </span>
        <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </button>
        <button
          className="btn"
          onClick={async () => {
            if (dirty && !(await save())) return;
            navigate(`/play/${id}`);
          }}
        >
          ▶ Play
        </button>
      </header>

      {error && <div className="alert">{error}</div>}

      <nav className="tabs">
        {game.rounds.map((r, i) => (
          <button key={r.id} className={`tab ${i === roundIndex ? 'active' : ''}`} onClick={() => setTab(i)}>
            {r.name || `Round ${i + 1}`}
          </button>
        ))}
        <button className="tab tab-add" onClick={addRound}>
          + Round
        </button>
        <button className={`tab tab-final ${tab === 'final' ? 'active' : ''}`} onClick={() => setTab('final')}>
          Final Jeopardy
        </button>
      </nav>

      {round && (
        <section className="round-editor">
          <div className="round-settings">
            <label className="field inline">
              <span>Round name</span>
              <input value={round.name} onChange={(e) => updateRound((r) => ({ ...r, name: e.target.value }))} />
            </label>
            <label className="field inline narrow">
              <span>Categories</span>
              <input
                type="number"
                min={1}
                max={20}
                value={round.categories.length}
                onChange={(e) => updateRound((r) => resizeRound(r, r.values.length, Number(e.target.value)))}
              />
            </label>
            <label className="field inline narrow">
              <span>Rows</span>
              <input
                type="number"
                min={1}
                max={20}
                value={round.values.length}
                onChange={(e) => updateRound((r) => resizeRound(r, Number(e.target.value), r.categories.length))}
              />
            </label>
            <div className="field inline">
              <span>Auto-fill values</span>
              <div className="row gap-sm">
                <input
                  type="number"
                  className="narrow-input"
                  value={baseValue}
                  onChange={(e) => setBaseValue(Number(e.target.value))}
                />
                <button
                  className="btn"
                  title="Set row values to base × row number"
                  onClick={() => updateRound((r) => ({ ...r, values: r.values.map((_, i) => baseValue * (i + 1)) }))}
                >
                  Fill
                </button>
              </div>
            </div>
            <span className="spacer" />
            <div className="row gap-sm">
              <button className="btn" onClick={() => moveRound(-1)} disabled={roundIndex === 0} title="Move round earlier">
                ←
              </button>
              <button
                className="btn"
                onClick={() => moveRound(1)}
                disabled={roundIndex === game.rounds.length - 1}
                title="Move round later"
              >
                →
              </button>
              <button className="btn btn-danger" onClick={deleteRound}>
                Delete round
              </button>
            </div>
          </div>

          <div className="grid-scroll">
            <table className="edit-grid">
              <thead>
                <tr>
                  <th className="value-col">Value</th>
                  {round.categories.map((c, ci) => (
                    <th key={c.id}>
                      <input
                        className="category-input"
                        value={c.name}
                        placeholder={`Category ${ci + 1}`}
                        onChange={(e) =>
                          updateRound((r) => ({
                            ...r,
                            categories: r.categories.map((cat, i) => (i === ci ? { ...cat, name: e.target.value } : cat)),
                          }))
                        }
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {round.values.map((value, ri) => (
                  <tr key={ri}>
                    <td className="value-col">
                      <input
                        type="number"
                        className="value-input"
                        value={value}
                        aria-label={`Row ${ri + 1} value`}
                        onChange={(e) =>
                          updateRound((r) => ({ ...r, values: r.values.map((v, i) => (i === ri ? Number(e.target.value) : v)) }))
                        }
                      />
                    </td>
                    {round.categories.map((c, ci) => {
                      const clue = c.clues[ri];
                      const complete = isClueComplete(clue);
                      return (
                        <td key={c.id}>
                          <button
                            className={`edit-cell ${complete ? '' : 'incomplete'}`}
                            onClick={() => setEditing({ categoryIndex: ci, rowIndex: ri })}
                          >
                            <span className="edit-cell-value">
                              {formatMoney(value)} {mediaIcon(clue.media)}
                            </span>
                            <span className="edit-cell-text">{clue.text || (clue.media ? '' : 'Empty clue')}</span>
                            <span className="edit-cell-answer">{clue.answer || '⚠ No answer'}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'final' && (
        <section className="final-editor">
          <label className="field">
            <span>Final Jeopardy category</span>
            <input
              value={game.final.category}
              placeholder="e.g. World Capitals"
              onChange={(e) => update((g) => ({ ...g, final: { ...g.final, category: e.target.value } }))}
            />
          </label>
          <ClueFields gameId={id} value={game.final} onChange={(patch) => update((g) => ({ ...g, final: { ...g.final, ...patch } }))} />
        </section>
      )}

      {round && editing && editingClue && (
        <ClueEditor
          key={`${editing.categoryIndex}-${editing.rowIndex}`}
          gameId={id}
          autoFocus
          title={`${round.categories[editing.categoryIndex].name || `Category ${editing.categoryIndex + 1}`} — ${formatMoney(round.values[editing.rowIndex])}`}
          value={editingClue}
          onChange={(patch) => updateClue(editing, patch)}
          onClose={() => setEditing(null)}
          onPrev={prevCell && (() => setEditing(prevCell))}
          onNext={nextCell && (() => setEditing(nextCell))}
        />
      )}
    </div>
  );
}
