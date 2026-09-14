import express, { type ErrorRequestHandler } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { games } from './routes/games';
import { GAMES_DIR, HttpError, ensureDirs, gameDir, isSafeMediaFile } from './storage';

const PORT = Number(process.env.PORT ?? 8080);
const CLIENT_DIR = path.resolve(process.env.CLIENT_DIR ?? path.join(__dirname, '../../../../client/dist'));

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use('/api/games', games);

app.get('/media/:id/:file', (req, res, next) => {
  const { id, file } = req.params;
  if (!isSafeMediaFile(file)) return next(new HttpError(400, 'Invalid file name'));
  res.sendFile(path.join(gameDir(id), 'media', file), { maxAge: '1h' }, (err) => {
    if (err && !res.headersSent) next(new HttpError(404, 'Media not found'));
  });
});

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

if (fs.existsSync(CLIENT_DIR)) {
  app.use(express.static(CLIENT_DIR));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(CLIENT_DIR, 'index.html')));
}

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : err?.code === 'LIMIT_FILE_SIZE' ? 413 : 500;
  if (status === 500) console.error(err);
  if (res.headersSent) return res.destroy();
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
};
app.use(onError);

ensureDirs()
  .then(() => {
    app.listen(PORT, () => console.log(`Jeopardy running on http://localhost:${PORT} (data: ${GAMES_DIR})`));
  })
  .catch((err) => {
    console.error(`Cannot write to data directory ${GAMES_DIR}. Check its ownership/permissions.`, err);
    process.exit(1);
  });
