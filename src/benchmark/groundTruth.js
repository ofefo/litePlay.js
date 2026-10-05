/**
 * Ground-truth scoring for the listener benchmark.
 *
 * The benchmark knows exactly what it asked the synth to play, so it does not
 * need a second listener to act as a reference. Every detection is matched to
 * the nearest plausible ground-truth note and scored as an absolute error,
 * which is a stronger claim than agreement with a peer implementation.
 */

/** Tuning targets. Referenced to literature ranges, not tuned to this repo. */
export const DEFAULT_THRESHOLDS = {
  // Trained human pitch discrimination is roughly 5-10 cents; a tracking
  // detector seen through an envelope follower rarely holds that. 25 cents is
  // a pass at this pipeline's resolution without demanding lab-grade accuracy.
  pitchCents: 25,
  // MIR onset detection is normally scored with 10-30 ms tolerance.
  onsetMs: 30,
  // Duration is the noisiest quantity in either pipeline, so the band is wide.
  durMs: 60,
  // Amp is a normalized 0-1 estimate through a shared dB mapping.
  amp: 0.2,
  // A detection beyond this from any ground-truth onset is a false positive.
  matchWindowMs: 400,
};

export function percentile(values, p) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  // Nearest-rank percentile: for p in (0,1] take the ceil(p*n)-th value.
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1];
}

export function centsBetween(midiA, midiB) {
  return (midiA - midiB) * 100;
}

export function isOctaveError(midiA, midiB) {
  // A rounding test alone misclassifies a perfect fifth (7 semitones rounds to
  // 1) as an octave error. Real octave failures land near 12, 24 or -12, so the
  // gate sits above the widest ordinary interval (a major sixth, 9 semitones)
  // rather than splitting the octave down the middle.
  return Math.abs(midiA - midiB) >= 10;
}

/**
 * Turns a block of midiRecorder note events into ground-truth trials.
 * Only note-on events with a duration are trials; the recorder also logs bare
 * on/off pairs and tempo changes, which are not scored events.
 */
export function extractTrials(recorderEvents, fromIndex = 0) {
  const trials = [];
  for (let i = fromIndex; i < recorderEvents.length; i++) {
    const e = recorderEvents[i];
    if (!e || e.type !== "note") continue;
    if (e.isDrums) continue;
    trials.push({
      pitch: e.pitch,
      velocity: e.velocity / 127,
      onsetSec: e.startSec,
      durSec: e.durSec,
      channel: e.channel,
      program: e.program,
    });
  }
  return trials;
}

/**
 * Greedy nearest-onset assignment. Each detection claims at most one trial and
 * each trial is claimed by at most one detection, so a single loud note cannot
 * absorb several detections and vice versa.
 */
export function matchTrials(trials, detections, thresholds = DEFAULT_THRESHOLDS) {
  const windowSec = thresholds.matchWindowMs / 1000;

  const pairs = [];
  for (let t = 0; t < trials.length; t++) {
    for (let d = 0; d < detections.length; d++) {
      const deltaSec = detections[d].onsetSec - trials[t].onsetSec;
      if (Math.abs(deltaSec) <= windowSec) {
        pairs.push({ t, d, cost: Math.abs(deltaSec) });
      }
    }
  }
  pairs.sort((a, b) => a.cost - b.cost);

  const trialTaken = new Array(trials.length).fill(false);
  const detTaken = new Array(detections.length).fill(false);
  const assignments = [];

  for (const p of pairs) {
    if (trialTaken[p.t] || detTaken[p.d]) continue;
    trialTaken[p.t] = true;
    detTaken[p.d] = true;
    assignments.push({ trialIndex: p.t, detIndex: p.d, onsetErrorMs: p.cost * 1000 });
  }

  return {
    assignments,
    missedTrialIndices: trials.map((_, i) => i).filter((i) => !trialTaken[i]),
    falsePositiveIndices: detections
      .map((_, i) => i)
      .filter((i) => !detTaken[i]),
  };
}

