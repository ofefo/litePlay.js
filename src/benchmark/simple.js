import {
  audio_context,
  csound,
  getBpm,
  reset,
  setBpm,
  startEngine,
} from "../core/litePlay.js";
import {
  startListening,
  stopListening,
} from "../listener/litePlay.listener.js";
import { scoreSimple } from "./score.js";

const PATTERN = [60, 62, 64, 67, 65, 64, 62, 60];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeNotes({ count, spacing, noteDur, amp }) {
  return Array.from({ length: count }, (_, index) => ({
    pitch: PATTERN[index % PATTERN.length],
    when: index * spacing,
    dur: noteDur,
    amp,
  }));
}

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined) return "n/a";
  return value.toFixed(digits);
}

function formatSigned(value, digits = 0, suffix = "") {
  if (value === null || value === undefined) return "n/a";
  const rounded = Math.abs(value) < 0.5 ? 0 : value;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(digits)}${suffix}`;
}

function printSummary(result, { noteDur }) {
  const { summary, rows, extras } = result;
  const failures = rows.filter((row) => !row.passed);

  console.log(
    `[simple benchmark] detected ${summary.detected}/${summary.expected} | ` +
      `matched ${summary.matched} | passed ${summary.passed} | ` +
      `missed ${summary.missed} | extra ${summary.extra}`,
  );
  console.log(
    `[simple benchmark] pitch: mean ${formatNumber(summary.pitch.meanAbsCents, 1)}c, ` +
      `max ${formatNumber(summary.pitch.maxAbsCents, 1)}c | ` +
      `onset: mean ${formatNumber(summary.onset.meanAbsMs, 1)}ms, ` +
      `max ${formatNumber(summary.onset.maxAbsMs, 1)}ms`,
  );
  console.log(
    `[simple benchmark] duration: mean ${formatNumber(summary.duration.meanMs, 0)}ms ` +
      `(scheduled ${formatNumber(noteDur * 1000, 0)}ms) | ` +
      `loudness: mean ${formatNumber(summary.loudness.mean, 2)}`,
  );

  if (failures.length === 0) {
    console.log("[simple benchmark] all expected notes passed");
  } else {
    console.log(`[simple benchmark] ${failures.length} failure(s):`);
    failures.slice(0, 10).forEach((row) => {
      if (!row.matched) {
        console.log(
          `  #${row.index + 1} expected ${formatNumber(row.expected.pitch, 2)} ` +
            `@ ${formatNumber(row.expected.when, 2)}s -> MISS`,
        );
        return;
      }

      console.log(
        `  #${row.index + 1} expected ${formatNumber(row.expected.pitch, 2)} ` +
          `@ ${formatNumber(row.expected.when, 2)}s -> ` +
          `${formatNumber(row.detected[0], 2)} @ ${formatNumber(row.detected[2], 2)}s ` +
          `(${formatSigned(row.pitchErrorCents, 1, "c")}, ` +
          `${formatSigned(row.onsetErrorMs, 1, "ms")})`,
      );
    });
    if (failures.length > 10) {
      console.log(`  ... ${failures.length - 10} more`);
    }
  }

  if (extras.length > 0) {
    console.log(`[simple benchmark] extra detections: ${extras.length}`);
    extras.slice(0, 5).forEach(({ event }) => {
      console.log(
        `  extra ${formatNumber(event[0], 2)} @ ${formatNumber(event[2], 2)}s`,
      );
    });
    if (extras.length > 5) {
      console.log(`  ... ${extras.length - 5} more`);
    }
  }
}

export async function runSimpleBenchmark({
  count = 100,
  spacing = 0.5,
  noteDur = 0.25,
  amp = 1,
  thresholds = {},
  warmupMs = 1000,
  tailMs = 1500,
} = {}) {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("count must be a positive integer");
  }
  if (!(spacing > 0) || !(noteDur > 0)) {
    throw new Error("spacing and noteDur must be positive");
  }
  if (!(warmupMs >= 0) || !(tailMs >= 0)) {
    throw new Error("warmupMs and tailMs must be non-negative");
  }

  if (!csound) await startEngine();
  if (audio_context?.state === "suspended") await audio_context.resume();

  const notes = makeNotes({ count, spacing, noteDur, amp });
  const lastNote = notes[notes.length - 1];
  const audioSeconds = lastNote.when + noteDur;
  const runSeconds = warmupMs / 1000 + audioSeconds + tailMs / 1000;
  const detected = [];
  const previousBpm = getBpm();

  console.log(
    `[simple benchmark] ${count} notes | ${spacing}s spacing | ` +
      `${audioSeconds.toFixed(2)}s audio | about ${runSeconds.toFixed(1)}s total`,
  );

  try {
    stopListening();
    await reset();
    const csoundNode = await csound.getNode();
    const started = await startListening(
      {
        node: csoundNode,
        fastAtt: 0.005,
        fastRel: 0.02,
        slowAtt: 0.02,
        slowRel: 0.08,
        thresh: 0.02,
        noiseFloor: 0.005,
        holdTime: 0.02,
        silenceThresh: 1,
      },
      (event) => detected.push(event),
    );
    if (!started) throw new Error("Could not start the machine listener");

    await sleep(warmupMs);
    setBpm(60);
    piano.play(
      ...notes.map((note) => [note.pitch, note.amp, note.when, note.dur]),
    );
    await sleep((audioSeconds + tailMs / 1000) * 1000);
  } finally {
    stopListening();
    setBpm(previousBpm);
    await reset();
  }

  const result = scoreSimple(notes, detected, thresholds);
  printSummary(result, { noteDur });
  return { notes, detected, ...result };
}

export const executarBenchmarkSimples = runSimpleBenchmark;
