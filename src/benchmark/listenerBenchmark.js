import { midiRecorder, setBpm, getBpm } from "../core/litePlay.js";
import * as csoundListener from "../listener/litePlay.listener.js";
import * as essentiaListener from "../listener/listener.js";
import {
  MediaRecorder as ExtMediaRecorder,
  register,
} from "https://esm.sh/extendable-media-recorder";
import { connect as connectWavEncoder } from "https://esm.sh/extendable-media-recorder-wav-encoder";
import {
  DEFAULT_THRESHOLDS,
  extractTrials,
  matchTrials,
  scoreRecord,
  scoreSilence,
  summarize,
} from "./groundTruth.js";
import {
  DEFAULT_SUITES,
  runSchedule,
  sleep,
} from "./suite.js";
import { createNoiseBed } from "./noise.js";

let wavEncoderRegistered = false;
async function ensureWavEncoder() {
  if (!wavEncoderRegistered) {
    try {
      await register(await connectWavEncoder());
      wavEncoderRegistered = true;
    } catch (e) {
      // Already registered or in-flight
      wavEncoderRegistered = true;
    }
  }
}

function downloadFile(content, filename, mimeType) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * The Essentia listener now timestamps on the frame position the worklet
 * captured, so its transport delay is already removed at the source and no
 * correction is applied here. The raw and corrected columns are kept separate
 * in the CSV so the difference stays visible rather than being folded into a
 * single number whose provenance is unclear.
 */

const sleepMs = sleep;

/**
 * Runs the listener benchmark against known ground truth.
 *
 * The design point: detections are scored against the exact notes the synth was
 * asked to play, not against a peer listener. That makes every number an
 * absolute error, so it answers "is this detector right?" rather than "do these
 * two agree?". A second listener stays available as a dev-time cross-check, but
 * it is never the reference.
 *
 * @param {Object} options
 * @param {string[]} [options.engines=['csound','essentia']] - Listeners to run
 * @param {Function[]} [options.suites=DEFAULT_SUITES] - Trial generators
 * @param {Object} [options.thresholds] - Pass/fail bands
 * @param {boolean} [options.exportMedia=false] - Export ground-truth .mid and .wav
 * @returns {Promise<Object>} Records plus per-group summaries
 */
