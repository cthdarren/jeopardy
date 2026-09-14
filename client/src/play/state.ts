import { newId } from '../id';

export interface Player {
  id: string;
  name: string;
  score: number;
}

export type Verdict = 'right' | 'wrong';

export interface ActiveClue {
  roundIndex: number;
  categoryIndex: number;
  rowIndex: number;
  clueId: string;
  value: number;
  revealed: boolean;
  textShown: boolean;
  mediaShown: boolean;
  /** Players already judged on this clue. */
  attempts: Record<string, Verdict>;
}

export type FinalStep = 'category' | 'wagers' | 'clue' | 'results';

export interface FinalState {
  step: FinalStep;
  wagers: Record<string, number>;
  revealed: boolean;
  textShown: boolean;
  mediaShown: boolean;
  verdicts: Record<string, Verdict>;
  /** Score delta already applied to each player from their final verdict. */
  applied: Record<string, number>;
}

/** One undoable score change. */
interface HistoryEntry {
  scores: { playerId: string; prev: number }[];
  /** Clue that was marked used by this action and should be un-used on undo. */
  unuse?: string;
  /** Reopen this clue on undo (e.g. a "right" answer closed it). */
  reopen?: ActiveClue;
  /** Attempt to clear on undo (a "wrong" answer on the still-open clue). */
  attempt?: { clueId: string; playerId: string };
  final?: { playerId: string; prevVerdict?: Verdict; prevApplied: number };
}

export interface Session {
  version: 1;
  phase: 'setup' | 'board' | 'final';
  players: Player[];
  roundIndex: number;
  used: string[];
  active: ActiveClue | null;
  final: FinalState;
  history: HistoryEntry[];
}

export type Action =
  | { type: 'addPlayer'; name: string }
  | { type: 'renamePlayer'; playerId: string; name: string }
  | { type: 'removePlayer'; playerId: string }
  | { type: 'setScore'; playerId: string; score: number }
  | { type: 'start' }
  | { type: 'setRound'; roundIndex: number }
  | {
      type: 'openClue';
      roundIndex: number;
      categoryIndex: number;
      rowIndex: number;
      clueId: string;
      value: number;
      textShown?: boolean;
      mediaShown?: boolean;
    }
  | { type: 'reveal'; revealed?: boolean }
  | { type: 'showText'; shown?: boolean }
  | { type: 'showMedia'; shown?: boolean }
  | { type: 'judge'; playerId: string; verdict: Verdict }
  | { type: 'closeClue'; markUsed: boolean }
  | { type: 'undo' }
  | { type: 'startFinal' }
  | { type: 'leaveFinal' }
  /** textShown/mediaShown set the initial visibility when first showing the clue. */
  | { type: 'finalStep'; step: FinalStep; textShown?: boolean; mediaShown?: boolean }
  | { type: 'setWager'; playerId: string; wager: number }
  | { type: 'finalReveal'; revealed?: boolean }
  | { type: 'finalShowText'; shown?: boolean }
  | { type: 'finalShowMedia'; shown?: boolean }
  | { type: 'finalJudge'; playerId: string; verdict: Verdict | null }
  | { type: 'reset' };

const HISTORY_LIMIT = 200;

export function initialFinal(): FinalState {
  return { step: 'category', wagers: {}, revealed: false, textShown: true, mediaShown: false, verdicts: {}, applied: {} };
}

export function initialSession(): Session {
  return {
    version: 1,
    phase: 'setup',
    players: [],
    roundIndex: 0,
    used: [],
    active: null,
    final: initialFinal(),
    history: [],
  };
}

const pushHistory = (s: Session, entry: HistoryEntry): HistoryEntry[] => [...s.history, entry].slice(-HISTORY_LIMIT);

const updateScore = (players: Player[], playerId: string, fn: (score: number) => number) =>
  players.map((p) => (p.id === playerId ? { ...p, score: fn(p.score) } : p));

const scoreOf = (s: Session, playerId: string) => s.players.find((p) => p.id === playerId)?.score ?? 0;

