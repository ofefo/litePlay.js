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
  [what = 60, howLoud = 0.9, when = 0, howLong = 0.25, instrument = piano] = [],
  noteList = randomChord(),
  repeats = 1,
  direction = "upDown",
  l = eventList.create(),
) {
  let currentTime = when;
  let notesToPlay = [];

  if (direction === "up") {
    notesToPlay = [...noteList];
  } else if (direction === "down") {
    notesToPlay = [...noteList].reverse();
  } else if (
    direction === "up and down" ||
    direction === "upDown" ||
    direction === "upAndDown" ||
    direction === "updown"
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
  [
    note = midPitch(),
    howLoud = 0.9,
    when = 0,
    howLong = 0.25,
    instrument = piano,
  ] = [],
  interval = rndInt(1, 11),
  repetitions = 5,
  up = choose(true, false),
  l = eventList.create(),
) {
  if (!repetitions) {
    return l;
  } else {
    const currentEvent = [note, howLoud, when, howLong, instrument];
    l.add(currentEvent);
    let nextNote;
    if (up) {
      nextNote = note + interval;
    } else {
      nextNote = note - interval;
    }
    let nextWhen = when + howLong;
    const nextEvent = [nextNote, howLoud, nextWhen, howLong, instrument];
    return intervalSequence(nextEvent, interval, repetitions - 1, up, l);
  }
}

export function invert(melody = [], axis = C4) {
  return melody.map((note) =>
    midiToName(axis + ((((axis - note) % 12) + 12) % 12)),
  );
}

export function tempoVariation(
  [what = 60, howLoud = 0.9, when = 0, howLong = 1, instrument = piano] = [],
  steps = 10,
  ratio = 0.9,
  l = eventList.create(),
) {
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
  [what = 60, howLoud = 0.1, when = 0, howLong = 1, instrument = piano] = [],
  last = 1,
  steps = 2,
  l = eventList.create(),
) {
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
  return list.map((item, index, arr) => {
    let oppositeIndex = arr.length - 1 - index;
    return arr[oppositeIndex];
  });
}

export function rotate(list, steps = 1) {
  return list.map((note, index, arr) => {
    let newIndex = (index + steps) % arr.length;
    if (newIndex < 0) newIndex += arr.length;
    return arr[newIndex];
  });
}

export function rotationSequence(
  [what = 60, howLoud = 0.9, when = 0, howLong = 1, instrument = piano] = [],
  howLongList,
) {
  const l = eventList.create();
  let currentTime = when;
  let currentPattern = [...howLongList];
  for (let i = 0; i < howLongList.length; i++) {
    for (let dur of currentPattern) {
      l.add([what, howLoud, currentTime, dur, instrument]);
      currentTime += dur;
    }
    currentPattern = rotate(currentPattern, 1);
  }
  return l;
}

export function tangle(listA, listB) {
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
export const transpor = transpose;
export const acordeAleatorio = randomChord;
export const arpejo = arpeggio;
export const sequenciaIntervalar = intervalSequence;
export const inverter = invert;
export const variarTempo = tempoVariation;
export const variarAmplitude = ampVariation;
export const retrogradar = retrograde;
export const rotacionar = rotate;
export const sequenciaRotacao = rotationSequence;
export const misturar = tangle;
export const panAutomatico = autoPan;