export async function runBenchmark(options = {}) {
  const {
    engines = ["csound", "essentia"],
    suites = DEFAULT_SUITES,
    thresholds = DEFAULT_THRESHOLDS,
    exportMedia = false,
  } = options;

  if (!window.csound) {
    throw new Error("Csound engine not ready.");
  }

  const savedBpm = getBpm();
  setBpm(60);

  console.log("=================================================");
  console.log("LISTENER BENCHMARK (scored against ground truth)");
  console.log("Engines:", engines);
  console.log(
    "Thresholds:",
    `pitch ±${thresholds.pitchCents}c, onset ±${thresholds.onsetMs}ms,`,
    `dur ±${thresholds.durMs}ms, amp ±${thresholds.amp}`,
  );
  console.log("=================================================");

  // The listeners analyse the Csound node directly. A same-context MediaStream
  // round trip would close a cycle back into the Csound node, which stalls the
  // render callback in some browsers, so the stream is reserved for the WAV
  // recorder only.
  const csoundNode = await window.csound.getNode();
  const audioCtx = csoundNode.context;
  const startNoise = createNoiseBed(audioCtx, csoundNode);

  let loopbackDest = null;

  // The recorder is the ground truth, so it always runs. Only the WAV capture
  // is optional.
  midiRecorder.start();

  let wavRecorder = null;
  let audioChunks = [];
  if (exportMedia) {
    loopbackDest = audioCtx.createMediaStreamDestination();
    csoundNode.connect(loopbackDest);
    try {
      await ensureWavEncoder();
      wavRecorder = new ExtMediaRecorder(loopbackDest.stream, { mimeType: "audio/wav" });
      audioChunks = [];
      wavRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      wavRecorder.start();
    } catch (err) {
      console.warn("Could not start media recording for benchmark:", err);
      wavRecorder = null;
    }
  }

  const allRecords = [];
  const engineSummaries = {};

  for (const engine of engines) {
    console.log(`\n>>> Engine: [${engine.toUpperCase()}] <<<`);
    const engineRecords = [];

    // Both listeners report absolute onsets in AudioContext time through the
    // second callback argument, already corrected for their own transport.
    let detected = [];

    const onEvent = (eventData, meta) => {
      if (!meta || meta.onsetTime === undefined) return;
      detected.push({
        pitch: eventData[0],
        amp: eventData[1],
        onsetSec: meta.onsetTime,
        durationSec: meta.duration,
        peakRms: meta.peakRms,
      });
    };

    // The listener modules capture this callback when they start, so it is
    // swapped per engine before any suite runs.
    onEventRef = onEvent;

    for (const makeSuite of suites) {
      const suite = makeSuite();
      console.log(`\n  [${suite.id}] ${suite.title}`);

      if (suite.id === "silence") {
        await startListener(engine, audioCtx, csoundNode);
        // Warm-up first, so the listener's own settling after start is not
        // counted as a hallucination.
        await sleepMs(800);
        detected = [];
        const windowSec = suite.silenceWindowSec;
        console.log(`    listening to ${windowSec}s of silence...`);
        await sleepMs(windowSec * 1000);

        const rec = scoreSilence(detected, windowSec, thresholds);
        rec.engine = engine;
        allRecords.push(rec);
        engineRecords.push(rec);
        console.log(
          `    ${rec.detected_count} false positive(s) in ${windowSec}s -> ${rec.pass ? "PASS" : "FAIL"}`,
        );
        stopListener(engine);
        continue;
      }

      detected = [];
      await startListener(engine, audioCtx, csoundNode);
      await sleepMs(400);

      for (let i = 0; i < suite.schedules.length; i++) {
        const s = suite.schedules[i];
        detected = [];
        // Captured per trial, not per suite: extractTrials reads from this
        // index, so a suite-wide cursor would re-score earlier trials.
        const recorderStart = midiRecorder._events.length;
        const waitMs = await runSchedule(s, startNoise);
        await sleepMs(waitMs);
        scoreGroup({
          engine,
          testType: s.testType,
          label: s.label,
          detected,
          recorderStart,
          thresholds,
          engineRecords,
          allRecords,
          isDrum: s.kind === "clap",
        });
        if ((i + 1) % 6 === 0 || i === suite.schedules.length - 1) {
          console.log(`    ${i + 1}/${suite.schedules.length} trials scored`);
        }
      }

      stopListener(engine);
      await sleepMs(300);
    }

    engineSummaries[engine] = summarize(engineRecords);
    console.log(`\n  --- ${engine.toUpperCase()} summary ---`);
    console.log(engineSummaries[engine]);
  }

  if (loopbackDest) {
    try {
      csoundNode.disconnect(loopbackDest);
    } catch (e) {
      // Ignore disconnect error
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  setBpm(savedBpm);

  midiRecorder.stop();

  if (exportMedia) {
    if (midiRecorder._events.length > 0) {
      try {
        midiRecorder.buildAndDownload(`benchmark_ground_truth_${timestamp}.mid`);
      } catch (err) {
        console.error("Failed to build benchmark MIDI:", err);
      }
    }
    if (wavRecorder) {
      wavRecorder.stop();
      await sleepMs(200);
      if (audioChunks.length > 0) {
        const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
        downloadFile(audioBlob, `benchmark_audio_${timestamp}.wav`, "audio/wav");
      }
    }
  }

  buildCsv(allRecords, timestamp);

  console.log(`\n=================================================`);
  console.log("BENCHMARK COMPLETE. Ground-truth summaries by engine:");
  for (const [engine, s] of Object.entries(engineSummaries)) {
    console.log(`  ${engine}: detection ${(s.detectionRate * 100).toFixed(1)}%, ` +
      `pass ${(s.passRate * 100).toFixed(1)}%, ` +
      `pitch p95 ${fmt(s.pitchCentsP95)}c, onset p95 ${fmt(s.onsetMsP95)}ms, ` +
      `${s.octaveErrors} octave error(s), ${s.missed} missed`);
  }
  console.log("=================================================");

  return { records: allRecords, summaries: engineSummaries };
}

function fmt(v) {
  return v === null || v === undefined ? "n/a" : v.toFixed(1);
}

async function startListener(engine, audioCtx, csoundNode) {
  if (engine === "csound") {
    csoundListener.stopListening();
    await csoundListener.toggleListening(audioCtx, { node: csoundNode }, onEventRef);
  } else {
    await essentiaListener.toggleListening(audioCtx, { node: csoundNode }, onEventRef);
  }
}

function stopListener(engine) {
  if (engine === "csound") csoundListener.stopListening();
  else essentiaListener.stopListening();
}

// The active engine's collector is swapped per phase; the listener modules take
// a callback reference at start time, so this indirection is what lets a single
// startListener signature serve both engines.
let onEventRef = null;

/**
 * Scores one trial group. Ground truth comes from midiRecorder, which logs
 * every note at score time with an AudioContext-clock start, so both listeners
 * can be aligned to it without guessing.
 */
function scoreGroup({
  engine,
  testType,
  label,
  detected,
  recorderStart,
  thresholds,
  engineRecords,
  allRecords,
  sampleRate,
  isDrum,
}) {
  const trials = extractTrials(midiRecorder._events, recorderStart);

  // The recorder timestamps relative to its own start, while listeners report
  // absolute AudioContext time. Shifting onto absolute time here is what lets
  // both engines be scored against the same score without per-engine fudging.
  const clockRef = midiRecorder._clockRef;
  for (const t of trials) {
    t.onsetSec += clockRef;
  }

  // Hand claps are logged as drums and are not pitched events. They still get
  // scored for detection, but pitch columns are meaningless for them and are
  // left empty rather than filled with noise.
  const pitchedTrials = isDrum ? [] : trials;

  if (isDrum) {
    // Rhythm trials are scored on presence alone.
    const rec = {
      engine,
      test_type: testType,
      label,
      trial: 1,
      status: detected.length > 0 ? "detected" : "missed",
      pass: detected.length > 0,
      ground_truth_pitch: null,
      detected_pitch: null,
      pitch_error_cents: null,
      octave_error: null,
      ground_truth_onset_ms: null,
      detected_onset_ms: detected.length
        ? parseFloat((detected[0].onsetSec * 1000).toFixed(2))
        : null,
      onset_error_ms: null,
      ground_truth_dur_ms: null,
      detected_dur_ms: detected.length
        ? Math.round((detected[0].durationSec ?? 0) * 1000)
        : null,
      dur_error_ms: null,
      ground_truth_amp: null,
      detected_amp: detected.length
        ? parseFloat((detected[0].amp ?? 0).toFixed(3))
        : null,
      pitch_pass: null,
      onset_pass: null,
      dur_pass: null,
      amp_pass: null,
    };
    engineRecords.push(rec);
    allRecords.push(rec);
    return;
  }

  if (pitchedTrials.length === 0) return;

  const { assignments, missedTrialIndices, falsePositiveIndices } = matchTrials(
    pitchedTrials,
    detected,
    thresholds,
  );

  for (const a of assignments) {
    const rec = scoreRecord({
      engine,
      trialIndex: a.trialIndex,
      testType,
      label,
      trial: pitchedTrials[a.trialIndex],
      detection: detected[a.detIndex],
      onsetErrorMs: a.onsetErrorMs,
      thresholds,
    });
    engineRecords.push(rec);
    allRecords.push(rec);
  }

  for (const t of missedTrialIndices) {
    const rec = scoreRecord({
      engine,
      trialIndex: t,
      testType,
      label,
      trial: pitchedTrials[t],
      detection: null,
      onsetErrorMs: null,
      thresholds,
    });
    engineRecords.push(rec);
    allRecords.push(rec);
  }

  // Unmatched detections are false positives. They get their own rows so they
  // cannot hide inside an average.
  falsePositiveIndices.forEach((d, i) => {
    const rec = {
      engine,
      test_type: testType,
      label: `${label || testType}_false_positive`,
      trial: i + 1,
      status: "false_positive",
      pass: false,
      ground_truth_pitch: null,
      detected_pitch: detected[d].pitch,
      pitch_error_cents: null,
      octave_error: null,
      ground_truth_onset_ms: null,
      detected_onset_ms: parseFloat((detected[d].onsetSec * 1000).toFixed(2)),
      onset_error_ms: null,
      ground_truth_dur_ms: null,
      detected_dur_ms: Math.round((detected[d].durationSec ?? 0) * 1000),
      dur_error_ms: null,
      ground_truth_amp: null,
      detected_amp: parseFloat((detected[d].amp ?? 0).toFixed(3)),
      pitch_pass: null,
      onset_pass: null,
      dur_pass: null,
      amp_pass: null,
    };
    engineRecords.push(rec);
    allRecords.push(rec);
  });
}

const CSV_HEADERS = [
  "engine",
  "test_type",
  "label",
  "trial",
  "status",
  "pass",
  "ground_truth_pitch",
  "detected_pitch",
  "pitch_error_cents",
  "octave_error",
  "ground_truth_onset_ms",
  "detected_onset_ms",
  "onset_error_ms",
  "ground_truth_dur_ms",
  "detected_dur_ms",
  "dur_error_ms",
  "ground_truth_amp",
  "detected_amp",
  "pitch_pass",
  "onset_pass",
  "dur_pass",
  "amp_pass",
  "detected_count",
  "allowed_count",
];

function buildCsv(records, timestamp) {
  const csvRows = [CSV_HEADERS.join(",")];
  for (const rec of records) {
    const row = CSV_HEADERS.map((h) =>
      rec[h] === null || rec[h] === undefined ? "" : rec[h],
    );
    csvRows.push(row.join(","));
  }
  const csvContent = csvRows.join("\n");
  const csvFileName = `benchmark_results_${timestamp}.csv`;
  downloadFile(csvContent, csvFileName, "text/csv;charset=utf-8;");
  console.log(`Results CSV: ${csvFileName}`);
}

if (typeof window !== "undefined") {
  window.runBenchmark = runBenchmark;
}