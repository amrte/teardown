# Oil Transformer · distribution transformer ≤ 3150 kVA

An interactive model of a liquid-filled ONAN distribution transformer, built from the Rauscher & Stoecklin manual
*Handbuch Flüssigkeitsgefüllte Transformatoren ≤ 3150 kVA, freiatmende und hermetisch geschlossene Ausführung*
(KD_TR_MA_Handbuch_V2_DE). Every value from the manual carries its page (`p.NN`) in the code and on screen; values
the manual does not give are marked **est.** and greyed in the datasheet.

```
node sims/build.mjs transformer-live     # teardown-out/dist/transformer-live.html, offline
node sims/build.mjs transformer-film     # the scripted tour as a pure function of t
```

## Files

| File | Job |
|---|---|
| `trafo.js` | The model: catalogue, options and their rules, the datasheet `spec(cfg)`, electrical state at angle θ, IEC 60076-7 thermal model, seismic check, parallel operation, the manual's parts. No three.js. |
| `protect.js` | Monitoring and protection: the devices (thermometer and contacts, PT100, level indicator, full protection, relief valve, Buchholz, silica-gel breather, HV/LV fuses), their readings and contacts, the fault scenarios, the fuse coordination. No three.js. |
| `trafo3d.js` | The geometry, built in mm from one `spec`: chassis and turnable rollers, corrugated tank, lid fittings, 3-limb stepped core, LV/HV windings, leads, fluid and convection, oil pans, seismic kit, section faces. |
| `stage.js` | Studio, shadows, GTAO; rebuilds the model when the configuration changes. |
| `console.js` | The 1600 × 900 overlay: load, core flux, vector-group clock, sliders; tabs OPERATE / CONFIG / DATA / PROTECT / WIRING / SERVICE; views, cutaway, subsystems, overlays; the tap changer; part numbers (manual Fig. 6). |
| `film.js` | The 40 s tour script, cameras, the operator's cursor, the per-frame glue shared with the live page. |
| `live.js` | Real-time page: everything clickable, thermal state integrated live, auto tour when idle. |

## Configurations (CONFIGURE tab)

| Option | Values | Manual |
|---|---|---|
| Rating | 100, 160, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150 kVA | p.12 |
| HV | 6, 10, 16, 20, 30 kV, switchable 10/20 kV (second knob, level I/II) | p.12, 37, 50 |
| Vector group | Dyn5, Dyn11, Yzn5, Yzn11 (Yzn ≤ 400 kVA, est.) | p.47 |
| Tank | free-breathing (2 vents, dipstick), hermetic (filler, deeper waves), conservator (silica-gel breather) | p.12, 30, 37, 39 |
| Active part | standard CRGO, low-radiation (8 point-symmetric LV bushings, 1 µT table), amorphous AMDT (P0 −47 %) | p.13–15, 20–21 |
| Tap changer | off-circuit ±2×2.5 % (5 positions), MR ECOTAP VPD on-load (9 positions, ≤ 825 V/step) | p.18–19, 37 |
| Fluid | mineral, synthetic ester (MIDEL 7131), natural ester (FR3) | p.16–17 |
| HV bushings | plug-in outer cone EN 50180, porcelain EN 50180 | p.36 |
| LV terminals | studs EN 50386, with connection flags | p.36, 39 |
| Monitoring | thermometer (drag pointer), contact thermometer 85/95 °C, PT100, level indicator, full protection (hermetic), Buchholz (conservator) | p.38–39, 43 |
| Oil pan | none, integrated (+150 mm), aluminium STANDARD (rails), aluminium EASY | p.23–27, 38 |
| Harmonics | standard, earthed screen + reinforced insulation (35 dB, B ≤ 1.6 T) | p.54–56 |
| Mounting | rollers, wheel locks, Vibrastop, earthquake kit | p.27, 35, 39 |
| Parallel | none, identical unit, next size down (load sharing, admissibility) | p.47–49 |
| Site | SIA 261 zone Z1…Z3b (soil C, BWK II) for the seismic check | p.32–34 |

Rules from the manual are enforced when you click: natural ester only hermetic (p.17); ECOTAP only 400–1000 kVA,
hermetic, single HV, plug-in bushings (p.18–19); full protection only hermetic, Buchholz only with a conservator
(p.38–39); earthquake anchoring only with the integrated pan (p.35).

## What is computed

- **Ratings**: currents, uk (manual's fuse table where given), short-circuit current, P0/Pk (EU 548/2014 Tier 2
  limits; 630 kVA from p.21), voltage drop, LV voltage from grid voltage and tap position, efficiency curve.
