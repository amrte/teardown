// The auto tour: an operator's session on the real controls, one step per beat. Each step names the control the
// cursor glides to (a selector in the console, or a function giving a stage point) and what pressing it does,
// through the same act() the visitor's clicks call. It takes the default lineup apart stage by stage, draws a
// withdrawable unit through TEST and DISCONNECTED out of its compartment, opens the whole lineup, reassembles,
// racks the breaker out and back, adds a field and replaces its type, turns the infeed into a 3WL and takes that
// breaker apart, and ends on the glass enclosure.
export const TOUR = [
  {t: 1.8, at: '[data-a="td:step"]', do: (act) => act('td', 'step')},
  {t: 3.9, at: '[data-a="td:step"]', do: (act) => act('td', 'step')},
  {t: 6.0, at: '[data-a="field:1"]', do: (act) => act('field', '1')},
  {t: 7.3, at: '[data-a="view:field"]', do: (act) => act('view', 'field')},
  {t: 8.8, at: '[data-a="mod:2"]', do: (act) => act('mod', '2')},
  {t: 10.1, at: '[data-a="modpos:test"]', do: (act) => act('modpos', 'test')},
  {t: 11.6, at: '[data-a="modpos:disconnected"]', do: (act) => act('modpos', 'disconnected')},
  {t: 13.1, at: '[data-a="modpos:removed"]', do: (act) => act('modpos', 'removed')},
  {t: 15.4, at: (ui) => ui.trackSpot(0.8), do: (act) => act('td', '0.8')},
  {t: 18.6, at: '[data-a="scope"]', do: (act) => act('scope')},
  {t: 20.0, at: '[data-a="view:iso"]', do: (act) => act('view', 'iso')},
  {t: 23.4, at: '[data-a="td:0"]', do: (act) => act('td', '0')},
  {t: 25.6, at: '[data-a="field:0"]', do: (act) => act('field', '0')},
  {t: 26.8, at: '[data-a="mod:1"]', do: (act) => act('mod', '1')},
  {t: 28.0, at: '[data-a="modpos:removed"]', do: (act) => act('modpos', 'removed')},
  {t: 30.4, at: '[data-a="modpos:connected"]', do: (act) => act('modpos', 'connected')},
  {t: 32.2, at: '[data-a="fieldadd:1"]', do: (act) => act('fieldadd', '1')},
  {t: 34.0, at: '[data-a="type:fc"]', do: (act) => act('type', 'fc')},
  // the infeed becomes a 3WL with a COM35: solo, its trip unit menu, a short circuit, QUERY and RESET, racking to TEST
  // with the handle and the crank, the maintenance teardown and back
  {t: 36.0, at: '[data-a="field:0"]', do: (act) => act('field', '0')},
  {t: 37.4, at: '[data-a="opt:acb:3WL12"]', do: (act) => act('opt', 'acb:3WL12')},
  {t: 39.0, at: '[data-a="wlsolo"]', do: (act) => act('wlsolo', '1')},
  {t: 40.6, at: '[data-a="wletu"]', do: (act) => act('wletu')},
  // ETU76B: ESC opens MAIN MENU, ENTER Metering, ENTER Iavg → CURRENT with its bars (OI 8-44, 8-55)
  {t: 42.2, at: (ui) => ui.etuSpot('esc'), do: (act) => act('etuhit', 'esc:1')},
  {t: 43.4, at: (ui) => ui.etuSpot('enter'), do: (act) => act('etuhit', 'enter:1')},
  {t: 44.6, at: (ui) => ui.etuSpot('enter'), do: (act) => act('etuhit', 'enter:1')},
  {t: 46.6, at: (ui) => ui.etuSpot('esc'), do: (act) => act('etuhit', 'esc:1')},
  {t: 47.6, at: (ui) => ui.etuSpot('esc'), do: (act) => act('etuhit', 'esc:1')},
  {t: 48.6, at: (ui) => ui.etuSpot('esc'), do: (act) => act('etuhit', 'esc:1')},
  {t: 49.8, at: '[data-a="wlfault:S"]', do: (act) => act('wlfault', 'S')},
  {t: 52.0, at: (ui) => ui.etuSpot('query'), do: (act) => act('etuhit', 'query:1')},
  {t: 54.0, at: '[data-a="wlproc:reset"]', do: (act) => act('wlproc', 'reset')},
  {t: 57.4, at: '[data-a="wletu"]', do: (act) => act('wletu')},
  {t: 58.6, at: '[data-a="wlproc:to:test"]', do: (act) => act('wlproc', 'to:test')},
  {t: 71.0, at: '[data-a="wlstep:all"]', do: (act) => act('wlstep', 'all')},
  {t: 84.0, at: '[data-a="wlstep:0"]', do: (act) => act('wlstep', '0')},
  {t: 87.0, at: '[data-a="wlsolo"]', do: (act) => act('wlsolo', '0')},
  {t: 88.6, at: '[data-a="layer:enclosure"]', do: (act) => act('layer', 'enclosure')},
];
export const TOUR_LEN = 93;
