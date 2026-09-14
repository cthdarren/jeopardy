import { useState } from 'react';
import { formatMoney } from '../gameEdit';
import type { Player, Verdict } from '../play/state';

interface Props {
  players: Player[];
  onSetScore: (playerId: string, score: number) => void;
  /** When set, show right/wrong buttons for judging the open clue. */
  judging?: {
    attempts: Record<string, Verdict>;
    onJudge: (playerId: string, verdict: Verdict) => void;
  };
}

function Score({ player, onSetScore }: { player: Player; onSetScore: Props['onSetScore'] }) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.replace(/[$,\s]/g, ''));
    if (draft.trim() !== '' && Number.isFinite(n)) onSetScore(player.id, Math.round(n));
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <input
        className="score-input"
        autoFocus
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            e.stopPropagation();
            setDraft(null);
          }
        }}
      />
    );
  }
  return (
    <button
      className={`score ${player.score < 0 ? 'negative' : ''}`}
      title="Click to edit score"
      onClick={() => setDraft(String(player.score))}
    >
      {formatMoney(player.score)}
    </button>
  );
}

export default function ScoreBar({ players, onSetScore, judging }: Props) {
  if (players.length === 0) return null;
  return (
    <footer className="score-bar">
      {players.map((p) => {
        const attempt = judging?.attempts[p.id];
        return (
          <div key={p.id} className={`player-card ${attempt ? `attempt-${attempt}` : ''}`}>
            <Score player={p} onSetScore={onSetScore} />
            <div className="player-name">{p.name}</div>
            {judging && (
              <div className="judge-buttons">
                <button
                  className="btn-judge right"
                  disabled={!!attempt}
                  onClick={() => judging.onJudge(p.id, 'right')}
                  title={`${p.name} answered correctly`}
                >
                  ✓
                </button>
                <button
                  className="btn-judge wrong"
                  disabled={!!attempt}
                  onClick={() => judging.onJudge(p.id, 'wrong')}
                  title={`${p.name} answered incorrectly`}
                >
                  ✗
                </button>
              </div>
            )}
          </div>
        );
      })}
    </footer>
  );
}
