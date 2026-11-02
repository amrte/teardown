# SIQuench 3AM4 teardown

An interactive 3D teardown of the Siemens **SIQuench® Core 3AM4**, an active arc quenching device for 12-24 kV switchgear. It earths all three phases within about 4 ms of an internal arc, so the arc dies before the pressure peak. The page shows the whole trip in slow motion, then the recharge with the charging tool (Spannwerkzeug).

```
node sims/build.mjs siquench-live     # teardown-out/dist/siquench-live.html, offline, ~840 KB
node sims/build.mjs siquench-film     # the 45 s recorded tour (render(t) contract)
```

![SIQuench 3AM4 teardown](siquench.gif)

**Sources:** the *Montage- und Betriebsanleitung* 9229 0100 100 (version 0C, 06/2026) and the SIQuench brochure (2026). This explainer is independent and is not a Siemens publication. The outer shape is built to the manual's dimension drawings (Abb. 9-12). Siemens does not publish drawings of the internal mechanism, so the internals are a schematic reading of the manual's photos (Abb. 23, 39) and its text. Every number on screen is tagged as either **sourced** (read off the documents) or **modelled** (chosen so the parts move plausibly). The tables below say which is which.

## How it works in one paragraph

Light sensors in the switchgear see the arc, and an arc flash relay signals the SIQuench controller. The controller fires a solenoid in each pole. Each plunger knocks a latch tongue off a crosshead, and a charged disc spring stack drives the crosshead forward. The crosshead carries a copper contact rod through insulating oil onto the fixed contact behind the high-voltage terminal. The moving contact is at earth through the copper earthing plate. Once all three poles close, the three phases are bolted together and to earth. The fault current takes that low-impedance metal path, and the arc has nothing left to burn on. The upstream circuit breaker, tripped by the same relay, clears the bolted fault tens of milliseconds later. To make the device ready again, an operator screws the charging tool into each pole's actuation opening. Turning it draws the spring stack back until the tongue drops in front of the crosshead again.

## The moving parts

| Part | What moves it | What it does | Numbers |
|---|---|---|---|
| **Solenoid coil and plunger** (one per pole) | Controller output, after the arc flash relay picks up | The plunger drops onto the tongue's tail | Coil to strike 0.65 ms *(modelled)* |
| **Latch tongue** (*Zunge*) | The plunger, about a pivot pin | Lifts its hook off the crosshead's lip and frees the spring | Clear in 0.2 ms *(modelled)*. Sliding surfaces greased with Isoflex Topas L32 *(sourced, manual 12.1.3)* |
| **Disc spring stack** | Stored energy, charged by the tool | Drives the crosshead and contact rod forward | 20 discs Ø80/41 × 3.5 mm, k = 660 kN/m, 13.0 kN charged, 1.1 kN on the closed contact, 127 J released *(modelled)* |
| **Helical springs on the guide rods** (*Federn*) | Compressed with the stack | Guide the crosshead and add to the drive | Shown in the manual's photo Abb. 39 *(sourced)*. Rate *(modelled)* |
| **Crosshead** | The disc stack | Joins the charging spindle (lower axis) to the contact rod (pole axis) and carries the lip the tongue holds | Axis offset 37 mm: the actuation openings sit 114 mm above the floor, the pole axis 151.2 mm *(sourced, Abb. 9, 11)* |
| **Moving contact** (copper rod, silvered tip) | The crosshead | Crosses the oil gap onto the fixed contact and earths the phase | Travel 18 mm in 2.0 ms, 14.6 m/s at touch *(modelled)*: x(t) = A(1 − cos ωt), A = 19.7 mm, ω = 742 rad/s |
| **Sliding contact** | Fixed | Keeps the moving rod at earth through the copper plate | |
| **Fixed contact** (tulip) | Fixed, behind the HV terminal | Receives the moving contact | Terminal Ø55, 4 × M8, 12-20 mm thread engagement, 20 Nm *(sourced)* |
| **Position switches S1 / S2** | A flag on the crosshead | Report contact position and charged state, which is the controller's *Quencher Ready* | Wiring per the manual's circuit diagram (S1 21-22, S2 13-14) *(sourced)* |
| **Oil-leak switch S3** | Oil volume | Reports oil loss | *(sourced, function only)* |
| **Charging spindle** | The tool's thread | Draws the crosshead back, compresses the stack and reopens the contact | Pitch 2.5 mm, 2 free turns then 7.2 loaded turns *(modelled)* |
| **Spannwerkzeug** (charging tool, 3AX6210-1A) | The operator, with an SW24 spanner | Screwed clockwise into the actuation opening to the stop, then back out | Max 100 Nm at the stop. Torque is low at first, then rises steeply. While the tool is seated, the mechanical interlock is active *(sourced, manual 11.2)*. Torque curve shape *(modelled)* |

