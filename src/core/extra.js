export function midiToName(midiValue) {
  if (midiValue < 0 || midiValue > 127)
    return console.log("Pitch out of bounds (0-127).");
  const pitchClasses = [
    "C",
    "Cs",
    "D",
    "Ds/Eb",
    "E",
    "F",
    "Fs/Gb",
    "G",
    "Gs/Ab",
    "A",
    "As/Bb",
    "B",
  ];
  let pitch = pitchClasses[midiValue % 12];
  let octave = Math.floor(midiValue / 12) - 1;
  let octaveName = octave === -1 ? "-1" : octave;
  let name = pitch + octaveName;
  return name;
}

export function transpose(melody = [], semitones = 0) {
  return melody.map((note) => midiToName(note + semitones));
}

export function randomChord(
  size = 4,
  pitchGenerator = midPitch,
  microtonal = false,
) {
  let notes = new Set();
  let maxAttempts;
  if (pitchGenerator != midPitch) {
    maxAttempts = 36;
  } else {
    maxAttempts = 24;
  }
  let attempts = 0;
  let getPitch;

  while (notes.size < size && attempts < maxAttempts) {
    if (microtonal === false) {
      getPitch = Math.round(pitchGenerator());
    } else {
      getPitch = pitchGenerator();
    }
    notes.add(getPitch);
    attempts++;
  }

  return Array.from(notes).sort((a, b) => a - b);
}

export function arpeggio(
  chord = randomChord(),
  repetitions = 1,
  speed = 0.25,
  direction = "upAndDown",
  amp = 1,
  instrument = piano,
  onset = 0,
  l = eventList.create(),
) {
  if (repetitions <= 0) {
    l.play();
  } else {
    let pattern = [];
    if (direction === "down") {
      pattern = [...chord].reverse();
    } else if (direction === "upAndDown") {
      pattern = [...chord];
      for (let i = chord.length - 2; i > 0; i--) {
        pattern.push(chord[i]);
      }
    } else {
      // Default to "up"
      pattern = [...chord];
    }
    for (let i = 0; i < pattern.length; i++) {
      l.add([pattern[i], amp, onset, speed, instrument]);
      onset += speed;
    }
    arpeggio(
      chord,
      repetitions - 1,
      speed,
      direction,
      amp,
      instrument,
      onset,
      l,
    );
  }
}

export function intervalSequence(
  [
    note = midPitch(),
    amp = 0.9,
    when = 0,
    duration = 0.25,
    instrument = piano,
  ] = [],
  interval = rndInt(1, 11),
  repetitions = 5,
  up = true,
  l = eventList.create(),
) {
  if (!repetitions) {
    l.play();
  } else {
    const currentEvent = [note, amp, when, duration, instrument];
    l.add(currentEvent);
    let nextNote;
    if (up) {
      nextNote = note + interval;
    } else {
      nextNote = note - interval;
    }
    let nextWhen = when + duration;
    const nextEvent = [nextNote, amp, nextWhen, duration, instrument];
    intervalSequence(nextEvent, interval, repetitions - 1, up, l);
  }
}

export function invert(melody = [], axis = C4) {
  return melody.map((note) =>
    midiToName(axis + ((((axis - note) % 12) + 12) % 12)),
  );
}

export function tempoVariation(
  [what = 60, amp = 0.9, when = 0, duration = 1, instrument = piano] = [],
  steps = 10,
  ratio = 0.9,
  l = eventList.create(),
) {
  if (steps <= 0) {
    l.play();
  } else {
    const currentEvent = [what, amp, when, duration, instrument];
    l.add(currentEvent);

    const nextDuration = duration * ratio;
    const nextWhen = when + duration;

    tempoVariation(
      [what, amp, nextWhen, nextDuration, instrument],
      steps - 1,
      ratio,
      l,
    );
  }
}
