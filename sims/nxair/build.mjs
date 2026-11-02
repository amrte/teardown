#!/usr/bin/env node
// Builds the NXAIR teardown into one self-contained page (three.js inlined):
//   teardown-out/dist/nxair.html            full document, opens offline from file://
//   teardown-out/dist/nxair.artifact.html   the same page without the outer document tags, for hosts that wrap it
//
//   node sims/nxair/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEPS, DIST, fromDeps} from '../../paths.mjs';

const esbuild = fromDeps('esbuild');
const HERE = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(DIST, {recursive: true});

const res = await esbuild.build({
  entryPoints: [path.join(HERE, 'app.js')],
  bundle: true,
  nodePaths: [DEPS],
  format: 'esm',
  minify: !process.env.SIMS_DEBUG,
  write: false,
  target: 'es2022',
  legalComments: 'none',
  logLevel: 'warning',
});
const js = res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const cssText = fs.readFileSync(path.join(HERE, 'style.css'), 'utf8');
const body = fs.readFileSync(path.join(HERE, 'index.html'), 'utf8');
const head = `<title>NXAIR Teardown</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Interactive 3D teardown of Siemens NXAIR air-insulated MV switchgear: every part, every bolted joint with size, washers and tightening torque, installation steps, specs.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Sans:wght@400;600&display=swap">
<style>
${cssText}
</style>`;
const fragment = `${head}
${body}
<script type="module">
${js}
</script>
`;
const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${head}
</head>
<body>
${body}
<script type="module">
${js}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(DIST, 'nxair.html'), full);
fs.writeFileSync(path.join(DIST, 'nxair.artifact.html'), fragment);
console.log(`${path.join(DIST, 'nxair.html')}  ${(full.length / 1024).toFixed(0)} KB`);
