export type MediaKind = 'image' | 'audio' | 'video';

/** A media file stored in the game's media/ folder. */
export interface MediaRef {
  kind: MediaKind;
  file: string;
}

/** How a clue's parts appear when it is opened during play. */
export interface RevealOptions {
  /** Keep the clue text hidden until the host clicks "Show question" (default: shown). */
  hideText?: boolean;
  /** Show the media as soon as the clue opens (default: hidden until "Show media"). */
  autoShowMedia?: boolean;
}

export interface Clue extends RevealOptions {
  id: string;
  text: string;
  media?: MediaRef;
  answer: string;
}

export interface Category {
  id: string;
  name: string;
  /** One clue per row; clues.length === round.values.length */
  clues: Clue[];
}

export interface Round {
  id: string;
  name: string;
  /** Monetary value of each row, shared by every category. */
  values: number[];
  categories: Category[];
}

export interface FinalJeopardy extends RevealOptions {
  category: string;
  text: string;
  media?: MediaRef;
  answer: string;
}

export interface Game {
  version: 1;
  title: string;
  rounds: Round[];
  final: FinalJeopardy;
}

export interface GameSummary {
  id: string;
  title: string;
  updatedAt: string;
}
