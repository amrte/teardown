// Real units from their R&S datasheets. A preset fixes the configuration and replaces the model's estimates with the
// sheet's values: spec() applies `data` over what it would otherwise compute. Values the sheet does not give (Buchholz
// settings, the tank's inner build) stay the model's, still marked est.
export const PRESETS = {
  dso1600: {
    id: 'dso1600',
    code: 'DSO-1600/10.0/0.40-S-NS-NU-CU-CU',
    src: 'R&S offer datasheet DSO-1600/10.0/0.40 (supplied by the customer)',
    cfg: {
      rating: 1600, hv: '10', vector: 'Dyn5', design: 'conservator', core: 'standard', tapchanger: 'offload', fluid: 'mineral',
      hvBushing: 'porcelain', lvFlags: false, monitor: 'buchholz', pan: 'none', screen: false, seismic: 'rollers', parallel: 'none', zone: 'Z1',
      // devices fitted beside the Buchholz: drag-pointer thermometer with 2 contacts, Niveaumeter, breather, terminal box
      devices: ['contacts', 'level', 'buchholz', 'breather', 'terminalbox'],
    },
    data: {
      product: 'DVO (Drehstrom-Verteiltransformator)',
      series: 'ECO++ NU',
      norms: 'SN EN 60076 / SN EN 50588-1',
      site: 'Freiluft (outdoor)',
      medium: 'Isolieröl (mineral oil)',
      tank: 'Spezial',
      cooling: 'ONAN',
      loadClass: 'I (SN EN 50329)',
      lowRadiation: false,
      hvTerm: 'Porzellandurchführungen SN EN 50180',
      lvTerm: 'Porzellandurchführungen SN EN 50386',
      conductor: 'Cu / Cu',
      reinforced: 'Nein / Nein',
      screen: 'Nein',
      paint: 'RAL 7033, grau',
      S: 1600, f: 50,
      // HV 1, the 9 tap voltages; the bold one (position 4) is the rated voltage
      taps: [11000, 10655, 10310, 9965, 9620, 9275, 8930, 8585, 8240],
      ratedPos: 4,
      insHV: {li: 75, ac: 28.0, um: 12},
      un2: 400, i2: 2309,
      insLV: {li: null, ac: 3.0, um: 1.1},
      p0: 1080, p0Ref: 'AA0 · SEV 4104.78',
      pk: 11700, pkRef: 'Ak · 75 °C · SEV 4104.78',
      uk: 6.0, ukTol: '±10 %',
      vector: 'Dyn 5 · neutral 100 % loadable',
      noise: {lpa: 38, lwa: 50, at: '100 cm', norm: 'SN EN 60076-10'},
      altitude: 1000, ambient: 40, rises: [65, 60],
      dims: {l: 1700, b: 1100, h: 2400},
      gauge: 820,
      slenderness: 2,
      oil: {kg: 850, l: 1050},
      mass: {cu: 1080, core: 1490, active: 2880, total: 4400},
      drawing: 'Angebotsmassbild',
      standard: ['Oil drain device', '2 lifting lugs', '2 vents', 'Earth link tank–lid', 'Lashing eyes', '2 earth terminals', 'Rating plate'],
      fitted: ['Drag-pointer thermometer with 2 contacts', 'Cast rollers (turn 90°)', 'Level indicator: Niveaumeter', 'Terminal box', 'Expansion tank left, seen on HV', 'Buchholz protection', 'Dehydrating breather'],
      notFitted: ['Drag-pointer thermometer (no contacts)', 'AKM thermometer', 'PT100 (4-wire)', 'Dipstick', 'Reed level switch', 'Niveaumeter with 2 contacts', 'LV connection flags', 'Earth link 120 mm²', 'Integrated oil pan', '2nd rating plate', 'LV cover', 'CO2-reduced core', 'Expansion tank right', 'Fixing lug set'],
    },
  },
};
export const presetOf = (cfg) => (cfg?.preset && cfg.preset !== 'none' ? PRESETS[cfg.preset] : null);
