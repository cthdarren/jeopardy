import { describe, expect, it } from 'vitest';
import { type Action, type Session, initialSession, reducer } from './state';

const run = (actions: Action[], start: Session = initialSession()) => actions.reduce(reducer, start);

function withPlayers(...names: string[]) {
  return run(names.map((name) => ({ type: 'addPlayer', name }) as Action).concat({ type: 'start' }));
}

const open = (clueId = 'c1', value = 400): Action => ({
  type: 'openClue',
  roundIndex: 0,
  categoryIndex: 0,
  rowIndex: 1,
  clueId,
  value,
});

const scores = (s: Session) => s.players.map((p) => p.score);

describe('play reducer', () => {
  it('ignores blank player names and supports many players', () => {
    let s = run([{ type: 'addPlayer', name: '  ' }]);
    expect(s.players).toHaveLength(0);
    s = run(Array.from({ length: 50 }, (_, i) => ({ type: 'addPlayer', name: `P${i}` }) as Action));
    expect(s.players).toHaveLength(50);
  });

  it('right answer adds value, closes clue and marks it used', () => {
    const s0 = withPlayers('A', 'B');
    const s = run([open(), { type: 'judge', playerId: s0.players[0].id, verdict: 'right' }], s0);
    expect(scores(s)).toEqual([400, 0]);
    expect(s.active).toBeNull();
    expect(s.used).toEqual(['c1']);
  });

  it('wrong answer subtracts value and keeps clue open for others', () => {
    const s0 = withPlayers('A', 'B');
    const [a, b] = s0.players;
    let s = run([open(), { type: 'judge', playerId: a.id, verdict: 'wrong' }], s0);
    expect(scores(s)).toEqual([-400, 0]);
    expect(s.active?.attempts[a.id]).toBe('wrong');
    // same player can't be judged twice on one clue
    s = reducer(s, { type: 'judge', playerId: a.id, verdict: 'wrong' });
    expect(scores(s)).toEqual([-400, 0]);
    s = reducer(s, { type: 'judge', playerId: b.id, verdict: 'right' });
    expect(scores(s)).toEqual([-400, 400]);
    expect(s.used).toEqual(['c1']);
  });

  it('media starts hidden on every clue and toggles independently of the answer', () => {
    const s0 = withPlayers('A');
    let s = run([open()], s0);
    expect(s.active?.mediaShown).toBe(false);
    s = run([{ type: 'showMedia' }, { type: 'reveal' }], s);
    expect(s.active).toMatchObject({ mediaShown: true, revealed: true });
    s = reducer(s, { type: 'showMedia' });
    expect(s.active).toMatchObject({ mediaShown: false, revealed: true });
    // reopening a clue hides media again
    s = run([{ type: 'closeClue', markUsed: false }, open()], s);
    expect(s.active?.mediaShown).toBe(false);

    let f = run([{ type: 'startFinal' }], s0);
    expect(f.final.mediaShown).toBe(false);
    f = reducer(f, { type: 'finalShowMedia' });
    expect(f.final.mediaShown).toBe(true);
  });

  it('per-clue reveal options set initial visibility of question and media', () => {
    const s0 = withPlayers('A');
    let s = run([{ ...open(), textShown: false, mediaShown: true } as Action], s0);
    expect(s.active).toMatchObject({ textShown: false, mediaShown: true });
    s = reducer(s, { type: 'showText' });
    expect(s.active?.textShown).toBe(true);
    // defaults when not specified: question shown, media hidden
    s = run([{ type: 'closeClue', markUsed: false }, open()], s);
    expect(s.active).toMatchObject({ textShown: true, mediaShown: false });

    let f = run([{ type: 'startFinal' }, { type: 'finalStep', step: 'clue', textShown: false, mediaShown: true }], s0);
    expect(f.final).toMatchObject({ textShown: false, mediaShown: true });
    f = run([{ type: 'finalShowText' }, { type: 'finalStep', step: 'results' }, { type: 'finalStep', step: 'clue' }], f);
    // going back to the clue from the standings keeps what the host already showed
    expect(f.final).toMatchObject({ textShown: true, mediaShown: true });
  });

  it('closing without an answer can mark the clue used or not', () => {
    const s0 = withPlayers('A');
    expect(run([open(), { type: 'closeClue', markUsed: true }], s0).used).toEqual(['c1']);
    expect(run([open(), { type: 'closeClue', markUsed: false }], s0).used).toEqual([]);
  });

  it('manual score edits and undo', () => {
    const s0 = withPlayers('A');
    const id = s0.players[0].id;
    let s = run([{ type: 'setScore', playerId: id, score: 1234 }, { type: 'setScore', playerId: id, score: -50 }], s0);
    expect(scores(s)).toEqual([-50]);
    s = reducer(s, { type: 'undo' });
    expect(scores(s)).toEqual([1234]);
    s = reducer(s, { type: 'undo' });
    expect(scores(s)).toEqual([0]);
    expect(reducer(s, { type: 'undo' })).toBe(s);
  });

  it('undoing a right answer restores score and reopens the clue', () => {
    const s0 = withPlayers('A', 'B');
    const [a, b] = s0.players;
    let s = run(
      [open(), { type: 'judge', playerId: a.id, verdict: 'wrong' }, { type: 'judge', playerId: b.id, verdict: 'right' }],
      s0,
    );
    s = reducer(s, { type: 'undo' });
    expect(scores(s)).toEqual([-400, 0]);
    expect(s.used).toEqual([]);
    expect(s.active?.clueId).toBe('c1');
    expect(s.active?.attempts).toEqual({ [a.id]: 'wrong' });
    s = reducer(s, { type: 'undo' });
    expect(scores(s)).toEqual([0, 0]);
    expect(s.active?.attempts).toEqual({});
  });

  it('final jeopardy applies any wager, can be changed and undone', () => {
    const s0 = withPlayers('A', 'B', 'C');
    const [a, b, c] = s0.players;
    let s = run(
      [
        { type: 'setScore', playerId: a.id, score: 1000 },
        { type: 'setScore', playerId: b.id, score: -200 },
        { type: 'startFinal' },
        { type: 'setWager', playerId: a.id, wager: 1000 },
        { type: 'setWager', playerId: b.id, wager: 5000 }, // no limits
        { type: 'finalJudge', playerId: a.id, verdict: 'wrong' },
        { type: 'finalJudge', playerId: b.id, verdict: 'right' },
        { type: 'finalJudge', playerId: c.id, verdict: 'right' }, // no wager -> 0
      ],
      s0,
    );
    expect(scores(s)).toEqual([0, 4800, 0]);
    // host corrects a verdict: delta is recalculated, not stacked
    s = reducer(s, { type: 'finalJudge', playerId: a.id, verdict: 'right' });
    expect(scores(s)).toEqual([2000, 4800, 0]);
    s = reducer(s, { type: 'finalJudge', playerId: a.id, verdict: null });
    expect(scores(s)).toEqual([1000, 4800, 0]);
    expect(s.final.verdicts[a.id]).toBeUndefined();
    s = reducer(s, { type: 'undo' });
    expect(scores(s)).toEqual([2000, 4800, 0]);
    expect(s.final.verdicts[a.id]).toBe('right');
    s = reducer(s, { type: 'finalJudge', playerId: a.id, verdict: 'wrong' });
    expect(scores(s)).toEqual([0, 4800, 0]);
  });
});