- **Thermal** (IEC 60076-7, ONAN, τo 180 min, τw 4 min, rises 65 K / 60 K from p.12): top oil, hot spot, drag
  pointer, Montsinger ageing (×2 per 6 K, p.52), permissible continuous load (reproduces the manual's 110/100/90/80 %
  at 10/20/30/40 °C, p.53), oil expansion (1 cm ≈ 10 K, p.41), alarm 85 °C / trip 95 °C.
- **Electrical at θ**: limb fluxes (lag U by 90°), LV/HV currents, the vector-group phase shift.
- **Installation**: HV HRC / LV NH fuses (p.50, else the ≈ 2 In rule of p.49), LV stud torques (p.47), oil pan code
  (p.24–26), ventilation A = 0.188 P/√H (p.44), lashing forces (p.40), 1 µT distances (p.15), seismic slenderness,
  Se, roller forces FD/FA/FQ and the flowchart verdict (p.32–34), parallel load sharing (p.49).
- **Service**: the 5 safety rules, commissioning, maintenance plan, Buchholz test contacts (p.43), transport.

## Monitoring and protection (PROTECT tab)

Every device shows its reading and contact states live; devices the configuration does not carry are listed as
"not fitted". Six faults can be injected: overload, blocked cooling, oil leak, slow gassing, an arc between turns, a
short at the LV terminals. Each device answers as its principle says: the thermometer contacts at 85 / 95 °C, the
level indicator at MIN, the Buchholz gas alarm (NO 3–4) and surge trip (NO 1–2), the full protection's gas, level and
pressure contacts, the relief valve, the HV fuse. A trip de-energises the unit until RESET (p.54: never re-energise
before the cause is clarified). Where nothing can see a fault (slow gassing in a free-breathing unit, a low level
without a level indicator) the log says so. In 3D: gas bubbles and an arc flash in the winding, gas collecting in the
Buchholz and full-protection windows, the relief valve lifting, the silica gel turning light yellow, oil dripping from
the drain valve into a puddle.

The fuse chart plots the HV fuse and the LV fuse (referred to the HV side) against the transformer's rated current,
the inrush band (6–20 In at 100 ms, p.49) and the LV short circuit, and checks that the inrush passes, the short is
cleared and the LV fuse goes first.

The WIRING tab draws only what a published source prints:

- the Buchholz relay's terminal plate as photographed in the manual (p.43): insulators 6 3 4 (alarm) and 5 1 2 (trip),
  NC 3–6 / NO 3–4 and NC 1–5 / NO 1–2, the contacts moving through the test sequence or a real fault;
- the dial thermometer as R&S lists it in KD-00215: stainless steel, IP 54, 0–100 °C, class 1.5, G1, art. 17073 (drag
  pointer, standard from 400 kVA) and 17074 (with 2 microswitches), contacts ≤ 250 V AC/DC (manual p.41), their live
  state; R&S publishes no terminal numbers, so none are drawn;
- the PT100 in 2-, 3- and 4-wire connection with the EN/IEC 60751 lead colours (red / white; red-red-white;
  red-red-white-white) as printed in WIKA data sheet TE 60.13 (03/2021) p.4; R&S does not name its PT100 maker;
- the order codes of every monitoring device from KD-00053 (T1–T6, A1–A5, F, X, B, L, V "R.I.S", P "DGPT", D1/D2).

R&S names no maker and publishes no terminal plan for the level indicator, the monitoring devices R.I.S / DGPT or the
relief valve, so the tab says so instead of drawing one. Sources:

- Manual: https://the-rsgroup.com/wp-content/uploads/2023/09/rauscher-stoecklin-handbuch-oel-transformatoren-de.pdf
- KD-00215 Zubehör (1/2018): https://the-rsgroup.com/wp-content/uploads/2020/02/Distribution-transformers_Technical-data_Accessories_DE.pdf
- KD-00053 Ordercode (v1.0.1): https://the-rsgroup.com/wp-content/uploads/2020/04/KD-00053_Trafo-Ordercode_de.pdf
- WIKA TE 60.13: https://www.wika.com/media/Data-sheets/Temperature/Resistance-thermometers/ds_te6013_en_co.pdf

The manual names none of the device makers and gives no setpoints for gas volume, oil surge, pressure, relief valve or
level MIN, no PT100 characteristic and no fuse curves. Those are typical values marked **est.** (PT100 to IEC 60751;
fuse curves are a generic shape, to be replaced by the fuse maker's curves).

## Estimates (not in the manual)

Tank and core dimensions, masses, fluid volume, wave depth, uk for 315/500/800/≥1250 kVA,
losses other than the 630 kVA example, SIA 261 coefficients, the ECOTAP step of 2.5 %. They scale from typical
catalogue proportions so the model is complete; confirm against the datasheet of a real unit.
