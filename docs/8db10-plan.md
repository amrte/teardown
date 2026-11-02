# Plan: Siemens 8DB10 double-busbar GIS panel as a teardown simulator

Goal: a 4th machine next to `v8-*`, `cessna-*`, `strandbeest-*`. One 8DB10 circuit-breaker feeder panel, built from code
in metres, that switches the way the real one does. The visitor transfers the feeder between busbars, trips a 40 kA
fault, and earths the cable. Every gauge and the single-line diagram read from the same function that poses the
contacts.

Following SKILL.md, the order is: reference first, then numbers, then one input, then geometry. Every number below
comes from **Siemens catalog HA 35.11 · 2025** ("8DA10 and 8DB10 up to 40.5 kV, gas-insulated"), with page numbers.
Anything the catalog does not give is marked **TBD** and has a named source to get it from.

---

## 1. What the reference says

### 1.1 Ratings (IEC, max values, p. 5)

| | |
|---|---|
| Rated voltage | 12 / 24 / 36 / **40.5 kV**. Model the 40.5 kV version. |
| Power-frequency withstand / lightning impulse | 85 kV / 185 kV |
| Frequency | 50 / 60 Hz |
| Short-circuit breaking current | 40 kA. Short-time withstand is 40 kA for 3 s; peak withstand and making current are 100 / 104 kA. |
| Continuous current | Busbar 5000 A. Feeder 3150 A, which needs forced ventilation. |
| Classification (p. 15) | PM, LSC2A. IAC AFL 40 kA 1 s for wall-standing, AFLR for free-standing. |

### 1.2 Panel envelope (p. 20, "Circuit-breaker panel up to 3150 A")

- Width (panel spacing) **600 mm**, height **2350 mm**, depth **2665 mm**. The low-voltage compartment at the top front is **850 mm** high.
- Side-view chain from the rear: **275 + 5 × 360** mm to the front-most busbar vessel. That leaves **590 mm** for the operating front. 275 + 1800 + 590 = 2665 ✓.
- Floor plan: base frame **2185 mm** long with 80 mm ends, and fixing holes 26 × 45 mm. There are 3 round floor openings for the HV cables (one per pole) and a 320 × 320 mm control-cable area at the front.
- Weight: about **1200 kg** for one panel without packing (p. 14, transport table).

### 1.3 Construction (pp. 24–25)

- **Single-pole enclosure.** Each phase has its own hermetically bolted housing of corrosion-resistant **aluminium alloy**, with IP65 for the HV parts.
- **Poles stand one behind the other along the depth.** L1 is at the front and L3 at the rear.
- Each pole has, from top to bottom:
  - A **busbar vessel for system 1** (manometers B11/B12/B13).
  - A **busbar vessel for system 2**, offset **360 mm** further back (B21/B22/B23). Front to rear, the busbar vessels therefore read **1, 4, 2, 5, 3, 6**, and the feeder poles sit at **720 mm** pitch.
  - Below the BB1 vessel, the **three-position disconnector** for busbar 1 (gas compartment B1, shared by L1–L3).
  - Beside it, the **disconnector for busbar 2** (B2).
  - The **vacuum circuit-breaker** vessel (B0, shared by L1–L3).
  - Below the base frame, the **panel connection housing** with **inside-cone** sockets to EN 50181, plug sizes 2/3/4.
- The busbars run **across** the 600 mm width through T/cross-shaped vessels into the next panel.
- **Bushings:** gas-tight bushings (drawn red-brown) separate the compartments. Some bushings are pervious to gas; the p. 25 scheme shows which are which.
- **Current transformers** (p. 30) are inductive ring cores (4MC4, cast resin) **outside the gas**:
  - Feeder CT around the cable connection (C/D).
  - Optional CT between the CB and the disconnector (A).
  - Busbar CT (E).
- **Voltage transformers** (p. 31) plug in: 4MT7 on the panel connection housing, or 4MU3 on the busbar.
- **Panel connection height h** for double busbar (p. 33): 108 mm for cable plugs (version 5) and 40 mm for a solid-insulated bar (version 6).
- **Operating front** (pp. 24–25):
  1. LV compartment
  2. Protection relay
  3. Disconnector mechanism with interlock and position indicators
  4. Manometers
  5. CB operating mechanism 3AH49
  6. Capacitive voltage detecting system

