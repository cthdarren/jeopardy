import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { GameSummary } from '../../../shared/types';
import { api } from '../api';
import { clearSession, hasSession } from '../play/state';

export default function Library() {
  const navigate = useNavigate();
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () =>
    api
      .listGames()
      .then(setGames)
      .catch((e) => setError(e.message));

  useEffect(() => {
    refresh();
  }, []);

  const act = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onImport = (file: File) =>
    act(async () => {
      setImporting(0);
      try {
        const { id } = await api.importGame(file, setImporting);
        await refresh();
        navigate(`/edit/${id}`);
      } finally {
        setImporting(null);
        if (fileInput.current) fileInput.current.value = '';
      }
    });

  return (
    <div className="page library">
      <header className="library-header">
        <h1 className="logo">JEOPARDY!</h1>
        <div className="row gap">
          <button className="btn btn-primary" onClick={() => act(async () => navigate(`/edit/${(await api.createGame()).id}`))}>
            + New game
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()} disabled={importing !== null}>
            {importing !== null ? `Importing… ${Math.round(importing * 100)}%` : 'Import .jeopardy'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".jeopardy,.zip"
            hidden
            onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
          />
        </div>
      </header>

      {error && <div className="alert">{error}</div>}

      {games === null ? (
        <p className="muted">Loading…</p>
      ) : games.length === 0 ? (
        <div className="empty">
          <p>No games yet.</p>
          <p className="muted">Create a new game or import a .jeopardy file.</p>
        </div>
      ) : (
        <ul className="game-list">
          {games.map((g) => {
            const inProgress = hasSession(g.id);
            return (
              <li key={g.id} className="game-item">
                <div className="game-item-info">
                  <Link to={`/edit/${g.id}`} className="game-title">
                    {g.title}
                  </Link>
                  <span className="muted small">
                    Updated {new Date(g.updatedAt).toLocaleString()}
                    {inProgress && <span className="badge">In progress</span>}
                  </span>
                </div>
                <div className="row gap wrap">
                  {inProgress ? (
                    <>
                      <button className="btn btn-primary" onClick={() => navigate(`/play/${g.id}`)}>
                        ▶ Resume
                      </button>
                      <button
                        className="btn"
                        onClick={() => {
                          if (!confirm('Discard the game in progress and start fresh?')) return;
                          clearSession(g.id);
                          navigate(`/play/${g.id}`);
                        }}
                      >
                        New play
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-primary" onClick={() => navigate(`/play/${g.id}`)}>
                      ▶ Play
                    </button>
                  )}
                  <button className="btn" onClick={() => navigate(`/edit/${g.id}`)}>
                    Edit
                  </button>
                  <a className="btn" href={api.exportUrl(g.id)} download>
                    Export
                  </a>
                  <a className="btn" href={api.cheatsheetUrl(g.id)} download>
                    Download Cheatsheet
                  </a>
                  <button className="btn" onClick={() => act(async () => (await api.duplicateGame(g.id), refresh()))}>
                    Duplicate
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() =>
                      confirm(`Delete "${g.title}"? This cannot be undone.`) &&
                      act(async () => {
                        await api.deleteGame(g.id);
                        clearSession(g.id);
                        await refresh();
                      })
                    }
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
