import { describe, it, expect } from "vitest";
import { scoreSimple } from "../src/benchmark/score.js";

const note = (pitch, when, dur = 0.25) => ({ pitch, when, dur });

describe("scoreSimple", () => {
  it("scores exact detections as passed", () => {
    const result = scoreSimple(
      [note(60, 0), note(64, 0.5)],
      [
        [60, 0.8, 0, 0.3],
        [64, 0.8, 0.5, 0.3],
      ],
    );

    expect(result.summary.expected).toBe(2);
    expect(result.summary.detected).toBe(2);
    expect(result.summary.matched).toBe(2);
    expect(result.summary.passed).toBe(2);
    expect(result.summary.missed).toBe(0);
    expect(result.summary.extra).toBe(0);
    expect(result.rows[0].pitchErrorCents).toBe(0);
    expect(result.rows[0].onsetErrorMs).toBe(0);
  });

  it("counts a missed note without shifting later matches", () => {
    const result = scoreSimple(
      [note(60, 0), note(64, 0.5), note(67, 1)],
      [
        [60, 0.8, 0, 0.3],
        [67, 0.8, 1, 0.3],
      ],
    );

    expect(result.summary.missed).toBe(1);
    expect(result.summary.matched).toBe(2);
    expect(result.rows[1].matched).toBe(false);
    expect(result.rows[2].matched).toBe(true);
    expect(result.rows[2].detected[0]).toBe(67);
  });

  it("fails a note outside the pitch threshold", () => {
    const result = scoreSimple([note(60, 0)], [[60.6, 0.8, 0, 0.3]]);

    expect(result.summary.matched).toBe(1);
    expect(result.summary.passed).toBe(0);
    expect(result.rows[0].pitchErrorCents).toBeCloseTo(60, 5);
  });

  it("fails a note outside the onset threshold but inside the match window", () => {
    const result = scoreSimple([note(60, 0)], [[60, 0.8, 0.1, 0.3]]);

    expect(result.summary.matched).toBe(1);
    expect(result.summary.passed).toBe(0);
    expect(result.rows[0].onsetErrorMs).toBeCloseTo(100, 5);
  });

  it("does not match a detection to a neighboring expected note", () => {
    const result = scoreSimple(
      [note(60, 0), note(64, 0.5)],
      [[64, 0.8, 0.5, 0.3]],
    );

    expect(result.summary.missed).toBe(1);
    expect(result.summary.matched).toBe(1);
    expect(result.rows[0].matched).toBe(false);
    expect(result.rows[1].matched).toBe(true);
  });

  it("counts unmatched detections as extras", () => {
    const result = scoreSimple([note(60, 0)], [[64, 0.8, 0.8, 0.3]]);

    expect(result.summary.missed).toBe(1);
    expect(result.summary.extra).toBe(1);
    expect(result.extras).toHaveLength(1);
    expect(result.extras[0].event[0]).toBe(64);
  });

  it("treats silence detections as missed notes instead of pitch errors", () => {
    const result = scoreSimple([note(60, 0)], [[-999, 0.8, 0, 0.3]]);

    expect(result.summary.detected).toBe(0);
    expect(result.summary.matched).toBe(0);
    expect(result.summary.missed).toBe(1);
    expect(result.summary.extra).toBe(0);
    expect(result.summary.pitch.meanAbsCents).toBeNull();
  });

  it("summarizes mean and max errors", () => {
    const result = scoreSimple(
      [note(60, 0), note(64, 0.5)],
      [
        [60.02, 0.8, 0.01, 0.3],
        [63.98, 0.8, 0.52, 0.3],
      ],
    );

    expect(result.summary.pitch.meanAbsCents).toBeCloseTo(2, 5);
    expect(result.summary.pitch.maxAbsCents).toBeCloseTo(2, 5);
    expect(result.summary.onset.meanAbsMs).toBeCloseTo(15, 5);
    expect(result.summary.onset.maxAbsMs).toBeCloseTo(20, 5);
  });
});