### 1.4 Switching devices (pp. 26–29)

**Vacuum circuit-breaker**
- The interrupter sits inside the gas-filled housing. A metal bellows separates the vacuum from the SF₆.
- The mechanism is a motor-charged stored-energy spring mechanism, 3AH49, mounted outside the enclosure behind the control board. It is rated for 10,000 operating cycles (30,000 optional).
- Front fittings: ON and OFF buttons, an operations counter, a position indicator, and a "spring charged" indicator.
- Timing:

| | |
|---|---|
| Closing | < 95 ms |
| Opening | < 65 ms |
| Arcing | < 15 ms at 50 Hz, < 12 ms at 60 Hz |
| Break time | < 80 ms |
| Dead time | 300 ms |
| Spring charging | < 15 s |

- Operating sequence: **O – 0.3 s – CO – 3 min – CO**, or 15 s instead of 3 min for auto-reclosing.

**Three-position disconnector**
- Positions are **CLOSED / OPEN / READY-TO-EARTH**. **EARTHED** is reached by closing the CB while the disconnector is in ready-to-earth, which makes the earthing make-proof through the CB.
- The contact blades rotate about the same centre as the operating shaft. There are separate shafts for DISCONNECTING, EARTHING and READY-TO-EARTH.
- Endurance: 2000 operations for disconnecting, 1000 for earthing.

**Interlocks** (p. 29)
- A control gate must pre-select a shaft before that shaft is released.
- The operating lever cannot be removed until the switching operation is finished.
- The CB cannot close until the gate is back in neutral.
- While the disconnector is being operated, the CB cannot be operated.

**Mimic diagram** (p. 29)
- Five states are drawn: Feeder OPEN, BB1 CLOSED, BB2 CLOSED, READY-TO-EARTH, EARTHED.
- The live path is drawn in red.
- Device names: Q1 is the BB1 three-position disconnector, Q2 the BB2 disconnector, Q0 the CB.

### 1.5 Gas (p. 25)

- SF₆, with a rated functional level (relative, 20 °C) of **70 kPa or 120 kPa** depending on ratings, and leakage **< 0.1 %/year**.
- It is a sealed system: no refilling over the service life.
- Each compartment has a mechanical manometer on the front, readable without auxiliary power, with a filling valve beside it. A digital option exists.

### 1.6 Not in the catalog (fill before modelling)

| Missing | Where to get it |
|---|---|
| Vacuum interrupter contact stroke and travel curve | Siemens catalog HG 11.04 "3AH4 vacuum circuit-breakers" (p. 27 refers to it) |
| Disconnector blade angles for the 3 positions | 8DB10 operating manual 864-50919, the "three-position disconnector" chapter |
| Manometer alarm and minimum functional pressures | Same manual, "gas pressure monitoring" |
| Vessel diameters, flange sizes, vertical levels | Measure the p. 20 drawing (§ 3, step 1) |

Neither PDF can go through the web-fetch tool because they are over its size limit. Download them with `curl` into a
scratch folder and use `pdftotext` / `pdftoppm`, the same way the catalog was read. Do **not** commit Siemens PDFs or
page renders to the repo: link to them only.

---

## 2. The model in one function

SKILL.md rule 3 says one input drives everything. Here the input is the **procedure clock** `t`, in seconds, running
through a scripted switching program. Each device's pose is a pure function of `t`, built from the device timings
above.

`sims/8db10-shared/gis.js` contains the math and no three.js. It provides the following.

- **Constants:** every number from § 1, in SI units, each with its catalog page in a comment.
- **Device states:**
  - `q1(t)` is the BB1 three-position disconnector, ∈ {closed, open, readyToEarth}.
  - `q2(t)` is the BB2 disconnector, ∈ {closed, open}.
  - `q0(t)` is the CB, ∈ {open, closed}.
  - `spring(t)` is the closing-spring charge, 0..1.
- **Device kinematics:** `bladeAngle(q, τ)` for the disconnectors, `ciTravel(τ)` for the vacuum-interrupter contact travel, and `springCharge(τ)`.
  - Close: about 95 ms.
  - Open: contact separation at about 30–40 ms after the trip command, full stroke by 65 ms.
  - Charge: a 15 s motor run, time-compressed in the film and labelled as compressed.
