# Jeopardy!

A self-hosted app for running Jeopardy-style games with friends. It's built for a single screen: the host runs the game from a laptop connected to a TV or projector while everyone watches. Buzzing in is handled outside the app, for example with a physical buzzer.

## Running

```sh
docker compose up -d --build
```

Open http://localhost:8080. Other devices on your network can use `http://<your-ip>:8080`.

- Games are stored in `./data` on the host.
- The container runs as uid/gid 1000 so the files in `./data` belong to you. If your uid differs, run `PUID=$(id -u) PGID=$(id -g) docker compose up -d`.
- To use a different port, set `JEOPARDY_PORT=9000`.

## Features

- **Game editor**
  - Any number of rounds (for example Jeopardy! and Double Jeopardy!).
  - Each round has its own number of categories and rows, with one value per row.
  - Clues can be text, an image, audio, video, or text combined with media.
  - A Final Jeopardy category and clue.
- **Game files**: every game can be exported as a single `.jeopardy` file (a zip holding `game.json` and a `media/` folder) and imported again on any instance.
- **Host controls**
  - Click a value to open a clue. Press `Space` to reveal the answer.
  - Press ✓ under a player to add the value and close the clue.
  - Press ✗ under a player to subtract the value; the clue stays open so someone else can buzz in.
  - Press `Esc` (or *Close — no one*) to close a clue nobody got. *Cancel* returns to the board without using up the clue.
  - Click any score to type in a new number. **Undo** reverts the last score change.
  - Add, rename or remove players and teams at any time. There's no limit on how many.
- **Final Jeopardy**
  1. Show the category.
  2. Enter each player's wager. Wagers are hidden from the audience by default and have no limits.
  3. Show the clue and reveal the answer.
  4. Mark each player ✓/✗. Their wager is shown once judged.
  5. Show the final standings.
- **Saved progress**: a game in progress is stored in the browser, so refreshing the page or exiting and choosing *Resume* keeps your place.

## Development

```sh
npm install
npm run dev --workspace server   # API on :8080 (stores data in ./data)
npm run dev --workspace client   # Vite on :5173, proxies /api and /media
npm test                         # play-state unit tests
```

The code is organised as follows:
- `shared/types.ts`: the game file format.
- `server/`: Express API and storage.
- `client/`: the React app.