export function reducer(s: Session, a: Action): Session {
  switch (a.type) {
    case 'addPlayer': {
      const name = a.name.trim();
      if (!name) return s;
      return { ...s, players: [...s.players, { id: newId(), name, score: 0 }] };
    }
    case 'renamePlayer':
      return { ...s, players: s.players.map((p) => (p.id === a.playerId ? { ...p, name: a.name } : p)) };
    case 'removePlayer':
      return {
        ...s,
        players: s.players.filter((p) => p.id !== a.playerId),
        history: s.history.filter((h) => !h.scores.some((c) => c.playerId === a.playerId)),
      };
    case 'setScore': {
      const prev = scoreOf(s, a.playerId);
      if (prev === a.score || !Number.isFinite(a.score)) return s;
      return {
        ...s,
        players: updateScore(s.players, a.playerId, () => a.score),
        history: pushHistory(s, { scores: [{ playerId: a.playerId, prev }] }),
      };
    }
    case 'start':
      return { ...s, phase: 'board' };
    case 'setRound':
      return { ...s, roundIndex: Math.max(0, a.roundIndex), active: null, phase: 'board' };
    case 'openClue':
      return {
        ...s,
        active: {
          roundIndex: a.roundIndex,
          categoryIndex: a.categoryIndex,
          rowIndex: a.rowIndex,
          clueId: a.clueId,
          value: a.value,
          revealed: false,
          textShown: a.textShown ?? true,
          mediaShown: a.mediaShown ?? false,
          attempts: {},
        },
      };
    case 'reveal':
      if (!s.active) return s;
      return { ...s, active: { ...s.active, revealed: a.revealed ?? !s.active.revealed } };
    case 'showText':
      if (!s.active) return s;
      return { ...s, active: { ...s.active, textShown: a.shown ?? !s.active.textShown } };
    case 'showMedia':
      if (!s.active) return s;
      return { ...s, active: { ...s.active, mediaShown: a.shown ?? !s.active.mediaShown } };
    case 'judge': {
      const active = s.active;
      if (!active || active.attempts[a.playerId]) return s;
      const prev = scoreOf(s, a.playerId);
      if (a.verdict === 'right') {
        return {
          ...s,
          players: updateScore(s.players, a.playerId, (n) => n + active.value),
          used: s.used.includes(active.clueId) ? s.used : [...s.used, active.clueId],
          active: null,
          history: pushHistory(s, {
            scores: [{ playerId: a.playerId, prev }],
            unuse: s.used.includes(active.clueId) ? undefined : active.clueId,
            reopen: active,
          }),
        };
      }
      return {
        ...s,
        players: updateScore(s.players, a.playerId, (n) => n - active.value),
        active: { ...active, attempts: { ...active.attempts, [a.playerId]: 'wrong' } },
        history: pushHistory(s, {
          scores: [{ playerId: a.playerId, prev }],
          attempt: { clueId: active.clueId, playerId: a.playerId },
        }),
      };
    }
    case 'closeClue': {
      if (!s.active) return s;
      const { clueId } = s.active;
      const used = a.markUsed && !s.used.includes(clueId) ? [...s.used, clueId] : s.used;
      return { ...s, used, active: null };
    }
    case 'undo': {
      const entry = s.history[s.history.length - 1];
      if (!entry) return s;
      let players = s.players;
      for (const c of entry.scores) players = updateScore(players, c.playerId, () => c.prev);
      let { used, active, final, roundIndex, phase } = s;
      if (entry.unuse) used = used.filter((id) => id !== entry.unuse);
      if (entry.reopen) {
        active = { ...entry.reopen };
        roundIndex = active.roundIndex;
        phase = 'board';
      }
      if (entry.attempt && active?.clueId === entry.attempt.clueId) {
        const attempts = { ...active.attempts };
        delete attempts[entry.attempt.playerId];
        active = { ...active, attempts };
      }
      if (entry.final) {
        const { playerId, prevVerdict, prevApplied } = entry.final;
        const verdicts = { ...final.verdicts };
        if (prevVerdict) verdicts[playerId] = prevVerdict;
        else delete verdicts[playerId];
        final = { ...final, verdicts, applied: { ...final.applied, [playerId]: prevApplied } };
      }
      return { ...s, players, used, active, final, roundIndex, phase, history: s.history.slice(0, -1) };
    }
    case 'startFinal':
      return { ...s, phase: 'final', active: null };
    case 'leaveFinal':
      return { ...s, phase: 'board' };
    case 'finalStep':
      return {
        ...s,
        final: {
          ...s.final,
          step: a.step,
          textShown: a.textShown ?? s.final.textShown,
          mediaShown: a.mediaShown ?? s.final.mediaShown,
        },
      };
    case 'setWager':
      return { ...s, final: { ...s.final, wagers: { ...s.final.wagers, [a.playerId]: a.wager } } };
    case 'finalReveal':
      return { ...s, final: { ...s.final, revealed: a.revealed ?? !s.final.revealed } };
    case 'finalShowText':
      return { ...s, final: { ...s.final, textShown: a.shown ?? !s.final.textShown } };
    case 'finalShowMedia':
      return { ...s, final: { ...s.final, mediaShown: a.shown ?? !s.final.mediaShown } };
    case 'finalJudge': {
      const wager = Math.abs(s.final.wagers[a.playerId] ?? 0);
      const prevApplied = s.final.applied[a.playerId] ?? 0;
      const prevVerdict = s.final.verdicts[a.playerId];
      if (prevVerdict === (a.verdict ?? undefined)) return s;
      const delta = a.verdict === 'right' ? wager : a.verdict === 'wrong' ? -wager : 0;
      const verdicts = { ...s.final.verdicts };
      if (a.verdict) verdicts[a.playerId] = a.verdict;
      else delete verdicts[a.playerId];
      return {
        ...s,
        players: updateScore(s.players, a.playerId, (n) => n - prevApplied + delta),
        final: { ...s.final, verdicts, applied: { ...s.final.applied, [a.playerId]: delta } },
        history: pushHistory(s, {
          scores: [{ playerId: a.playerId, prev: scoreOf(s, a.playerId) }],
          final: { playerId: a.playerId, prevVerdict, prevApplied },
        }),
      };
    }
    case 'reset':
      return { ...initialSession(), players: s.players.map((p) => ({ ...p, score: 0 })) };
  }
}

// ---- persistence ------------------------------------------------------------

const key = (gameId: string) => `jeopardy:session:${gameId}`;

export function loadSession(gameId: string): Session | null {
  try {
    const raw = localStorage.getItem(key(gameId));
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (s.version !== 1) return null;
    // sessions saved before per-clue reveal options existed showed the text
    if (s.active && s.active.textShown === undefined) s.active.textShown = true;
    const final = { ...initialFinal(), ...s.final };
    return { ...initialSession(), ...s, final };
  } catch {
    return null;
  }
}

export function saveSession(gameId: string, s: Session) {
  try {
    localStorage.setItem(key(gameId), JSON.stringify(s));
  } catch {}
}

export function clearSession(gameId: string) {
  try {
    localStorage.removeItem(key(gameId));
  } catch {}
}

export function hasSession(gameId: string): boolean {
  const s = loadSession(gameId);
  return !!s && s.phase !== 'setup';
}