- **Interlock state machine:** `allowed(state, action)` returns `{ok, reason}`, implementing the p. 29 rules. The live page uses it to refuse illegal buttons with the reason ("CB closed: disconnector locked"). The film only ever runs legal sequences.
- **Fault current:** `i(t) = √2·Ik·(sin(ωt+φ) − sin φ·e^(−t/τ))`, with Ik = 40 kA, 50 Hz and X/R ≈ 14 (τ = 45 ms, the IEC default).
  - The arc burns from contact separation to the **first current zero after a minimum arcing time**.
  - Check that arcing ≤ 15 ms and break time ≤ 80 ms for every fault phase angle. This is a unit test (the "check one by hand" rule).
- **Energised path:** `path(state)` returns which conductors are live: BB1, BB2, feeder, cable, or earthed. It drives both the red accent on the 3D conductors and the single-line diagram, so they cannot disagree.
- **Gas:** each of the 9 compartments (B11–B13, B21–B23, B1, B2, B0) has a density, with the manometer reading temperature-compensated to 20 °C. The live page has an optional "leak" slider on one compartment that crosses the alarm levels (once those are known from the manual).

## 3. Build steps

Each step ends with a check you can read in a still.

1. **Measure the drawing.**
   - Render catalog p. 20 and p. 25 at 300 dpi into the scratchpad.
   - Write a small script that turns pixels into mm, using 2350 mm (height) and 2665 mm (depth) as the scale bars.
   - Read off the vessel centre heights, vessel and flange diameters, the base-frame height, the CB vessel position, and the cable-socket depth.
   - First rough reads from the 110 dpi render, ±50 mm:
     - Busbar vessel centres ≈ 1.91 m
     - Disconnector level ≈ 1.52 m
     - CB vessel ≈ 0.74–1.18 m
     - Base-frame top ≈ 0.69 m
   - Busbar vessels nearly touch at 360 mm pitch, so their OD is about 300 mm.
   - Write all of these into `gis.js` as the parameter block.
2. **`gis.js` + tests.** Constants, device kinematics, interlock machine, fault current, energised path. Add a node script, `sims/8db10-shared/check.mjs`, that asserts:
   - 275 + 5·360 + 590 = 2665
   - arcing ≤ 15 ms and break ≤ 80 ms over 0–360° of fault angle
   - every film step passes `allowed()`
3. **`panel.js`: geometry, all procedural** so the page stays under 1 MB.
   - **Vessels:** `LatheGeometry` bodies plus flange rings for the cast aluminium T and cross pieces. Use the material rule from SKILL.md: roughness ≥ 0.45 and envMapIntensity ≈ 0.5.
   - **Bushings:** red-brown epoxy discs between compartments, matching the catalog's colour key for gas-tight versus pervious.
   - **Busbars:** copper bars crossing the width, continuing as stubs into ghosted neighbour panels.
   - **Three-position disconnector:** rotating blades on a shared shaft, plus the BB2 disconnector.
   - **Vacuum interrupters:** ceramic body, bellows and moving contact, in the CB vessel.
   - **Below the frame:** CT ring cores (cream cast resin), inside-cone sockets, cable plugs and cables leaving through the floor.
   - **Steel:** galvanised base frame, light-grey (RAL 7035) sheet-steel front, LV compartment and side covers.
   - **Front face:** a `CanvasTexture` with the mimic diagram from p. 29, 9 manometers, ON/OFF buttons, an operations counter, the spring indicator and the voltage-detection sockets. It is redrawn from `gis.js` state.
   - `update(state)` poses the blades, contacts, spring and needles.
   - **Check:** the side view against p. 20, and the open-side photo against p. 25.
4. **`stage.js`.** Copy from `cessna-shared/stage.js`: light studio, GTAO, bloom.
   - Add clipping planes for a **section cut** through one pole (the p. 25 "arrangement of gas compartments" view). Remember the trap: put the same planes on `gtao.normalMaterial`.
   - Add a **gas-compartment mode** that tints the 9 compartments in pale distinct tones, with the accent kept for the live path.
5. **`console.js`.** Panels on the 1600 × 900 layout:
   - **Single-line diagram** with Q1/Q2/Q0 and the live path in the accent colour (the p. 29 mimic).
   - **CB chart:** contact travel, fault current, the arc window, current zero and the break-time marker, synced to `t`.
   - **Gas board:** 9 manometers in kPa.
   - **Ratings strip:** 40.5 kV · 40 kA · 3150 / 5000 A · 185 kV BIL.
   - **Spring charge** and the operations counter.
   - **Interlock line:** control-gate position and the last refusal.
