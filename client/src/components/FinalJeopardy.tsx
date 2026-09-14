import { type Dispatch, useEffect, useState } from 'react';
import type { FinalJeopardy as FinalData } from '../../../shared/types';
import { formatMoney } from '../gameEdit';
import type { Action, Session } from '../play/state';
import ClueView, { MediaToggle, TextToggle, isMediaTarget, isTypingTarget } from './ClueView';

interface Props {
  gameId: string;
  final: FinalData;
  session: Session;
  dispatch: Dispatch<Action>;
}

export default function FinalJeopardy({ gameId, final, session, dispatch }: Props) {
  const { step, wagers, verdicts, revealed, textShown, mediaShown } = session.final;
  const { players } = session;
  const [showWagers, setShowWagers] = useState(false);
  const go = (s: typeof step) => dispatch({ type: 'finalStep', step: s });

  useEffect(() => {
    if (step !== 'clue') return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === ' ') {
        if (isMediaTarget(e.target)) return;
        e.preventDefault();
        dispatch({ type: 'finalReveal' });
      } else if (e.key.toLowerCase() === 'q') {
        dispatch({ type: 'finalShowText' });
      } else if (e.key.toLowerCase() === 'm') {
        dispatch({ type: 'finalShowMedia' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, dispatch]);

  if (step === 'category' || step === 'wagers') {
    return (
      <div className="final">
        <div className="final-splash">
          <div className="final-logo">FINAL JEOPARDY!</div>
          <div className="final-category">{final.category || 'Category'}</div>
        </div>
        {step === 'wagers' && (
          <div className="host-panel">
            <div className="row gap">
              <h3 className="grow">Wagers</h3>
              <label className="row gap-sm small">
                <input type="checkbox" checked={showWagers} onChange={(e) => setShowWagers(e.target.checked)} />
                Show wagers
              </label>
            </div>
            <div className="wager-list">
              {players.map((p) => (
                <label key={p.id} className="wager-row">
                  <span className="grow">{p.name}</span>
                  <span className="muted">{formatMoney(p.score)}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`wager-input ${showWagers ? '' : 'masked'}`}
                    value={wagers[p.id] ?? ''}
                    placeholder="0"
                    autoComplete="off"
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/[^\d]/g, ''));
                      dispatch({ type: 'setWager', playerId: p.id, wager: n });
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="host-controls">
          {step === 'category' ? (
            <button className="btn btn-primary" onClick={() => go('wagers')}>
              Enter wagers →
            </button>
          ) : (
            <>
              <button className="btn" onClick={() => go('category')}>
                ← Back
              </button>
              <button
                className="btn btn-primary"
                onClick={() =>
                  dispatch({ type: 'finalStep', step: 'clue', textShown: !final.hideText, mediaShown: !!final.autoShowMedia })
                }
              >
                Show clue →
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (step === 'clue') {
    return (
      <div className="final">
        <ClueView
          gameId={gameId}
          heading={
            <>
              <span>FINAL JEOPARDY</span>
              <span className="clue-heading-value">{final.category}</span>
            </>
          }
          text={final.text}
          media={final.media}
          answer={final.answer}
          revealed={revealed}
          textShown={textShown}
          mediaShown={mediaShown}
          controls={
            <>
              <button className="btn" onClick={() => go('wagers')}>
                ← Wagers
              </button>
              <TextToggle text={final.text} visible={textShown} onToggle={() => dispatch({ type: 'finalShowText' })} />
              <MediaToggle media={final.media} visible={mediaShown} onToggle={() => dispatch({ type: 'finalShowMedia' })} />
              <button className="btn btn-primary" onClick={() => dispatch({ type: 'finalReveal' })}>
                {revealed ? 'Hide answer' : 'Reveal answer'} <kbd>Space</kbd>
              </button>
              <button className="btn btn-gold" onClick={() => go('results')}>
                Final standings →
              </button>
            </>
          }
        />
        {revealed && (
          <div className="host-panel final-judging">
            {players.map((p) => {
              const v = verdicts[p.id];
              return (
                <div key={p.id} className={`final-judge-row ${v ?? ''}`}>
                  <span className="grow">{p.name}</span>
                  <span className="final-wager">{v ? `${v === 'right' ? '+' : '−'}${formatMoney(wagers[p.id] ?? 0)}` : '???'}</span>
                  <button
                    className={`btn-judge right ${v === 'right' ? 'selected' : ''}`}
                    onClick={() => dispatch({ type: 'finalJudge', playerId: p.id, verdict: v === 'right' ? null : 'right' })}
                  >
                    ✓
                  </button>
                  <button
                    className={`btn-judge wrong ${v === 'wrong' ? 'selected' : ''}`}
                    onClick={() => dispatch({ type: 'finalJudge', playerId: p.id, verdict: v === 'wrong' ? null : 'wrong' })}
                  >
                    ✗
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const standings = [...players].sort((a, b) => b.score - a.score);
  const top = standings[0]?.score;
  return (
    <div className="final">
      <div className="standings">
        <div className="final-logo">FINAL STANDINGS</div>
        <ol>
          {standings.map((p) => (
            <li key={p.id} className={p.score === top ? 'winner' : ''}>
              <span className="standing-name">
                {p.score === top && '👑 '}
                {p.name}
              </span>
              <span className={`standing-score ${p.score < 0 ? 'negative' : ''}`}>{formatMoney(p.score)}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="host-controls">
        <button className="btn" onClick={() => go('clue')}>
          ← Back to judging
        </button>
      </div>
    </div>
  );
}
