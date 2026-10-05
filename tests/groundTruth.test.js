import { describe, it, expect } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  centsBetween,
  extractTrials,
  isOctaveError,
  matchTrials,
  percentile,
  scoreRecord,
  scoreSilence,
  summarize,
} from "../src/benchmark/groundTruth.js";

const trial = (over = {}) => ({
  pitch: 60,
  velocity: 0.8,
  onsetSec: 1.0,
  durSec: 0.35,
  channel: 1,
  program: 0,
  ...over,
});

const det = (over = {}) => ({
  pitch: 60,
  amp: 0.8,
  onsetSec: 1.0,
  durationSec: 0.35,
  peakRms: 0.3,
  ...over,
});

describe("percentile", () => {
  it("uses nearest-rank over a sorted copy", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 95)).toBe(5);
    expect(percentile([5, 1, 3], 100)).toBe(5);
  });

  it("does not mutate its input", () => {
    const input = [3, 1, 2];
    percentile(input, 50);
    expect(input).toEqual([3, 1, 2]);
  });

  it("returns null for an empty set", () => {
    expect(percentile([], 95)).toBeNull();
    expect(percentile(null, 95)).toBeNull();
  });
});

describe("pitch error helpers", () => {
  it("scales semitone distance to cents", () => {
    expect(centsBetween(60, 60)).toBe(0);
    expect(centsBetween(60.5, 60)).toBe(50);
    expect(centsBetween(59, 60)).toBe(-100);
  });

  it("flags octave errors but not sub-octave deviations", () => {
    expect(isOctaveError(60, 60)).toBe(false);
    expect(isOctaveError(67, 60)).toBe(false);
    expect(isOctaveError(72, 60)).toBe(true);
    expect(isOctaveError(48, 60)).toBe(true);
    expect(isOctaveError(61.4, 60)).toBe(false);
  });
});

describe("extractTrials", () => {
  const events = [
    { type: "note", pitch: 60, velocity: 104, startSec: 0.5, durSec: 0.3, channel: 1, program: 0 },
    { type: "note", pitch: 39, velocity: 110, startSec: 0.9, durSec: 0.1, channel: 2, program: 0, isDrums: true },
    { type: "note", pitch: 64, velocity: 90, startSec: 1.4, durSec: 0.4, channel: 1, program: 1 },
    { type: "on", pitch: 67, startSec: 2.0, channel: 1 },
    { type: "off", pitch: 67, startSec: 2.5, channel: 1 },
  ];

  it("keeps pitched notes with a duration", () => {
    const trials = extractTrials(events);
    expect(trials.map((t) => t.pitch)).toEqual([60, 64]);
  });

  it("excludes drums, bare note-on and note-off pairs", () => {
    const trials = extractTrials(events);
    expect(trials.every((t) => !t.isDrums)).toBe(true);
  });

  it("normalizes velocity to 0-1", () => {
    const [first] = extractTrials(events);
    expect(first.velocity).toBeCloseTo(104 / 127, 5);
  });

  it("honors the fromIndex cursor so suites do not re-score", () => {
    const trials = extractTrials(events, 2);
    expect(trials.map((t) => t.pitch)).toEqual([64]);
  });

  it("returns an empty list when there is nothing to score", () => {
    expect(extractTrials([])).toEqual([]);
  });
});

describe("matchTrials", () => {
  it("pairs each detection with at most one trial and vice versa", () => {
    const trials = [trial({ onsetSec: 1.0 }), trial({ pitch: 67, onsetSec: 2.0 })];
    const dets = [
      det({ onsetSec: 1.01 }),
      det({ pitch: 67, onsetSec: 2.02 }),
      det({ pitch: 55, onsetSec: 5.0 }),
    ];

    const m = matchTrials(trials, dets);

    expect(m.assignments).toHaveLength(2);
    expect(m.missedTrialIndices).toEqual([]);
    expect(m.falsePositiveIndices).toEqual([2]);
  });

  it("prefers the nearest onset when several are in range", () => {
    const trials = [trial({ onsetSec: 1.0 }), trial({ pitch: 67, onsetSec: 1.2 })];
    const dets = [det({ onsetSec: 1.19 })];

    const m = matchTrials(trials, dets);

    expect(m.assignments[0].trialIndex).toBe(1);
    expect(m.missedTrialIndices).toEqual([0]);
  });

  it("reports trials with no detection as missed", () => {
    const trials = [trial({ onsetSec: 1.0 }), trial({ pitch: 67, onsetSec: 2.0 })];
    const m = matchTrials(trials, [det({ onsetSec: 1.0 })]);

    expect(m.missedTrialIndices).toEqual([1]);
    expect(m.falsePositiveIndices).toEqual([]);
  });

  it("refuses matches beyond the match window", () => {
    const trials = [trial({ onsetSec: 1.0 })];
    const dets = [det({ onsetSec: 1.0 + DEFAULT_THRESHOLDS.matchWindowMs / 1000 + 0.05 })];

    const m = matchTrials(trials, dets);

    expect(m.assignments).toEqual([]);
    expect(m.missedTrialIndices).toEqual([0]);
    expect(m.falsePositiveIndices).toEqual([0]);
  });

  it("does not let one loud note absorb two detections", () => {
    const trials = [trial()];
    const dets = [det({ onsetSec: 1.05 }), det({ onsetSec: 1.1 })];

    const m = matchTrials(trials, dets);

    expect(m.assignments).toHaveLength(1);
    expect(m.falsePositiveIndices).toEqual([1]);
  });
});

