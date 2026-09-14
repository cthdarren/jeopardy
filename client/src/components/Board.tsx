import type { Round } from '../../../shared/types';
import { formatMoney } from '../gameEdit';

interface Props {
  round: Round;
  used: Set<string>;
  onPick: (categoryIndex: number, rowIndex: number) => void;
}

export default function Board({ round, used, onPick }: Props) {
  return (
    <div
      className="board"
      style={{
        gridTemplateColumns: `repeat(${round.categories.length}, minmax(0, 1fr))`,
        gridTemplateRows: `auto repeat(${round.values.length}, minmax(0, 1fr))`,
      }}
    >
      {round.categories.map((c) => (
        <div key={c.id} className="board-category">
          <span>{c.name}</span>
        </div>
      ))}
      {round.values.map((value, ri) =>
        round.categories.map((c, ci) => {
          const clue = c.clues[ri];
          const isUsed = used.has(clue.id);
          return (
            <button
              key={clue.id}
              className={`board-cell ${isUsed ? 'used' : ''}`}
              style={{ gridRow: ri + 2, gridColumn: ci + 1 }}
              onClick={() => (!isUsed || confirm('This clue was already played. Open it again?')) && onPick(ci, ri)}
            >
              {!isUsed && formatMoney(value)}
            </button>
          );
        }),
      )}
    </div>
  );
}
