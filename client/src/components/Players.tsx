import { type Dispatch, useState } from 'react';
import { formatMoney } from '../gameEdit';
import type { Action, Player } from '../play/state';

interface Props {
  players: Player[];
  dispatch: Dispatch<Action>;
}

export default function Players({ players, dispatch }: Props) {
  const [name, setName] = useState('');

  const add = () => {
    dispatch({ type: 'addPlayer', name });
    setName('');
  };

  return (
    <div className="players">
      <form
        className="row gap"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          className="grow"
          value={name}
          autoFocus
          placeholder="Player or team name"
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>
      {players.length > 0 && (
        <ul className="player-list">
          {players.map((p) => (
            <li key={p.id} className="row gap">
              <input
                className="grow"
                value={p.name}
                aria-label="Player name"
                onChange={(e) => dispatch({ type: 'renamePlayer', playerId: p.id, name: e.target.value })}
              />
              <span className="muted player-list-score">{formatMoney(p.score)}</span>
              <button
                className="btn btn-danger"
                onClick={() => confirm(`Remove ${p.name || 'this player'}?`) && dispatch({ type: 'removePlayer', playerId: p.id })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
