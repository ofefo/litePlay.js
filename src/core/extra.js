function resolveEvent(input) {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return [
      input.what ?? input.oque ?? input.oQue ?? 60,
      input.howLoud ?? input.intensidade ?? 1,
      input.when ?? input.quando ?? 0,
      input.howLong ?? input.duração ?? 1,
      input.onSomething ?? input.noQue ?? (window.piano || 1),
    ];
  }
  if (typeof input === "number") {
    return [input, 1, 0, 1, window.piano || 1];
  }
  if (Array.isArray(input) && input.length > 0) {
    return [
      input[0] ?? 60,
      input[1] ?? 1,
      input[2] ?? 0,
      input[3] ?? 1,
      input[4] ?? (window.piano || 1),
    ];
  }
  return [60, 1, 0, 1, window.piano || 1];
}

export function midiToName(midiValue) {
  if (midiValue < 0 || midiValue > 127)
    return console.log("Pitch out of bounds (0-127).");
  const pitchClasses = [
    "C",
    "Cs",
    "D",
    "Eb",
    "E",
    "F",
    "Fs",
    "G",
    "Ab",
    "A",
    "Bb",
    "B",
  ];
  let pitch = pitchClasses[midiValue % 12];
  let octave = Math.floor(midiValue / 12) - 1;
  let octaveName = octave === -1 ? "-1" : octave;
  let name = pitch + octaveName;
  return name;
}

export function transpose(melody = [], semitones = 0) {
  return melody.map((note) => note + semitones);
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

export function blockChord(chord, eventInput) {
  const [what, howLoud, when, howLong, instrument] = resolveEvent(eventInput);
  let l = eventList.create();
  for (let i of chord) {
    l.add([i, howLoud, when, howLong, instrument]);
  }
  return l;
}

export function arpeggio(
  eventInput,
  noteList = randomChord(),
  repeats = 1,
  direction = "backAndForth",
  l = eventList.create(),
) {
  const [what, howLoud, when, howLong, instrument] = resolveEvent(eventInput);
  let currentTime = when;
  let notesToPlay = [];

  if (direction === "forward" || direction === "normal") {
    notesToPlay = [...noteList];
  } else if (direction === "backward" || direction === "inversa") {
    notesToPlay = [...noteList].reverse();
  } else if (
    direction === "backAndForth" ||
    direction === "bidirectional" ||
    direction === "vaiVolta"
  ) {
    const downNotes = [...noteList].reverse().slice(1, -1);
    notesToPlay = [...noteList, ...downNotes];
  } else {
    notesToPlay = [...noteList];
  }

  for (let i = 0; i < repeats; i++) {
    for (let note of notesToPlay) {
      l.add([note, howLoud, currentTime, howLong, instrument]);
      currentTime += howLong;
    }
  }
  return l;
}

export function intervalSequence(
  eventInput,
  interval = rndInt(1, 11),
  repetitions = 5,
  up = choose(true, false),
  l = eventList.create(),
) {
  const [note, howLoud, when, howLong, instrument] = resolveEvent(eventInput);

  if (!repetitions) {
    return l;
  } else {
    const currentEvent = [note, howLoud, when, howLong, instrument];
    l.add(currentEvent);

    let nextNote = up ? note + interval : note - interval;
    let nextWhen = when + howLong;
    const nextEvent = [nextNote, howLoud, nextWhen, howLong, instrument];

    return intervalSequence(nextEvent, interval, repetitions - 1, up, l);
  }
}

export function invert(melody = [], axis = C4) {
  return melody.map((note) => axis + ((((axis - note) % 12) + 12) % 12));
}

export function tempoVariation(
  eventInput,
  steps = 10,
  ratio = 0.9,
  l = eventList.create(),
) {
  const [what, howLoud, when, howLong, instrument] = resolveEvent(eventInput);

  if (steps <= 0) {
    return l;
  } else {
    const currentEvent = [what, howLoud, when, howLong, instrument];
    l.add(currentEvent);

    const nextDuration = howLong * ratio;
    const nextWhen = when + howLong;

    return tempoVariation(
      [what, howLoud, nextWhen, nextDuration, instrument],
      steps - 1,
      ratio,
      l,
    );
  }
}

export function ampVariation(
  eventInput,
  last = 1,
  steps = 2,
  l = eventList.create(),
) {
  const [what, howLoud, when, howLong, instrument] = resolveEvent(eventInput);
  let first = howLoud;

  if (!steps) {
    return l;
  } else {
    let howLoudStep = (last - first) / steps;
    let currentEvent = [what, first, when, howLong, instrument];
    l.add(currentEvent);

    let nextEvent = [
      what,
      first + howLoudStep,
      when + howLong,
      howLong,
      instrument,
    ];
    return ampVariation(nextEvent, last, steps - 1, l);
  }
}

export function retrograde(list) {
  return list.reverse();
}

export function rotate(list, steps = 1) {
  return list.map((note, index, arr) => {
    let newIndex = (index + steps) % arr.length;
    if (newIndex < 0) newIndex += arr.length;
    return arr[newIndex];
  });
}

export function ostinato(eventInput, repetitions = 1, rhythmList) {
  const [what, howLoud, when, howLong, instrument] = resolveEvent(eventInput);
  const rhythms = rhythmList || [howLong];
  const resolvePitch = (val) => (typeof val === "function" ? val() : val);
  const firstPitch = resolvePitch(what);
  const l = eventList.create([firstPitch, howLoud, when, howLong, instrument]);
  let initialTime = when;

  for (let i = 0, len = repetitions; i < len; i++) {
    for (let j of rhythms) {
      initialTime += j;
      const currentPitch = resolvePitch(what);
      l.add([currentPitch, howLoud, initialTime, howLong, instrument]);
    }
  }
  return l;
}

export function rotationSequence(eventInput, rhythmList) {
  const [what, howLoud, when, howLong, instrument] = resolveEvent(eventInput);

  const l = eventList.create();
  let currentTime = when;
  let rhythms = rhythmList || [howLong];
  let currentPattern = [...rhythms];

  for (let i = 0; i < rhythms.length; i++) {
    for (let dur of currentPattern) {
      l.add([what, howLoud, currentTime, dur, instrument]);
      currentTime += dur;
    }
    currentPattern = rotate(currentPattern, 1);
  }
  return l;
}

export function blend(listA, listB) {
  let listC = [];
  let size = Math.max(listA.length, listB.length);
  for (let i = 0; i < size; i++) {
    listC.push(listA[i % listA.length]);
    listC.push(listB[i % listB.length]);
  }
  return listC;
}

export function autoPan(instrument, hertz) {
  if (instrument.panInterval) {
    clearInterval(instrument.panInterval);
  }

  instrument.panInterval = setInterval(() => {
    let timeInSeconds = Date.now() / 1000;
    let panValue = Math.sin((timeInSeconds / hertz) * Math.PI * 2);
    instrument.pan(panValue);
  }, 30);
}

// portuguese aliases
export const midiParaNome = midiToName;
export const transpôr = transpose;
export const acordeAleatório = randomChord;
export const arpejo = arpeggio;
export const sequênciaIntervalar = intervalSequence;
export const inverter = invert;
export const variarTempo = tempoVariation;
export const variarAmplitude = ampVariation;
export const retrogradar = retrograde;
export const rotacionar = rotate;
export const sequenciaRotacao = rotationSequence;
export const misturar = blend;
export const espacializador = autoPan;
