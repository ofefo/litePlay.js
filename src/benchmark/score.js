export const DEFAULT_SIMPLE_THRESHOLDS = {
  pitchCents: 50,
  onsetMs: 50,
  matchWindowMs: 200,
};

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function meanAbs(values) {
  if (values.length === 0) return null;
  return mean(values.map((value) => Math.abs(value)));
}

function maxAbs(values) {
  if (values.length === 0) return null;
  return Math.max(...values.map((value) => Math.abs(value)));
}

export function scoreSimple(expected, detected, thresholds = {}) {
  const options = { ...DEFAULT_SIMPLE_THRESHOLDS, ...thresholds };
  const matchWindowSeconds = options.matchWindowMs / 1000;
  const heard = detected.filter((event) => event[0] >= 0);
  const candidates = [];

  expected.forEach((note, expectedIndex) => {
    heard.forEach((event, detectedIndex) => {
      const distance = Math.abs(event[2] - note.when);
      if (distance <= matchWindowSeconds) {
        candidates.push({ expectedIndex, detectedIndex, distance });
      }
    });
  });

  candidates.sort((a, b) => a.distance - b.distance);

  const expectedToDetected = new Map();
  const detectedToExpected = new Map();

  for (const candidate of candidates) {
    if (expectedToDetected.has(candidate.expectedIndex)) continue;
    if (detectedToExpected.has(candidate.detectedIndex)) continue;
    expectedToDetected.set(candidate.expectedIndex, candidate.detectedIndex);
    detectedToExpected.set(candidate.detectedIndex, candidate.expectedIndex);
  }

  const rows = expected.map((note, expectedIndex) => {
    const detectedIndex = expectedToDetected.get(expectedIndex);
    if (detectedIndex === undefined) {
      return {
        index: expectedIndex,
        expected: note,
        detected: null,
        pitchErrorCents: null,
        onsetErrorMs: null,
        durationErrorMs: null,
        matched: false,
        passed: false,
      };
    }

    const event = heard[detectedIndex];
    const pitchErrorCents = (event[0] - note.pitch) * 100;
    const onsetErrorMs = (event[2] - note.when) * 1000;
    const durationErrorMs = (event[3] - note.dur) * 1000;

    return {
      index: expectedIndex,
      expected: note,
      detected: event,
      pitchErrorCents,
      onsetErrorMs,
      durationErrorMs,
      matched: true,
      passed:
        Math.abs(pitchErrorCents) <= options.pitchCents &&
        Math.abs(onsetErrorMs) <= options.onsetMs,
    };
  });

  const extras = heard
    .map((event, index) => ({ index, event }))
    .filter(({ index }) => !detectedToExpected.has(index));
  const matchedRows = rows.filter((row) => row.matched);
  const pitchErrors = matchedRows.map((row) => row.pitchErrorCents);
  const onsetErrors = matchedRows.map((row) => row.onsetErrorMs);
  const durations = heard.map((event) => event[3] * 1000);
  const loudness = heard.map((event) => event[1]);

  return {
    rows,
    extras,
    summary: {
      expected: expected.length,
      detected: heard.length,
      matched: matchedRows.length,
      passed: rows.filter((row) => row.passed).length,
      missed: rows.filter((row) => !row.matched).length,
      extra: extras.length,
      pitch: {
        meanAbsCents: meanAbs(pitchErrors),
        maxAbsCents: maxAbs(pitchErrors),
      },
      onset: {
        meanAbsMs: meanAbs(onsetErrors),
        maxAbsMs: maxAbs(onsetErrors),
      },
      duration: {
        meanMs: mean(durations),
      },
      loudness: {
        mean: mean(loudness),
      },
    },
  };
}
