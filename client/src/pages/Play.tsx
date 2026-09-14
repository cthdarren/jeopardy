import { useEffect, useMemo, useReducer, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Game } from '../../../shared/types';
import { api } from '../api';
import Board from '../components/Board';
import ClueView, { MediaToggle, TextToggle, isMediaTarget, isTypingTarget } from '../components/ClueView';
import FinalJeopardy from '../components/FinalJeopardy';
import Modal from '../components/Modal';
import Players from '../components/Players';
import ScoreBar from '../components/ScoreBar';
import { formatMoney } from '../gameEdit';
import { initialSession, loadSession, reducer, saveSession } from '../play/state';

export default function Play() {
  const { id = '' } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState('');
  const [session, dispatch] = useReducer(reducer, id, (gameId) => loadSession(gameId) ?? initialSession());
  const [showPlayers, setShowPlayers] = useState(false);

  useEffect(() => {
    api
      .getGame(id)
      .then(setGame)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => saveSession(id, session), [id, session]);

  const used = useMemo(() => new Set(session.used), [session.used]);
  const roundIndex = game ? Math.min(session.roundIndex, game.rounds.length - 1) : 0;
  const round = game?.rounds[roundIndex];
  const active = session.active;
  const activeClue =
    round && active && active.roundIndex === roundIndex ? round.categories[active.categoryIndex]?.clues[active.rowIndex] : undefined;

  // keyboard shortcuts while a clue is open
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.modal') || isTypingTarget(e.target)) return;
      if (e.key === ' ') {
        if (isMediaTarget(e.target)) return;
        e.preventDefault(); // also stops a focused button from being "clicked" by Space
        dispatch({ type: 'reveal' });
      } else if (e.key.toLowerCase() === 'q') {
        dispatch({ type: 'showText' });
      } else if (e.key.toLowerCase() === 'm') {
        dispatch({ type: 'showMedia' });
      } else if (e.key === 'Escape') {
        dispatch({ type: 'closeClue', markUsed: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  if (!game || !round) {
    return (
      <div className="page">
        {error ? <div className="alert">{error}</div> : <p className="muted">Loading…</p>}
        <Link to="/">← Back to games</Link>
      </div>
    );
  }

  if (session.phase === 'setup') {
    return (
      <div className="page setup">
        <Link to="/" className="btn">
          ← Games
        </Link>
        <h1 className="logo">{game.title}</h1>
        <div className="setup-card">
          <h2>Players / teams</h2>
          <Players players={session.players} dispatch={dispatch} />
          <button
            className="btn btn-primary btn-large"
            disabled={session.players.length === 0}
            onClick={() => dispatch({ type: 'start' })}
          >
            Start game
          </button>
        </div>
      </div>
    );
  }

  const roundDone = round.categories.every((c) => c.clues.every((cl) => used.has(cl.id)));
  const isLastRound = roundIndex === game.rounds.length - 1;
  const inFinal = session.phase === 'final';

  return (
    <div className="play">
      <nav className="play-toolbar">
        <Link to="/" className="btn btn-small">
          ← Exit
        </Link>
        {inFinal ? (
          <button className="btn btn-small" onClick={() => dispatch({ type: 'leaveFinal' })}>
            ← Back to board
          </button>
        ) : (
          <>
            <button
              className="btn btn-small"
              disabled={roundIndex === 0}
              onClick={() => dispatch({ type: 'setRound', roundIndex: roundIndex - 1 })}
            >
              ◀
            </button>
            <span className="round-name">{round.name}</span>
            <button
              className={`btn btn-small ${roundDone && !isLastRound ? 'btn-gold' : ''}`}
              disabled={isLastRound}
              onClick={() => dispatch({ type: 'setRound', roundIndex: roundIndex + 1 })}
            >
              Next round ▶
            </button>
            <button
              className={`btn btn-small ${roundDone && isLastRound ? 'btn-gold' : ''}`}
              onClick={() => (roundDone || confirm('Go to Final Jeopardy now?')) && dispatch({ type: 'startFinal' })}
            >
              Final Jeopardy
            </button>
          </>
        )}
        <span className="spacer" />
        <button
          className="btn btn-small"
          disabled={session.history.length === 0}
          onClick={() => dispatch({ type: 'undo' })}
          title="Undo last score change"
        >
          ↶ Undo
        </button>
        <button className="btn btn-small" onClick={() => setShowPlayers(true)}>
          Players
        </button>
        <button
          className="btn btn-small"
          onClick={() => confirm('Reset all scores and clues and start over?') && dispatch({ type: 'reset' })}
        >
          Reset
        </button>
      </nav>

      <main className="play-main">
        {inFinal ? (
          <FinalJeopardy gameId={id} final={game.final} session={session} dispatch={dispatch} />
        ) : active && activeClue ? (
          <ClueView
            gameId={id}
            heading={
              <>
                <span>{round.categories[active.categoryIndex].name}</span>
                <span className="clue-heading-value">{formatMoney(active.value)}</span>
              </>
            }
            text={activeClue.text}
            media={activeClue.media}
            answer={activeClue.answer}
            revealed={active.revealed}
            textShown={active.textShown}
            mediaShown={active.mediaShown}
            controls={
              <>
                <button className="btn" onClick={() => dispatch({ type: 'closeClue', markUsed: false })} title="Return to the board without using up this clue">
                  Cancel
                </button>
                <TextToggle text={activeClue.text} visible={active.textShown} onToggle={() => dispatch({ type: 'showText' })} />
                <MediaToggle media={activeClue.media} visible={active.mediaShown} onToggle={() => dispatch({ type: 'showMedia' })} />
                <button className="btn btn-primary" onClick={() => dispatch({ type: 'reveal' })}>
                  {active.revealed ? 'Hide answer' : 'Reveal answer'} <kbd>Space</kbd>
                </button>
                <button className="btn btn-gold" onClick={() => dispatch({ type: 'closeClue', markUsed: true })}>
                  Close — no one <kbd>Esc</kbd>
                </button>
              </>
            }
          />
        ) : (
          <Board
            round={round}
            used={used}
            onPick={(categoryIndex, rowIndex) => {
              const clue = round.categories[categoryIndex].clues[rowIndex];
              dispatch({
                type: 'openClue',
                roundIndex,
                categoryIndex,
                rowIndex,
                clueId: clue.id,
                value: round.values[rowIndex],
                textShown: !clue.hideText,
                mediaShown: !!clue.autoShowMedia,
              });
            }}
          />
        )}
      </main>

      {!(inFinal && session.final.step === 'results') && (
        <ScoreBar
          players={session.players}
          onSetScore={(playerId, score) => dispatch({ type: 'setScore', playerId, score })}
          judging={
            !inFinal && active && activeClue
              ? { attempts: active.attempts, onJudge: (playerId, verdict) => dispatch({ type: 'judge', playerId, verdict }) }
              : undefined
          }
        />
      )}

      {showPlayers && (
        <Modal title="Players" onClose={() => setShowPlayers(false)}>
          <Players players={session.players} dispatch={dispatch} />
        </Modal>
      )}
    </div>
  );
}