## The trip, millisecond by millisecond

At the default 1.0 ms detection. The detection slider on the page moves it between 0.6 and 1.5 ms, the brochure's range.

| t after ignition | Event | Source |
|---|---|---|
| 0 | Arc strikes phase to phase in the cable compartment | |
| 1.00 ms | Light sensor → arc flash relay → controller | brochure: 0.6-1.5 ms |
| 1.15 ms | Controller fires the three coils | modelled |
| 1.80 ms | Plungers strike the tongues | modelled |
| 2.00 ms | Tongues clear, springs released | modelled |
| 4.00 ms | Contacts touch: 3-phase metallic short to earth | brochure: earthing ~3 ms, arc out < ~4 ms from detection, ≤ 5 ms from ignition |
| ~4.6 ms | Arc current has moved into the metal path | modelled: time constant 0.12 ms |
| ~56 ms | Upstream circuit breaker clears the bolted fault | typical MV breaker, modelled |

## What the panels compute

- **Fault current:** 31.5 kA rms with full DC offset and X/R 17, so the first peak of L1 is 81.7 kA. The brochure's test current is 80 kA peak / 31.5 kA rms. The arc carries the current until the contacts close, then it decays into the earth path.
- **Compartment pressure:** one equation for both curves: dp/dt = k·Σ|i| − p/7 ms, with a relief flap that opens at 135 kPa and vents 70 % of the arc's heat. It is fitted to the brochure's sample. Without SIQuench it peaks at 144 kPa at 9.9 ms (brochure: about 140 kPa at about 10 ms). With SIQuench it peaks at 43 kPa at 4.2 ms (brochure: about 45 kPa).
- **Arc I²t (L1):** 0.85 kA²s with SIQuench, against 105 kA²s if the arc burns until the breaker clears. That is 0.8 %.
- **Controller LEDs:** the rows *Tripped*, *Quencher Ready* and *Trip Output* (Unblocked / Blocked), and the general *Error / Diagnosis / Ready*. They follow the manual's Abb. 30-38 step by step: all red after a trip with Diagnosis blinking, Trip Output blocked while a tool is seated, each phase green when its pole latches, and Unblocked again once the tool is out.
- **Duty:** 5 operations at the full rated short-time current and 30 mechanical operations *(sourced)*.

## Device data shown

3AM4143-1DA12-0AB2: Ur 24 kV, Up 125 kV, Ud 50 kV, Ik 31.5 kA, tk 3 s, 50/60 Hz, pole centre distance 210 mm, base plate 740 × 216 mm, pole projection 275 mm, switching part 264.5 mm deep, mass about 60 kg, IEC 62271-102, class E2. Insulating oil Shell Diala S4 ZX-I, housing of cycloaliphatic epoxy. Maintenance-free for 20 years.

## Files

| File | Job |
|---|---|
| `sims/siquench-shared/quench.js` | The numbers: dimensions, timing, the spring drive, fault current, pressure ODE, charging torque, LED logic. No three.js. |
| `sims/siquench-shared/device.js` | The geometry built from code, and `update(state)` that poses it. |
| `sims/siquench-shared/stage.js` | Studio, shadows, GTAO, the camera rig. |
| `sims/siquench-shared/console.js` | The overlay: event clock, trip sequence, poles, torque, controller LEDs, pressure, current, I²t, timeline, toggles, callouts. |
| `sims/siquench-shared/film.js` | The 45 s script: the event clock τ(t), the recharges k(t), views, callouts, the operator's cursor. |
| `sims/siquench-shared/live.js` | The page you drive: strike arc, SIQuench on/off, recharge, slow motion, detection time, scrub, views, display modes, orbit and zoom, and the auto tour. |
| `sims/siquench-shared/score.py` | The sound on the film's timeline. |

## Controls (live page)

**STRIKE ARC** (or `A`) fires a fault. **SIQUENCH ON/OFF** runs the same fault without the quencher, for comparison. **RECHARGE** (or `R`) charges the tripped poles with the tool, L3 first as in the manual. Clicking a red *Tripped* LED charges just that pole. The **slow motion** slider goes from 1/250 to 1/8,000, and **arc detection** from 0.6 to 1.5 ms. Click the **event timeline** to scrub. Views: Hero, Front, Side, Mechanism, Pole section, Latch, Switchgear (keys `1`-`7`). Display: Hood, X-ray, Section, Exploded, Labels, Current. Drag to orbit, scroll to zoom, and `H` hides the overlay. After 25 s of quiet, the auto tour takes over again.
