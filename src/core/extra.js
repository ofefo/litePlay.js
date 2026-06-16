function resolveEvent(input) {
  const parseInstr = (inst) => {
    let target = inst ?? (window.piano || 1);
    if (
      target &&
      typeof target === "object" &&
      typeof target.instr === "object" &&
      target.instr !== null
    ) {
      return target.instr;
    }

    return target;
  };

  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return [
      input.what ?? input.oque ?? input.oQue ?? 60,
      input.howLoud ?? input.intensidade ?? 0.5,
      input.when ?? input.quando ?? 0,
      input.howLong ?? input.duração ?? 1,
      parseInstr(input.onSomething ?? input.noQue),
    ];
  }

  if (typeof input === "number") {
    return [input, 1, 0, 1, parseInstr(null)];
  }

  if (Array.isArray(input) && input.length > 0) {
    return [
      input[0] ?? 60,
      input[1] ?? 0.5,
      input[2] ?? 0,
      input[3] ?? 1,
      parseInstr(input[4]),
    ];
  }

  return [60, 0.5, 0, 1, parseInstr(null)];
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

export function transpose(notes = [], interval = 0) {
  return notes.map((i) => i + interval);
}

export function edo(divisions) {
  const octave = 12;
  const interval = 12 / divisions;
  let tones = [0];
  for (let i = 0, len = octave; i < len; i = i + interval) {
    tones.push(i + interval);
  }
  return tones;
}

export function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function frequencyToMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}

export function justIntonation(baseNote = C4, size = 14) {
  const baseFreq = midiToFrequency(baseNote);
  let tones = [];
  for (let i = 1, len = size + 1; i < len; i++) {
    let nextHarmonic = i * baseFreq;
    tones.push(nextHarmonic);
  }
  let output = tones.map(
    (i) => ((frequencyToMidi(i) - baseNote) % 12) + baseNote,
  );
  output.push(baseNote + 12);
  output = output.map((i) => Number(i.toFixed(3)));
  return Array.from(new Set(output)).sort((a, b) => a - b);
}

export function monotone(initialTone = C4, interval = 1) {
  if (interval === Math.trunc(interval)) {
    return choose(
      initialTone,
      rndInt(initialTone - interval, initialTone + interval + 1),
    );
  } else {
    let output = choose(
      initialTone,
      rnd(initialTone - interval, initialTone + interval + 1),
    );
    output = Number(output.toFixed(3));
    return output;
  }
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
  const [what, howLoud, when, howLong, onSomething] = resolveEvent(eventInput);
  let l = eventList.create();
  for (let i of chord) {
    l.add([i, howLoud, when, howLong, onSomething]);
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
  const [what, howLoud, when, howLong, onSomething] = resolveEvent(eventInput);
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
      l.add([note, howLoud, currentTime, howLong, onSomething]);
      currentTime += howLong;
    }
  }
  return l;
}

export function intervalSequence(
  eventInput,
  interval = rndInt(1, 11),
  repetitions = 5,
  direction = choose("up", "down"),
  l = eventList.create(),
) {
  const [note, howLoud, when, howLong, onSomething] = resolveEvent(eventInput);
  l.add([note, howLoud, when, howLong, onSomething]);
  let currentPitch = note;
  let currentWhen = when;

  if (!repetitions) {
    return l;
  } else {
    for (let i = 0; i < repetitions; i++) {
      if (direction === "up") {
        currentPitch += interval;
      } else {
        currentPitch -= interval;
      }
      currentWhen += howLong;
      l.add([currentPitch, howLoud, currentWhen, howLong, onSomething]);
    }
    return l;
  }
}

export function invert(melody = [], axis = C4) {
  return melody.map((note) => axis + ((((axis - note) % 12) + 12) % 12));
}

export function faster(eventInput, steps = 10, ratio = 0.9) {
  return changeTempo(eventInput, steps, ratio);
}

export function slower(eventInput, steps = 10, ratio = 1.1) {
  return changeTempo(eventInput, steps, ratio);
}

function changeTempo(
  eventInput,
  steps = 10,
  ratio = 0.9,
  l = eventList.create(),
) {
  const [what, howLoud, when, howLong, onSomething] = resolveEvent(eventInput);
  l.add([what, howLoud, when, howLong, onSomething]);
  let nextDuration = howLong;
  let nextWhen = when;

  if (steps <= 0) {
    return l;
  } else {
    for (let i = 0; i < steps; i++) {
      nextDuration *= ratio;
      nextWhen += nextDuration;
      let currentEvent = [what, howLoud, nextWhen, nextDuration, onSomething];
      l.add(currentEvent);
    }
    return l;
  }
}

