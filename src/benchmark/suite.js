/**
 * Trial generators for the listener benchmark.
 *
 * Each generator returns a flat list of "schedules": instructions the runner
 * executes on a schedule, plus the dimensions it varies. Timbre, dynamics,
 * register, density and polyphony are all deliberately varied because a
 * detector tuned on one grand piano at one volume measures almost nothing
 * about how it behaves in performance.
 */

import {
  grandPiano,
  brightPiano,
  harpsichord,
  celesta,
  glockenspiel,
  musicBox,
  marimba,
  xylophone,
  tubularBells,
  drawbarOrgan,
  churchOrgan,
  nylonAcousticGuitar,
  steelAcousticGuitar,
  violin,
  cello,
  flute,
  clarinet,
  trumpet,
  acousticBass,
  fretlessBass,
  drums,
} from "../core/litePlay.js";

const TUNED_TIMBRES = [
  { name: "grand_piano", instr: grandPiano },
  { name: "bright_piano", instr: brightPiano },
  { name: "harpsichord", instr: harpsichord },
  { name: "celesta", instr: celesta },
  { name: "glockenspiel", instr: glockenspiel },
  { name: "music_box", instr: musicBox },
  { name: "marimba", instr: marimba },
  { name: "xylophone", instr: xylophone },
  { name: "tubular_bells", instr: tubularBells },
  { name: "church_organ", instr: churchOrgan },
  { name: "nylon_guitar", instr: nylonAcousticGuitar },
  { name: "steel_guitar", instr: steelAcousticGuitar },
  { name: "violin", instr: violin },
  { name: "cello", instr: cello },
  { name: "flute", instr: flute },
  { name: "clarinet", instr: clarinet },
  { name: "trumpet", instr: trumpet },
  { name: "acoustic_bass", instr: acousticBass },
  { name: "fretless_bass", instr: fretlessBass },
];

// A fixed seed keeps runs comparable between sessions. Math.random() would
// make a regression impossible to tell apart from luck.
function makeRandom(seed = 12345) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Baseline: the original two-phase design. Comfortable timing, one timbre,
 * one velocity. Everything else in the suite exists to show where this fails.
 */
export function baselineTrials({ clapCount = 8, melodyNotes } = {}) {
  const notes = melodyNotes ?? [48, 52, 55, 57, 60, 62, 64, 65, 67, 69, 71, 72];
  const schedules = [];

  for (let i = 0; i < clapCount; i++) {
    schedules.push({
      kind: "clap",
      testType: "rhythm",
      label: "hand_clap",
      instrument: drums,
      pitch: 39,
      amp: 0.85,
      dur: 0.08,
      gapMs: 650,
    });
  }

  for (const pitch of notes) {
    schedules.push({
      kind: "note",
      testType: "melody",
      label: "baseline_melody",
      instrument: grandPiano,
      pitch,
      amp: 0.8,
      dur: 0.35,
      gapMs: 850,
    });
  }

  return {
    id: "baseline",
    title: "Baseline (single timbre, comfortable density)",
    schedules,
  };
}

/** Vary timbre while holding pitch, velocity and timing constant. */
export function timbreTrials({ gapMs = 700, dur = 0.4 } = {}) {
  const schedules = TUNED_TIMBRES.map(({ name, instr }, i) => ({
    kind: "note",
    testType: "timbre",
    label: name,
    instrument: instr,
    pitch: 60 + (i % 3) * 4,
    amp: 0.7,
    dur,
    gapMs,
  }));
  return {
    id: "timbre",
    title: "Timbre generalization (pitch, velocity and timing held constant)",
    schedules,
  };
}

/** Quiet passages and loud ones. A fixed absolute threshold fails one end. */
export function dynamicsTrials({ gapMs = 700, dur = 0.4 } = {}) {
  const amps = [0.12, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9];
  const schedules = amps.map((amp) => ({
    kind: "note",
    testType: "dynamics",
    label: `amp_${amp.toFixed(2)}`,
    instrument: grandPiano,
    pitch: 60,
    amp,
    dur,
    gapMs,
  }));
  return {
    id: "dynamics",
    title: "Dynamics generalization (12% to 90% amplitude)",
    schedules,
  };
}

/**
 * Full MIDI range. The Csound side uses ptrack with a 512-sample window, which
 * gets coarse in the low register, so the bottom of this range is the most
 * likely place for an octave error.
 */
