import type { Category, Clue, Game, Round } from '../../shared/types';
import { newId } from './id';

export const blankClue = (): Clue => ({ id: newId(), text: '', answer: '' });

export const blankCategory = (rows: number): Category => ({
  id: newId(),
  name: '',
  clues: Array.from({ length: rows }, blankClue),
});

export function blankRound(name: string, rows = 5, cols = 5, base = 200): Round {
  return {
    id: newId(),
    name,
    values: Array.from({ length: rows }, (_, i) => base * (i + 1)),
    categories: Array.from({ length: cols }, () => blankCategory(rows)),
  };
}

/** Change grid size while keeping existing clues. New rows continue the value progression. */
export function resizeRound(round: Round, rows: number, cols: number): Round {
  rows = Math.max(1, Math.min(20, Math.floor(rows) || 1));
  cols = Math.max(1, Math.min(20, Math.floor(cols) || 1));
  const values = round.values.slice(0, rows);
  const step = values.length >= 2 ? values[values.length - 1] - values[values.length - 2] : values[0] || 200;
  while (values.length < rows) values.push((values[values.length - 1] ?? 0) + step);
  const categories = round.categories.slice(0, cols).map((c) => {
    const clues = c.clues.slice(0, rows);
    while (clues.length < rows) clues.push(blankClue());
    return { ...c, clues };
  });
  while (categories.length < cols) categories.push(blankCategory(rows));
  return { ...round, values, categories };
}

export const isClueComplete = (c: Clue) => (c.text.trim() !== '' || !!c.media) && c.answer.trim() !== '';

export function countIncomplete(game: Game): number {
  let n = 0;
  for (const r of game.rounds) for (const cat of r.categories) for (const c of cat.clues) if (!isClueComplete(c)) n++;
  return n;
}

export const formatMoney = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString();
