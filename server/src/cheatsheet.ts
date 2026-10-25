import type { Response } from 'express';
import { readGame } from './storage';

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const cell = (s: string) => escape(s.trim()).replace(/\n/g, '<br>') || '<span class="none">—</span>';

/** Sends a printable HTML page listing every answer, laid out like the board. */
export async function exportCheatsheet(id: string, res: Response) {
  const game = await readGame(id);
  const filename = (game.title.replace(/[^\w\- ]+/g, '').trim() || 'game') + ' - cheatsheet.html';

  const rounds = game.rounds
    .map(
      (round) => `
<h2>${escape(round.name)}</h2>
<table>
  <tr><th></th>${round.categories.map((c) => `<th>${escape(c.name)}</th>`).join('')}</tr>
  ${round.values
    .map(
      (value, row) =>
        `<tr><th>${value}</th>${round.categories.map((c) => `<td>${cell(c.clues[row]?.answer ?? '')}</td>`).join('')}</tr>`,
    )
    .join('\n  ')}
</table>`,
    )
    .join('\n');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escape(game.title)} — Cheatsheet</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; margin-bottom: 24px; }
  th, td { border: 1px solid #999; padding: 6px 8px; vertical-align: top; text-align: left; }
  th { background: #eee; }
  tr th:first-child { width: 60px; }
  .none { color: #aaa; }
  h2 { page-break-before: auto; }
  table { page-break-inside: avoid; }
</style>
</head>
<body>
<h1>${escape(game.title)} — Answers</h1>
${rounds}
<h2>Final Jeopardy</h2>
<table>
  <tr><th>Category</th><td>${cell(game.final.category)}</td></tr>
  <tr><th>Answer</th><td>${cell(game.final.answer)}</td></tr>
</table>
</body>
</html>
`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(html);
}
