import type { Game, GameSummary, MediaRef } from '../../shared/types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Upload with progress reporting (fetch can't report upload progress). */
function upload<T>(url: string, file: File, onProgress?: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let body: any = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
      else reject(new Error(body?.error ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed (network error)'));
    xhr.send(form);
  });
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  listGames: () => request<GameSummary[]>('/api/games'),
  createGame: () => request<{ id: string }>('/api/games', { method: 'POST' }),
  getGame: (id: string) => request<Game>(`/api/games/${id}`),
  saveGame: (id: string, game: Game) => request<Game>(`/api/games/${id}`, json('PUT', game)),
  deleteGame: (id: string) => request<void>(`/api/games/${id}`, { method: 'DELETE' }),
  duplicateGame: (id: string) => request<{ id: string }>(`/api/games/${id}/duplicate`, { method: 'POST' }),
  exportUrl: (id: string) => `/api/games/${id}/export`,
  cheatsheetUrl: (id: string) => `/api/games/${id}/cheatsheet`,
  importGame: (file: File, onProgress?: (f: number) => void) =>
    upload<{ id: string }>('/api/games/import', file, onProgress),
  uploadMedia: (id: string, file: File, onProgress?: (f: number) => void) =>
    upload<MediaRef>(`/api/games/${id}/media`, file, onProgress),
};

export const mediaUrl = (gameId: string, media: MediaRef) => `/media/${gameId}/${media.file}`;
