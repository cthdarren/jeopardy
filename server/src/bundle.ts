import { ZipArchive } from 'archiver';
import type { Response } from 'express';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import {
  HttpError,
  gameDir,
  isSafeMediaFile,
  newId,
  readGame,
  referencedMedia,
  validateGame,
  writeGame,
} from './storage';

const MAX_GAME_JSON = 10 * 1024 * 1024;

/** Stream a game folder to the client as a .jeopardy (zip) file. */
export async function exportGame(id: string, res: Response) {
  const game = await readGame(id);
  const dir = gameDir(id);
  const filename = (game.title.replace(/[^\w\- ]+/g, '').trim() || 'game') + '.jeopardy';

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // media is usually already compressed, so just store entries
  const zip = new ZipArchive({ store: true });
  zip.on('error', (err: Error) => res.destroy(err));
  zip.pipe(res);
  zip.file(path.join(dir, 'game.json'), { name: 'game.json' });
  for (const file of referencedMedia(game)) {
    zip.file(path.join(dir, 'media', file), { name: `media/${file}` });
  }
  await zip.finalize();
}

function openZip(file: string): Promise<ZipFile> {
  return new Promise((resolve, reject) =>
    yauzl.open(file, { lazyEntries: true, autoClose: false }, (err, zip) =>
      err ? reject(new HttpError(400, 'Not a valid .jeopardy file')) : resolve(zip),
    ),
  );
}

function readEntries(zip: ZipFile): Promise<Entry[]> {
  return new Promise((resolve, reject) => {
    const entries: Entry[] = [];
    zip.on('entry', (e: Entry) => {
      entries.push(e);
      zip.readEntry();
    });
    zip.on('end', () => resolve(entries));
    zip.on('error', () => reject(new HttpError(400, 'Not a valid .jeopardy file')));
    zip.readEntry();
  });
}

function entryStream(zip: ZipFile, entry: Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => zip.openReadStream(entry, (err, s) => (err ? reject(err) : resolve(s))));
}

/**
 * Import an uploaded .jeopardy file into a new game folder and return its id.
 * Only game.json and safely-named files under media/ are extracted; everything else is ignored.
 */
export async function importBundle(zipPath: string): Promise<string> {
  const zip = await openZip(zipPath);
  const id = newId();
  const dest = gameDir(id);
  try {
    const entries = await readEntries(zip);

    // Accept game.json at the root, or inside a single top-level folder (re-zipped by hand).
    const gameEntry = entries
      .filter((e) => /(^|\/)game\.json$/.test(e.fileName) && e.fileName.split('/').length <= 2)
      .sort((a, b) => a.fileName.length - b.fileName.length)[0];
    if (!gameEntry) throw new HttpError(400, 'Bundle is missing game.json');
    if (gameEntry.uncompressedSize > MAX_GAME_JSON) throw new HttpError(400, 'game.json is too large');
    const prefix = gameEntry.fileName.slice(0, -'game.json'.length);

    const chunks: Buffer[] = [];
    for await (const chunk of await entryStream(zip, gameEntry)) chunks.push(chunk as Buffer);
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new HttpError(400, 'Bundle game.json is not valid JSON');
    }
    const game = validateGame(parsed);

    const mediaEntries = new Map<string, Entry>();
    for (const e of entries) {
      if (!e.fileName.startsWith(prefix + 'media/')) continue;
      const name = e.fileName.slice(prefix.length + 'media/'.length);
      if (isSafeMediaFile(name)) mediaEntries.set(name, e);
    }

    // drop references to media that isn't actually in the bundle
    for (const round of game.rounds)
      for (const cat of round.categories)
        for (const clue of cat.clues) if (clue.media && !mediaEntries.has(clue.media.file)) delete clue.media;
    if (game.final.media && !mediaEntries.has(game.final.media.file)) delete game.final.media;

    await fs.mkdir(path.join(dest, 'media'), { recursive: true });
    for (const file of referencedMedia(game)) {
      await pipeline(await entryStream(zip, mediaEntries.get(file)!), createWriteStream(path.join(dest, 'media', file)));
    }
    await writeGame(id, game);
    return id;
  } catch (err) {
    await fs.rm(dest, { recursive: true, force: true });
    throw err;
  } finally {
    zip.close();
  }
}