6. **`film.js` + `8db10-film/timeline.json`.** The SCRIPT is about 30 s:
   1. Frame 0: a 3/4 front view of the panel with neighbours, energised on BB1. This is the thumbnail.
   2. The side cover dissolves and the camera swings to the side section, matching p. 20 and p. 25. Labels name BB1/BB2, Q1, Q2, the CB, the CTs and the cable.
   3. Gas-compartment mode: the 9 compartments with their manometers.
   4. **Busbar transfer**: CB open, Q1 open, Q2 close, CB close. The red path moves from BB1 to BB2 on the 3D model and on the single-line diagram.
   5. **40 kA fault**: the camera goes inside the CB vessel (an x-ray of the vacuum interrupters). The contacts part, the arc burns to the current zero, and the chart shows it is interrupted within 80 ms. Then the O – 0.3 s – CO auto-reclose.
   6. **Earthing**: CB open, Q2 open, Q1 to READY-TO-EARTH, CB close, giving EARTHED. The voltage-detection indicators go dark first.
   7. Pull back to the line-up and hand over.
7. **`live.js` + `8db10-live/main.js`.** Copy the Cessna live loop, including TIERS, cursor tour and the 25 s hand-back.
   - Buttons: Q1, Q2, CB ON/OFF, charge spring, inject fault, earth feeder.
   - Every button goes through `allowed()`. A refused click shakes the button and prints the reason in the interlock line.
   - View buttons: front, side section, gas, inside CB, busbar run.
8. **`score.py`.** Use `score_kit` and read only from `timeline.json`:
   - A latch clack plus a soft thud on each CB close or open.
   - A short motor whirr for spring charging.
   - A low ratchet for each disconnector turn.
   - A dry crack at the fault interruption.
   - A quiet chord bed.
9. **Review loop** as in SKILL.md: `--stills beats`, the checklist, fix, repeat. Then render the mp4, mix the score and read `sheet.mjs`.

## 4. Decisions, with the default I'd take

- **Scope:** one hero panel with two low-detail neighbours (instanced), so the busbars visibly run through. A full line-up costs frame rate for little gain.
- **Gas:** SF₆, as in the catalog. 8DAB 24 blue GIS (clean air, up to 24 kV) is a different product with a different interior and would be its own machine.
- **Feeder connection:** cables on inside-cone plugs, version 5, h = 108 mm, which is more common than the solid-insulated bar.
- **No Siemens branding** in the model or page. Name it "8DB10-type double-busbar GIS" and credit the catalog as the reference.

## 5. Files

```
sims/8db10-shared/gis.js       math, parameters, interlocks, fault current (no three.js)
sims/8db10-shared/check.mjs    hand checks from § 3 step 2
sims/8db10-shared/panel.js     geometry + update(state)
sims/8db10-shared/stage.js     studio, section cut, compartment tint
sims/8db10-shared/console.js   SLD, CB chart, manometers, interlock line
sims/8db10-shared/film.js      SCRIPT, render(t)
sims/8db10-shared/live.js      interactive page + auto tour
sims/8db10-shared/score.py     sound on the timeline
sims/8db10-film/main.js, timeline.json
sims/8db10-live/main.js
```

Build: `node sims/build.mjs 8db10-live`, and `node sims/capture.mjs 8db10-film ...` for review sheets and video.

## References

- Siemens, *Medium-Voltage Switchgear Types 8DA10 and 8DB10 up to 40.5 kV, Gas-Insulated*, catalog HA 35.11 · 2025: https://assets.new.siemens.com/siemens/assets/api/uuid:4ce4e83b-b7f9-4e23-be88-cfb220e7a0d6/Catalog-8DA10-8DB10-HA-35-11-EN_original.pdf
- Siemens, 8DB10 installation and operating instructions 864-50919: https://assets.new.siemens.com/siemens/assets/api/uuid:4c7c8333-2cc4-4d84-8491-c847cc84fb59/864-50919-en-26-02-16.pdf
- Siemens catalog HG 11.04, 3AH4 vacuum circuit-breakers (for the interrupter stroke and travel curve)
