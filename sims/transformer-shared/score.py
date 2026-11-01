"""Score for the cast-resin transformer film: a cool bed (Em9 chords, 88 bpm) at one level the whole way, the
transformer's own hum underneath (100 Hz and its harmonics: the core's laminations stretch twice per mains cycle, so
the hum follows the flux density, not the load, and stays level), a quiet click on every button the operator presses,
a breaker clunk when the unit is switched off for the tap change and on again, a metal tick when the tap link
re-seats, rising air under the load drag and the fans' whirr from the moment the PT100 controller starts them.

    python run_sfx.py sims/transformer-shared/score.py

Times come from transformer-film/timeline.json: the clicks from film.js's SCRIPT (the relink timing from its RELINK),
the fan start from the same thermal model the film integrates (kin.js stepHeat, 3 s time constant, fan on at 100 °C).
"""

import math
import os

import numpy as np

from sfx.score_kit import airy, bed, chords, hz, motor, thud
from sfx.synth import click

TIMELINE = "../transformer-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "transformer-score.wav")
TARGET_LUFS = -14.0
SEED = 29
SR = 48000

CHORDS = chords("Em9:E2 B2 D3 F#3 G3/E1", "Cmaj7:C3 E3 G3 B3/C2", "Gmaj7:G2 D3 F#3 B3/G1", "D6:D3 F#3 A3 B3/D2")
MOTIF = [(0.5, hz("B4")), (1.5, hz("G4")), (2.5, hz("F#4"))]


def hum(dur, level=1.0):
    """Magnetostriction hum: 100 Hz with its even harmonics, a slow beat so it breathes, faded at both ends."""
    t = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * math.pi * 100 * t) + 0.45 * np.sin(2 * math.pi * 200 * t + 0.4) + 0.2 * np.sin(2 * math.pi * 300 * t + 1.1) + 0.12 * np.sin(2 * math.pi * 400 * t)
    s *= 0.85 + 0.15 * np.sin(2 * math.pi * 0.21 * t)
    fade = np.minimum(1, np.minimum(t / 1.5, (dur - t) / 1.5))
    return s * fade * level / 1.8


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 88, CHORDS, MOTIF, motif_voice="epiano", kicks=(0, 2.5), snares=(), hats=8, swing=0.0, keys_vel=0.7, keys_lp=3400)
    mix.put_stereo(0, left, right, 0.12)
    mix.put(0, low, 0.12)
    mix.put(0, drums, 0.04)
    mix.put(0, hum(dur), 0.022)
    for t in tl["clicks"]:
        mix.put(t, click(2400, 0.025), 0.055)
    # the breaker opens and closes around the relink; the link lands on its new studs
    for t in tl["breaker"]:
        mix.put(t + 0.05, thud(70, 0.06, 0.35), 0.08)
    mix.put(tl["tap"] + 1.25, click(5200, 0.018), 0.05)
    mix.put(tl["tap"] + 1.25, thud(240, 0.03, 0.15), 0.04)
    t0, d = tl["load"]
    mix.put(t0, airy(d + 0.6, 300, 1400, 0.6), 0.03)
    # the fans: a motor whirr from the PTC's switch to the end, under a soft air
    fan = tl["fans"]
    mix.put(fan, motor(dur - fan - 0.2, 150, 1100, 9), 0.016)
    mix.put(fan, airy(dur - fan - 0.2, 600, 900, 0.5), 0.02)
