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
  // the infeed becomes a 3WL with a COM35, is drawn out of its guide frame and comes apart
  {t: 36.0, at: '[data-a="field:0"]', do: (act) => act('field', '0')},
  {t: 37.4, at: '[data-a="opt:acb:3WL12"]', do: (act) => act('opt', 'acb:3WL12')},
  {t: 39.4, at: '[data-a="wlx:1"]', do: (act) => act('wlx', '1')},
  {t: 44.6, at: '[data-a="wlx:0"]', do: (act) => act('wlx', '0')},
  {t: 46.4, at: '[data-a="layer:enclosure"]', do: (act) => act('layer', 'enclosure')},
];
export const TOUR_LEN = 51;