export function registerTrials({ gapMs = 700, dur = 0.5 } = {}) {
  const pitches = [21, 24, 28, 33, 36, 40, 45, 48, 55, 60, 67, 72, 79, 84, 90, 96, 102, 108];
  const schedules = pitches.map((pitch) => ({
    kind: "note",
    testType: "register",
    label: `midi_${pitch}`,
    instrument: grandPiano,
    pitch,
    amp: 0.75,
    dur,
    gapMs,
  }));
  return {
    id: "register",
    title: "Register generalization (MIDI 21 to 108)",
    schedules,
  };
}

/**
 * Rising density. Events faster than the listener's internal poll interval are
 * the classic way to lose notes silently, so misses here are the real test.
 */
export function densityTrials({ gapMs = 800, dur = 0.12 } = {}) {
  const rand = makeRandom(777);
  const pitches = [60, 64, 67, 72, 69, 65, 62, 71];
  const gaps = [800, 600, 400, 300, 200, 150, 120];
  const schedules = [];
  let i = 0;

  for (const gap of gaps) {
    for (let n = 0; n < 6; n++) {
      schedules.push({
        kind: "note",
        testType: "density",
        label: `gap_${gap}ms`,
        instrument: grandPiano,
        pitch: pitches[Math.floor(rand() * pitches.length)],
        amp: 0.7,
        dur,
        gapMs: gap,
      });
      i++;
    }
  }

  return {
    id: "density",
    title: "Density generalization (800ms down to 120ms spacing)",
    schedules,
  };
}

/**
 * Overlapping notes. The listener state machine tracks a single `isSounding`
 * flag, so chords are expected to under-report. That expectation is the point:
 * this measures a known architectural limit instead of leaving it to be
 * discovered during a performance.
 */
export function polyphonyTrials({ gapMs = 1200, dur = 0.6 } = {}) {
  const chords = [
    [60, 64, 67],
    [62, 65, 69],
    [55, 59, 62],
    [48, 52, 55, 60],
    [67, 71, 74],
  ];
  const schedules = chords.map((notes) => ({
    kind: "chord",
    testType: "polyphony",
    label: `chord_${notes.length}`,
    instrument: grandPiano,
    pitches: notes,
    amp: 0.6,
    dur,
    gapMs,
  }));
  return {
    id: "polyphony",
    title: "Polyphony (simultaneous notes; single-voice state machine expected to under-report)",
    schedules,
  };
}

/**
 * A low-level noise bed under the signal. Digital silence has no noise floor,
 * but any real microphone or live room does, and a detector whose threshold is
 * absolute rather than adaptive will ride on top of it.
 */
export function noiseTrials({ gapMs = 700, dur = 0.4, noiseAmp = 0.05 } = {}) {
  const schedules = [
    {
      kind: "noise",
      testType: "noise_floor",
      label: `noise_${noiseAmp.toFixed(2)}`,
      instrument: grandPiano,
      noiseAmp,
      durationSec: (gapMs + 200) / 1000,
      pitches: [60, 64, 67, 62],
      amp: 0.7,
      dur,
      gapMs,
    },
  ];
  return {
    id: "noise",
    title: `Noise floor (digital noise bed at ${noiseAmp} amplitude)`,
    schedules,
  };
}

/** Explicit near-silence window. Counts hallucinated events. */
export function silenceTrials({ durationSec = 8 } = {}) {
  return {
    id: "silence",
    title: `Near-silence (${durationSec}s, false-positive budget)`,
    silenceWindowSec: durationSec,
    schedules: [],
  };
}

export const DEFAULT_SUITES = [
  baselineTrials,
  timbreTrials,
  dynamicsTrials,
  registerTrials,
  densityTrials,
  polyphonyTrials,
  noiseTrials,
  silenceTrials,
];

/**
 * Plays one schedule and returns how long the caller should wait afterwards.
 * Execution lives here rather than in the runner so the same generator works
 * for any engine.
 */
export async function runSchedule(s, noiseEngine) {
  if (s.kind === "chord") {
    for (const p of s.pitches) {
      s.instrument.play([p, s.amp, 0, s.dur]);
    }
  } else if (s.kind === "noise") {
    const stopNoise = noiseEngine(s.noiseAmp);
    try {
      for (const p of s.pitches) {
        s.instrument.play([p, s.amp, 0, s.dur]);
        await sleep(s.gapMs);
      }
    } finally {
      stopNoise();
    }
    return s.gapMs;
  } else {
    s.instrument.play([s.pitch, s.amp, 0, s.dur]);
  }
  return s.gapMs;
}

export { sleep };