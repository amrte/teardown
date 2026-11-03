// The 128 x 64 monochrome screen: the status page, the main and Tune menus, the halt screen. Drawn pixel by pixel in
// a 5 x 7 bitmap font (6 px cells, 21 characters a row), the way the real glass draws it. The same pixels go on the 3D
// screen (a CanvasTexture) and in the UI panel.
const W = 128;
const H = 64;
export const LCD = {bg: '#c9d2b6', ink: '#1f2a1c'};

// 5 x 7 glyphs, one string per row
const G = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.', C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.', E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#', I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..', K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#', O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....', Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..', U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..', W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', 1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.', 2: '.###.|#...#|....#|...#.|..#..|.#...|#####',
  3: '####.|....#|....#|.###.|....#|....#|####.', 4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.',
  6: '..##.|.#...|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|.#...|.#...|.#...', 8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  9: '.###.|#...#|#...#|.####|....#|...#.|.##..',
  ' ': '.....|.....|.....|.....|.....|.....|.....', '.': '.....|.....|.....|.....|.....|.##..|.##..', ':': '.....|.##..|.##..|.....|.##..|.##..|.....',
  '/': '....#|...#.|...#.|..#..|.#...|.#...|#....', '%': '##..#|##..#|...#.|..#..|.#...|#..##|#..##', '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  '-': '.....|.....|.....|#####|.....|.....|.....', '+': '.....|..#..|..#..|#####|..#..|..#..|.....', '°': '.##..|#..#.|.##..|.....|.....|.....|.....',
  '<': '...#.|..#..|.#...|#....|.#...|..#..|...#.', '>': '.#...|..#..|...#.|....#|...#.|..#..|.#...', '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..',
  '_': '.....|.....|.....|.....|.....|.....|#####', ',': '.....|.....|.....|.....|.##..|..#..|.#...',
};
const GLYPH = Object.fromEntries(Object.entries(G).map(([k, v]) => [k, v.split('|')]));

export function createScreen(target) {
  const out = target.getContext('2d');
  const img = out.createImageData(W, H);
  const px = new Uint8Array(W * H);
  const bg = [0xc9, 0xd2, 0xb6];
  const ink = [0x1f, 0x2a, 0x1c];
  let last = '';
  const set = (x, y, v) => {
    if (x >= 0 && x < W && y >= 0 && y < H) px[y * W + x] = v;
  };
  const fill = (x, y, w, h, v = 1) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, v);
  };
  const frame = (x, y, w, h) => {
    fill(x, y, w, 1);
    fill(x, y + h - 1, w, 1);
    fill(x, y, 1, h);
    fill(x + w - 1, y, 1, h);
  };
  /** text at (x, y) = the glyphs' top-left; v 1 ink, 0 clear (on an inverted bar) */
  const txt = (s, x, y, v = 1) => {
    let cx = x;
    for (const ch of String(s).toUpperCase()) {
      const g = GLYPH[ch] ?? GLYPH['?'];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '#') set(cx + c, y + r, v);
      cx += 6;
    }
  };
  const right = (s, xr, y, v = 1) => txt(s, xr - String(s).length * 6 + 1, y, v);
  const r3 = (v) => String(Math.round(v)).padStart(3, ' ');
  /** d: {ui, T, tgt, bedT, bedTgt, fan, pos:[x,y,z], homed:[bx,by,bz], prog, elapsed, blink}; returns true if redrawn */
  return (d) => {
    const ui = d.ui;
    const key = JSON.stringify([ui.screen, ui.idx, ui.msg, Math.round(d.T), d.tgt, Math.round(d.bedT), d.bedTgt, Math.round(d.fan * 100), d.pos.map((v) => v.toFixed(1)), d.homed, Math.floor(d.prog * 100), Math.floor(d.elapsed), d.blink]);
    if (key === last) return false;
    last = key;
    px.fill(0);
    if (ui.screen === 'error') {
      fill(0, 0, W, 11);
      txt(ui.msg, 3, 2, 0);
      txt('PRINTER HALTED', 3, 18);
      txt('PLEASE RESET', 3, 30);
      fill(0, 41, W, 1);
      txt('HEATERS OFF', 3, 46);
      txt('MOTORS OFF', 3, 55);
    } else if (ui.screen === 'status') {
      // hotend and bed: E 205/210°  B 41/60°
      txt(`E${r3(d.T)}/${r3(d.tgt)}°`, 1, 1);
      right(`B${r3(d.bedT)}/${String(d.bedTgt).padStart(2, ' ')}°`, 126, 1);
      txt(`FAN${String(Math.round(d.fan * 100)).padStart(4, ' ')}%`, 1, 11);
      right('FR 100%', 126, 11);
      // positions on an inverted bar; "?" blinks on an axis not yet homed
      fill(0, 20, W, 10);
      const f = (i, n) => (d.homed[i] ? d.pos[i].toFixed(n) : d.blink ? '?' : ' ');
      txt(`X${f(0, 1).padStart(5, ' ')}`, 1, 21, 0);
      txt(`Y${f(1, 1).padStart(5, ' ')}`, 44, 21, 0);
      right(`Z${f(2, 2).padStart(5, ' ')}`, 126, 21, 0);
      frame(1, 34, 88, 7);
      fill(3, 36, Math.round(84 * d.prog), 3);
      const e = Math.floor(d.elapsed);
      right(`${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`, 126, 34);
      fill(0, 45, W, 1);
      txt(ui.msg.slice(0, 21), 1, 50);
    } else {
      fill(0, 0, W, 10);
      txt(ui.screen === 'main' ? 'MAIN' : 'TUNE', 3, 1, 0);
      const vals = {Speed: '100%', Flow: '100%', Nozzle: `${d.tgt}`, Bed: `${d.bedTgt}`, Fan: `${Math.round(d.fan * 100)}%`};
      const first = Math.max(0, Math.min(ui.items.length - 5, ui.idx - 2));
      for (let k = 0; k < 5 && first + k < ui.items.length; k++) {
        const i = first + k;
        const y = 12 + k * 10;
        const sel = i === ui.idx;
        if (sel) fill(0, y, W, 10);
        const name = ui.items[i];
        txt(name === 'Back' ? '< BACK' : name, 3, y + 2, sel ? 0 : 1);
        if (vals[name]) right(vals[name], 125, y + 2, sel ? 0 : 1);
      }
    }
    for (let i = 0; i < W * H; i++) {
      const c = px[i] ? ink : bg;
      img.data[i * 4] = c[0];
      img.data[i * 4 + 1] = c[1];
      img.data[i * 4 + 2] = c[2];
      img.data[i * 4 + 3] = 255;
    }
    out.putImageData(img, 0, 0);
    return true;
  };
}
