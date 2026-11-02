// Writes ../8db10-film/timeline.json from program.js: every operator move and every switching event, in film seconds.
//   node sims/8db10-shared/timeline.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DURATION, EVENTS, filmAt, SCRIPT} from './program.js';

const r = (x) => Math.round(x * 100) / 100;
const beats = {};
for (const e of SCRIPT) beats[`${e.view ? `view-${e.view}` : e.display ? `display-${e.display}` : `prog-${e.prog}`}@${e.t}`] = e.t;
for (const e of EVENTS) {
  const n = e.dev === 'fault' ? 'fault' : `${e.dev}-${e.to}${e.cause ? `-${e.cause}` : ''}`;
  beats[`${n}@${r(e.at)}`] = r(filmAt(e.at));
  if (e.dev === 'fault') {
    beats.separation = r(filmAt(e.sep));
    beats.clear = r(filmAt(e.ext));
  }
}
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '../8db10-film/timeline.json');
fs.writeFileSync(out, `${JSON.stringify({duration: DURATION, beats})}\n`);
console.log(`${Object.keys(beats).length} beats → ${out}`);