describe("scoreRecord", () => {
  it("passes a clean detection", () => {
    const rec = scoreRecord({
      engine: "csound",
      trialIndex: 0,
      testType: "melody",
      trial: trial(),
      detection: det(),
      onsetErrorMs: 5,
      thresholds: DEFAULT_THRESHOLDS,
    });

    expect(rec.status).toBe("detected");
    expect(rec.pass).toBe(true);
    expect(rec.pitch_error_cents).toBe(0);
    expect(rec.pitch_pass).toBe(true);
  });

  it("keeps the sign of the onset error so bias is visible", () => {
    const late = scoreRecord({
      engine: "csound",
      trialIndex: 0,
      testType: "melody",
      trial: trial(),
      detection: det({ onsetSec: 1.1 }),
      onsetErrorMs: 100,
      thresholds: DEFAULT_THRESHOLDS,
    });
    const early = scoreRecord({
      engine: "csound",
      trialIndex: 0,
      testType: "melody",
      trial: trial(),
      detection: det({ onsetSec: 0.9 }),
      onsetErrorMs: 100,
      thresholds: DEFAULT_THRESHOLDS,
    });

    expect(late.onset_error_ms).toBeCloseTo(100, 1);
    expect(early.onset_error_ms).toBeCloseTo(-100, 1);
  });

  it("fails on an octave error while still reporting it", () => {
    const rec = scoreRecord({
      engine: "csound",
      trialIndex: 0,
      testType: "register",
      trial: trial(),
      detection: det({ pitch: 72 }),
      onsetErrorMs: 5,
      thresholds: DEFAULT_THRESHOLDS,
    });

    expect(rec.octave_error).toBe(true);
    expect(rec.pitch_pass).toBe(false);
    expect(rec.pass).toBe(false);
  });

  it("marks a missing detection as a failure", () => {
    const rec = scoreRecord({
      engine: "csound",
      trialIndex: 0,
      testType: "melody",
      trial: trial(),
      detection: null,
      onsetErrorMs: null,
      thresholds: DEFAULT_THRESHOLDS,
    });

    expect(rec.status).toBe("missed");
    expect(rec.pass).toBe(false);
    expect(rec.pitch_pass).toBeNull();
  });

  it("only scores the checks that apply", () => {
    const rec = scoreRecord({
      engine: "csound",
      trialIndex: 0,
      testType: "rhythm",
      trial: null,
      detection: null,
      onsetErrorMs: null,
      thresholds: DEFAULT_THRESHOLDS,
    });

    expect(rec.pitch_error_cents).toBeNull();
  });
});

describe("summarize", () => {
  it("reports worst case and p95, not just the mean", () => {
    const errors = [5, 10, 15, 20, 900];
    const records = errors.map((cents) =>
      scoreRecord({
        engine: "csound",
        trialIndex: 0,
        testType: "melody",
        trial: trial(),
        detection: det({ pitch: 60 + cents / 100 }),
        onsetErrorMs: 5,
        thresholds: DEFAULT_THRESHOLDS,
      }),
    );

    const s = summarize(records);

    expect(s.trials).toBe(5);
    expect(s.detected).toBe(5);
    expect(s.pitchCentsMax).toBe(900);
    expect(s.pitchCentsP95).toBe(900);
    expect(s.passRate).toBe(0.8);
  });

  it("survives an empty record set without dividing by zero", () => {
    const s = summarize([]);
    expect(s.detectionRate).toBeNull();
    expect(s.passRate).toBeNull();
    expect(s.pitchCentsMax).toBeNull();
  });

  it("counts octave errors across the set", () => {
    const rec = scoreRecord({
      engine: "csound",
      trialIndex: 0,
      testType: "register",
      trial: trial(),
      detection: det({ pitch: 48 }),
      onsetErrorMs: 5,
      thresholds: DEFAULT_THRESHOLDS,
    });

    expect(summarize([rec]).octaveErrors).toBe(1);
  });
});

describe("scoreSilence", () => {
  it("passes a silent window with no detections", () => {
    const rec = scoreSilence([], 8, { silenceFalsePositives: 0 });
    expect(rec.status).toBe("clean");
    expect(rec.pass).toBe(true);
  });

  it("fails on any hallucinated event, which per-trial metrics would hide", () => {
    const rec = scoreSilence([{ onsetSec: 3.1 }], 8, { silenceFalsePositives: 0 });
    expect(rec.status).toBe("hallucinated");
    expect(rec.pass).toBe(false);
    expect(rec.detected_count).toBe(1);
  });

  it("ignores detections outside the measured window", () => {
    const rec = scoreSilence([{ onsetSec: 99 }], 8, { silenceFalsePositives: 0 });
    expect(rec.detected_count).toBe(0);
    expect(rec.pass).toBe(true);
  });

  it("honors an explicit budget", () => {
    const events = [{ onsetSec: 1 }, { onsetSec: 2 }];
    expect(scoreSilence(events, 8, { silenceFalsePositives: 3 }).pass).toBe(true);
    expect(scoreSilence(events, 8, { silenceFalsePositives: 1 }).pass).toBe(false);
  });
});