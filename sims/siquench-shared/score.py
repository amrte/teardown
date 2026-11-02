"""Score for the SIQuench 3AM4 film: a cool bed (Em9 chords, 84 bpm) at one level the whole way; the arc strikes with a
crack and buzzes under the slow motion until the contacts close; a tick when the coils fire, a sharp click when the
plungers knock the tongues, a heavy clack when the contacts land and a chime when the arc is out; a thud when the
breaker clears; during the recharge a ratchet click per turn of the tool, a latch click at the stop and a chime when
all three poles read Quencher Ready. A quiet click on every button the operator presses.

    python run_sfx.py sims/siquench-shared/score.py

Every time comes from siquench-film/timeline.json (the film's tauAt and chargeAt mapped to seconds).
"""

import math
import os

from sfx.score_kit import bang, bed, chords, hz, thud
from sfx.synth import SR, bandnoise, chime, click, pop

TIMELINE = "../siquench-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "siquench-score.wav")
TARGET_LUFS = -14.0
SEED = 29

CHORDS = chords("Em9:E2 B2 D3 F#3 G3/E1", "Cmaj7:C3 E3 G3 B3/C2", "Am9:A2 E3 G3 B3 C4/A1", "B7sus:B2 E3 F#3 A3/B1")
MOTIF = [(0.5, hz("B4")), (1.5, hz("G4")), (2.5, hz("F#4"))]


def buzz(dur, level=1.0):
    """The arc: a 100 Hz rasp (it pulses twice per cycle) over crackling band noise, faded at both ends."""
    n = int(dur * SR)
    hiss = bandnoise(n, lambda k: 2600, q=0.6)
    out = []
    for k in range(n):
        t = k / SR
        rasp = math.tanh(3 * math.sin(2 * math.pi * 100 * t)) * 0.4 + 0.25 * math.sin(2 * math.pi * 300 * t)
        flick = 0.7 + 0.3 * math.sin(2 * math.pi * 7.3 * t) * math.sin(2 * math.pi * 2.1 * t)
        fade = min(1, t / 0.05, (dur - t) / 0.25)
        out.append(level * fade * (rasp * 0.5 + hiss[k] * 1.4 * flick))
    return out


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 84, CHORDS, MOTIF, motif_voice="epiano", kicks=(0, 2.5), snares=(), hats=8, swing=0.0, keys_vel=0.65, keys_lp=3400)
    mix.put_stereo(0, left, right, 0.11)
    mix.put(0, low, 0.11)
    mix.put(0, drums, 0.035)
    # the trip
    mix.put(tl["trip"], bang(0.9, seed=3), 0.16)
    mix.put(tl["trip"], buzz(tl["quenched"] - tl["trip"], 1.0), 0.045)
    mix.put(tl["detect"], pop(1400, 2200, 0.12), 0.05)
    mix.put(tl["coil"], click(900, 0.05), 0.08)
    mix.put(tl["strike"], click(3200, 0.03), 0.1)
    mix.put(tl["release"], pop(500, 260, 0.2), 0.06)
    mix.put(tl["earthed"], thud(70, 0.06, 0.5), 0.2)
    mix.put(tl["earthed"], click(1500, 0.04), 0.12)
    mix.put(tl["quenched"], chime([hz("E5"), hz("B5"), hz("G5")], 1.6, 0.6), 0.05)
    mix.put(tl["cb"], thud(52, 0.08, 0.6), 0.11)
    # the recharges: a ratchet click per turn of the tool, a latch click at the stop
    for t0, wind0, stop, _unwind, _out in (tl["charge_l3"], tl["charge_l1_l2"]):
        mix.put(t0, click(2400, 0.025), 0.055)
        turns = 9.2
        for i in range(1, int(turns) + 1):
            mix.put(wind0 + (stop - wind0) * i / turns, click(1100 + 60 * i, 0.03), 0.035)
        mix.put(stop, click(2600, 0.04), 0.11)
        mix.put(stop, thud(120, 0.03, 0.2), 0.08)
    mix.put(tl["charge_l1_l2"][-1], chime([hz("B4"), hz("E5"), hz("G5"), hz("B5")], 2.0, 0.7), 0.05)
    # the operator's clicks on the view buttons
    for t in tl["views"]:
        mix.put(t, click(2400, 0.025), 0.05)