export function louder(eventInput, last = 1, steps = 10) {
  return changeLoudness(eventInput, last, steps);
}

export function softer(eventInput, last = 0.01, steps = 10) {
  return changeLoudness(eventInput, last, steps);
}

function changeLoudness(
  eventInput,
  last = 1,
  steps = 10,
  l = eventList.create(),
) {
  const [what, howLoud, when, howLong, onSomething] = resolveEvent(eventInput);
  l.add([what, howLoud, when, howLong, onSomething]);

  const ampStep = (last - howLoud) / steps;

  let nextWhen = when;
  let nextLoudness = howLoud;
  if (steps <= 0) {
    return l;
  } else {
    for (let i = 0; i < steps; i++) {
      nextWhen += howLong;
      nextLoudness += ampStep;
      nextLoudness = Math.round(nextLoudness * 1000) / 1000;
      l.add([what, nextLoudness, nextWhen, howLong, onSomething]);
    }
    return l;
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
  const [what, howLoud, when, howLong, onSomething] = resolveEvent(eventInput);
  const rhythms = rhythmList || [howLong];
  const resolvePitch = (val) => (typeof val === "function" ? val() : val);
  const firstPitch = resolvePitch(what);
  const l = eventList.create([what, howLoud, when, howLong, onSomething]);
  let initialTime = when;

  for (let i = 0, len = repetitions; i < len; i++) {
    for (let j of rhythms) {
      initialTime += j;
      const currentPitch = resolvePitch(what);
      l.add([currentPitch, howLoud, initialTime, howLong, onSomething]);
    }
  }
  return l;
}

export function euclidean(
  eventInput,
  repetitions = 1,
  steps = rnd(4, 12),
  hits = steps - rnd(1, 3),
  rotation = 0,
  a = [],
  l = eventList.create(),
) {
  if (hits > steps) {
    console.error("Number of hits cannot be greater than steps!");
  }
  const [what, howLoud, when, howLong, onSomething] = resolveEvent(eventInput);
  let currentTime = when;
  for (let rep = 0; rep < repetitions; rep++) {
    for (let i = 0; i < steps; i++) {
      let checkIndex = (i - rotation) % steps;
      if (checkIndex < 0) checkIndex += steps;
      const isHit = (checkIndex * hits) % steps < hits;
      if (isHit) {
        a.push(1);
        l.add([what, howLoud, currentTime, howLong, onSomething]);
      } else {
        a.push(0);
      }
      currentTime += howLong;
    }
  }
  a = a.slice(steps * -1);
  console.log(a);
  return l;
}

export function rotationSequence(eventInput, rhythmList) {
  const [what, howLoud, when, howLong, onSomething] = resolveEvent(eventInput);

  const l = eventList.create();
  let currentTime = when;
  let rhythms = rhythmList || [howLong];
  let currentPattern = [...rhythms];

  for (let i = 0; i < rhythms.length; i++) {
    for (let dur of currentPattern) {
      l.add([what, howLoud, currentTime, dur, onSomething]);
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

export function shuffle(list) {
  //Fisher–Yates shuffle
  for (let i = list.length - 1; i >= 1; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function autoPan(onSomething, hertz) {
  if (onSomething.panInterval) {
    clearInterval(onSomething.panInterval);
  }
  onSomething.panInterval = setInterval(() => {
    let timeInSeconds = Date.now() / 1000;
    let panValue = Math.sin((timeInSeconds / hertz) * Math.PI * 2);
    onSomething.pan(panValue);
  }, 10);
}

// portuguese aliases
export const midiParaNome = midiToName;
export const transpôr = transpose;
export const afinaçãoJusta = justIntonation;
export const frequênciaParaMidi = frequencyToMidi;
export const monótono = monotone;
export const acordeAleatório = randomChord;
export const arpejo = arpeggio;
export const sequênciaIntervalar = intervalSequence;
export const inverter = invert;
export const maisRápido = faster;
export const maisLento = slower;
export const maisForte = louder;
export const maisSuave = softer;
export const retrogradar = retrograde;
export const rotacionar = rotate;
export const sequenciaRotacao = rotationSequence;
export const euclideano = euclidean;
export const misturar = blend;
export const embaralhar = shuffle;
export const panAutomático = autoPan;
