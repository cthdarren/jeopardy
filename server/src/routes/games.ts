import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { MediaKind, MediaRef } from '../../../shared/types';
import { exportGame, importBundle } from '../bundle';
import {
  HttpError,
  TMP_DIR,
  assertGameExists,
  blankGame,
  deleteGame,
  duplicateGame,
  listGames,
  mediaDir,
  newId,
  pruneMedia,
  readGame,
  validateGame,
  writeGame,
} from '../storage';

const MAX_UPLOAD = 4 * 1024 * 1024 * 1024; // 4 GB

const mediaUpload = multer({
  limits: { fileSize: MAX_UPLOAD },
  storage: multer.diskStorage({
    destination: (req, _file, cb) => cb(null, mediaDir(req.params.id as string)),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 11);
      cb(null, newId() + ext);
    },
  }),
});

const bundleUpload = multer({ dest: TMP_DIR, limits: { fileSize: MAX_UPLOAD } });

export const games = Router();

games.get('/', async (_req, res) => {
  res.json(await listGames());
});

games.post('/', async (_req, res) => {
  const id = newId();
  await writeGame(id, blankGame());
  res.status(201).json({ id });
});

games.post('/import', bundleUpload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file uploaded');
  try {
    const id = await importBundle(req.file.path);
    res.status(201).json({ id });
  } finally {
    await fs.rm(req.file.path, { force: true });
  }
});

games.get('/:id', async (req, res) => {
  res.json(await readGame(req.params.id));
});

games.put('/:id', async (req, res) => {
  await assertGameExists(req.params.id);
  const game = validateGame(req.body);
  await writeGame(req.params.id, game);
  await pruneMedia(req.params.id, game);
  res.json(game);
});

games.delete('/:id', async (req, res) => {
  await deleteGame(req.params.id);
  res.status(204).end();
});

games.post('/:id/duplicate', async (req, res) => {
  res.status(201).json({ id: await duplicateGame(req.params.id) });
});

games.get('/:id/export', async (req, res) => {
  await exportGame(req.params.id, res);
});

games.post(
  '/:id/media',
  async (req, _res, next) => {
    const id = req.params.id as string;
    await assertGameExists(id);
    await fs.mkdir(mediaDir(id), { recursive: true });
    next();
  },
  mediaUpload.single('file'),
  async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No file uploaded');
    const kind = req.file.mimetype.split('/')[0] as MediaKind;
    if (!['image', 'audio', 'video'].includes(kind)) {
      await fs.rm(req.file.path, { force: true });
      throw new HttpError(400, 'Only image, audio and video files are supported');
    }
    const ref: MediaRef = { kind, file: req.file.filename };
    res.status(201).json(ref);
  },
);
