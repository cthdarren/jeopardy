import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Category, Clue, FinalJeopardy, Game, GameSummary, MediaRef, RevealOptions, Round } from '../../shared/types';

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? 'data');
export const GAMES_DIR = path.join(DATA_DIR, 'games');
export const TMP_DIR = path.join(DATA_DIR, 'tmp');

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const MEDIA_FILE_RE = /^[A-Za-z0-9-]+(\.[A-Za-z0-9]{1,10})?$/;

export async function ensureDirs() {
  await fs.mkdir(GAMES_DIR, { recursive: true });
  await fs.mkdir(TMP_DIR, { recursive: true });
}

export function gameDir(id: string): string {
  if (!ID_RE.test(id)) throw new HttpError(400, 'Invalid game id');
  return path.join(GAMES_DIR, id);
}

export function mediaDir(id: string): string {
  return path.join(gameDir(id), 'media');
}

export function isSafeMediaFile(file: string): boolean {
  return MEDIA_FILE_RE.test(file);
}

export function newId(): string {
  return randomUUID();
}

export function blankClue(): Clue {
  return { id: newId(), text: '', answer: '' };
}

export function blankRound(name: string, rows = 5, cols = 5, base = 200): Round {
  return {
    id: newId(),
    name,
    values: Array.from({ length: rows }, (_, i) => base * (i + 1)),
    categories: Array.from({ length: cols }, () => ({
      id: newId(),
      name: '',
      clues: Array.from({ length: rows }, blankClue),
    })),
  };
}

export function blankGame(title = 'Untitled game'): Game {
  return {
    version: 1,
    title,
    rounds: [blankRound('Jeopardy!')],
    final: { category: '', text: '', answer: '' },
  };
}

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function listGames(): Promise<GameSummary[]> {
  const entries = await fs.readdir(GAMES_DIR, { withFileTypes: true });
  const games: GameSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !ID_RE.test(entry.name)) continue;
    const file = path.join(GAMES_DIR, entry.name, 'game.json');
    try {
      const [raw, stat] = await Promise.all([fs.readFile(file, 'utf8'), fs.stat(file)]);
      const game = JSON.parse(raw) as Game;
      games.push({ id: entry.name, title: game.title, updatedAt: stat.mtime.toISOString() });
    } catch {
      // skip unreadable / partial game folders
    }
  }
  return games.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function readGame(id: string): Promise<Game> {
  const file = path.join(gameDir(id), 'game.json');
  if (!(await exists(file))) throw new HttpError(404, 'Game not found');
  return JSON.parse(await fs.readFile(file, 'utf8')) as Game;
}

export async function writeGame(id: string, game: Game): Promise<void> {
  const dir = gameDir(id);
  await fs.mkdir(path.join(dir, 'media'), { recursive: true });
  const tmp = path.join(dir, `game.json.${newId()}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(game, null, 2));
  await fs.rename(tmp, path.join(dir, 'game.json'));
}

export async function assertGameExists(id: string) {
  if (!(await exists(path.join(gameDir(id), 'game.json')))) throw new HttpError(404, 'Game not found');
}

export async function deleteGame(id: string) {
  await fs.rm(gameDir(id), { recursive: true, force: true });
}

export async function duplicateGame(id: string): Promise<string> {
  const game = await readGame(id);
  const copyId = newId();
  await fs.cp(gameDir(id), gameDir(copyId), { recursive: true });
  await writeGame(copyId, { ...game, title: `${game.title} (copy)` });
  return copyId;
}

/** All media files referenced by a game. */
export function referencedMedia(game: Game): Set<string> {
  const files = new Set<string>();
  for (const round of game.rounds)
    for (const cat of round.categories)
      for (const clue of cat.clues) if (clue.media) files.add(clue.media.file);
  if (game.final.media) files.add(game.final.media.file);
  return files;
}

/** Remove media files that no clue references anymore. */
export async function pruneMedia(id: string, game: Game) {
  const dir = mediaDir(id);
  const keep = referencedMedia(game);
  let files: string[] = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    return;
  }
  await Promise.all(files.filter((f) => !keep.has(f)).map((f) => fs.rm(path.join(dir, f), { force: true })));
}

// ---- validation -----------------------------------------------------------

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

function media(v: unknown): MediaRef | undefined {
  const m = obj(v);
  if (!['image', 'audio', 'video'].includes(m.kind as string)) return undefined;
  if (typeof m.file !== 'string' || !isSafeMediaFile(m.file)) return undefined;
  return { kind: m.kind as MediaRef['kind'], file: m.file };
}

function reveal(o: Record<string, unknown>): RevealOptions {
  return { hideText: o.hideText === true || undefined, autoShowMedia: o.autoShowMedia === true || undefined };
}

function clue(v: unknown): Clue {
  const c = obj(v);
  return { id: str(c.id) || newId(), text: str(c.text), answer: str(c.answer), media: media(c.media), ...reveal(c) };
}

/** Coerce untrusted JSON into a well-formed Game (grid shapes are normalised). */
export function validateGame(input: unknown): Game {
  const g = obj(input);
  if (!Array.isArray(g.rounds)) throw new HttpError(400, 'Invalid game: missing rounds');
  const rounds: Round[] = g.rounds.map((rv, i) => {
    const r = obj(rv);
    const values = (Array.isArray(r.values) ? r.values : []).map((n) => (Number.isFinite(Number(n)) ? Number(n) : 0));
    const categories: Category[] = (Array.isArray(r.categories) ? r.categories : []).map((cv) => {
      const c = obj(cv);
      const clues = (Array.isArray(c.clues) ? c.clues : []).slice(0, values.length).map(clue);
      while (clues.length < values.length) clues.push(blankClue());
      return { id: str(c.id) || newId(), name: str(c.name), clues };
    });
    return { id: str(r.id) || newId(), name: str(r.name, `Round ${i + 1}`), values, categories };
  });
  const f = obj(g.final);
  const final: FinalJeopardy = {
    category: str(f.category),
    text: str(f.text),
    answer: str(f.answer),
    media: media(f.media),
    ...reveal(f),
  };
  return { version: 1, title: str(g.title, 'Untitled game') || 'Untitled game', rounds, final };
}