export function scoreRecord({
  engine,
  trialIndex,
  testType,
  label,
  trial,
  detection,
  onsetErrorMs,
  thresholds,
}) {
  const pitchErrorCents =
    detection && trial
      ? centsBetween(detection.pitch, trial.pitch)
      : null;

  const durErrorMs =
    detection && trial
      ? Math.abs((detection.durationSec ?? 0) - trial.durSec) * 1000
      : null;

  const ampError =
    detection && trial ? Math.abs((detection.amp ?? 0) - trial.velocity) : null;

  const signedOnsetErrorMs =
    detection && trial
      ? (detection.onsetSec - trial.onsetSec) * 1000
      : null;

  const status = detection ? "detected" : "missed";

  const checks = {
    pitch:
      pitchErrorCents === null
        ? null
        : Math.abs(pitchErrorCents) <= thresholds.pitchCents,
    onset:
      onsetErrorMs === null
        ? null
        : Math.abs(signedOnsetErrorMs) <= thresholds.onsetMs,
    dur:
      durErrorMs === null ? null : durErrorMs <= thresholds.durMs,
    amp: ampError === null ? null : ampError <= thresholds.amp,
  };

  const applicable = Object.values(checks).filter((v) => v !== null);
  const passed = applicable.length > 0 && applicable.every(Boolean);

  return {
    engine,
    test_type: testType,
    label: label ?? "",
    trial: trialIndex + 1,
    status,
    pass: detection ? passed : false,

    ground_truth_pitch: trial ? trial.pitch : null,
    detected_pitch: detection ? detection.pitch : null,
    pitch_error_cents:
      pitchErrorCents === null ? null : parseFloat(pitchErrorCents.toFixed(2)),
    octave_error:
      pitchErrorCents === null ? null : isOctaveError(detection.pitch, trial.pitch),

    ground_truth_onset_ms: trial ? parseFloat((trial.onsetSec * 1000).toFixed(2)) : null,
    detected_onset_ms: detection ? parseFloat((detection.onsetSec * 1000).toFixed(2)) : null,
    onset_error_ms:
      signedOnsetErrorMs === null
        ? null
        : parseFloat(signedOnsetErrorMs.toFixed(2)),
    abs_onset_error_ms:
      onsetErrorMs === null ? null : parseFloat(onsetErrorMs.toFixed(2)),

    ground_truth_dur_ms: trial ? Math.round(trial.durSec * 1000) : null,
    detected_dur_ms: detection
      ? Math.round((detection.durationSec ?? 0) * 1000)
      : null,
    dur_error_ms: durErrorMs === null ? null : parseFloat(durErrorMs.toFixed(2)),

    ground_truth_amp: trial ? parseFloat(trial.velocity.toFixed(3)) : null,
    detected_amp: detection ? parseFloat((detection.amp ?? 0).toFixed(3)) : null,

    pitch_pass: checks.pitch,
    onset_pass: checks.onset,
    dur_pass: checks.dur,
    amp_pass: checks.amp,
  };
}

/**
 * Worst case and p95, not just the mean. An octave error on one frame of one
 * event is invisible in an average but is the thing a player actually notices.
 */
export function summarize(records) {
  const collect = (key, abs = true) =>
    records
      .map((r) => r[key])
      .filter((v) => v !== null && v !== undefined)
      .map((v) => (abs ? Math.abs(v) : v));

  const detected = records.filter((r) => r.status === "detected");
  const pitchErr = collect("pitch_error_cents");
  const onsetErr = collect("onset_error_ms");
  const durErr = collect("dur_error_ms");

  return {
    trials: records.length,
    detected: detected.length,
    missed: records.length - detected.length,
    detectionRate:
      records.length > 0 ? detected.length / records.length : null,
    passRate: records.length > 0
      ? records.filter((r) => r.pass).length / records.length
      : null,
    pitchCentsP50: percentile(pitchErr, 50),
    pitchCentsP95: percentile(pitchErr, 95),
    pitchCentsMax: pitchErr.length ? Math.max(...pitchErr) : null,
    onsetMsP50: percentile(onsetErr, 50),
    onsetMsP95: percentile(onsetErr, 95),
    onsetMsMax: onsetErr.length ? Math.max(...onsetErr) : null,
    durMsP95: percentile(durErr, 95),
    octaveErrors: records.filter((r) => r.octave_error === true).length,
  };
}

/**
 * A false positive during silence is the most disruptive failure mode for a
 * performance tool, and it is not visible in any per-trial metric: a missed
 * note is noticed, a hallucinated one is not. Silence therefore gets its own
 * budget rather than being inferred from the trials above.
 */
export function scoreSilence(events, trialWindowSec, thresholds) {
  const inWindow = events.filter((e) => e.onsetSec >= 0 && e.onsetSec <= trialWindowSec);
  const maxAllowed = thresholds.silenceFalsePositives ?? 0;
  return {
    engine: "all",
    test_type: "silence",
    label: "near-silence false positives",
    trial: 1,
    status: inWindow.length === 0 ? "clean" : "hallucinated",
    pass: inWindow.length <= maxAllowed,
    window_sec: trialWindowSec,
    detected_count: inWindow.length,
    allowed_count: maxAllowed,
  };
}