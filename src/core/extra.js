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

export function randomChord(arg1, arg2, arg3) {
  let size = 4;
  let range = midPitch;
  let microtonal = false;

  if (typeof arg1 === "object" && arg1 !== null && !Array.isArray(arg1)) {
    size = arg1.size ?? size;
    range = arg1.range ?? range;
    microtonal = arg1.microtonal ?? microtonal;
  } else {
    if (arg1 !== undefined) size = arg1;
    if (arg2 !== undefined) range = arg2;
    if (arg3 !== undefined) microtonal = arg3;
  }
  let notes = new Set();
  let maxAttempts = range != midPitch ? 36 : 24;

  let attempts = 0;
  let getPitch;

  while (notes.size < size && attempts < maxAttempts) {
    if (microtonal === false) {
      getPitch = Math.round(range());
    } else {
      getPitch = range();
    }
    notes.add(getPitch);
    attempts++;
  }

  return Array.from(notes).sort((a, b) => a - b);
}

export function blockChord(eventInput, arg2) {
  let chord = randomChord();
  if (typeof arg2 === "object" && arg2 !== null && !Array.isArray(arg2)) {
    chord = arg2.chord ?? chord;
  } else {
    if (arg2 !== undefined) chord = arg2;
  }
  const [what, howLoud, when, howLong, onSomething] = resolveEvent(eventInput);
  let l = eventList.create();
  for (let i of chord) {
    l.add([i, howLoud, when, howLong, onSomething]);
  }
  return l;
}

export function arpeggio(eventInput, arg2, arg3, arg4) {
  let noteList = randomChord();
  let repetitions = 1;
  let direction = "backAndForth";
  let l = eventList.create();

  if (typeof arg2 === "object" && arg2 !== null && !Array.isArray(arg2)) {
    noteList = arg2.noteList ?? noteList;
    repetitions = arg2.repetitions ?? repetitions;
    direction = arg2.direction ?? direction;
  } else {
    if (arg2 !== undefined) noteList = arg2;
    if (arg3 !== undefined) repetitions = arg3;
    if (arg4 !== undefined) direction = arg4;
  }

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

  for (let i = 0; i < repetitions; i++) {
    for (let note of notesToPlay) {
      l.add([note, howLoud, currentTime, howLong, onSomething]);
      currentTime += howLong;
    }
  }
  return l;
}

export function intervalSequence(eventInput, arg2, arg3, arg4) {
  let interval = rndInt(1, 11);
  let repetitions = 5;
  let direction = choose("up", "down");
  let l = eventList.create();

  if (typeof arg2 === "object" && arg2 !== null && !Array.isArray(arg2)) {
    interval = arg2.interval ?? interval;
    repetitions = arg2.repetitions ?? repetitions;
    direction = arg2.direction ?? direction;
  } else {
    if (arg2 !== undefined) interval = arg2;
    if (arg3 !== undefined) repetitions = arg3;
    if (arg4 !== undefined) direction = arg4;
  }

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

export function faster(eventInput, arg2, arg3) {
  let lastDuration = 0.1;
  let steps = 10;

  if (typeof arg2 === "object" && arg2 !== null && !Array.isArray(arg2)) {
    lastDuration = arg2.lastDuration ?? lastDuration;
    steps = arg2.steps ?? steps;
  } else {
    if (arg2 !== undefined) lastDuration = arg2;
    if (arg3 !== undefined) steps = arg3;
  }

  return changeTempo(eventInput, lastDuration, steps);
}

export function slower(eventInput, arg2, arg3) {
  let lastDuration = 2;
  let steps = 10;

  if (typeof arg2 === "object" && arg2 !== null && !Array.isArray(arg2)) {
    lastDuration = arg2.lastDuration ?? lastDuration;
    steps = arg2.steps ?? steps;
  } else {
    if (arg2 !== undefined) lastDuration = arg2;
    if (arg3 !== undefined) steps = arg3;
  }

  return changeTempo(eventInput, lastDuration, steps);
}

function changeTempo(eventInput, lastDuration = 1, steps = 10) {
  let l = eventList.create();
  const [what, howLoud, when, howLong, onSomething] = resolveEvent(eventInput);
  l.add([what, howLoud, when, howLong, onSomething]);
  let nextDuration = howLong;
  let nextWhen = when;
  let diff = howLong - lastDuration;
  let stepSize = diff / steps;

  if (steps <= 0) {
    return l;
  } else {
    for (let i = 0; i < steps; i++) {
      nextDuration -= stepSize;
      nextWhen += nextDuration;
      let currentEvent = [what, howLoud, nextWhen, nextDuration, onSomething];
      l.add(currentEvent);
    }
    return l;
  }
}

export function louder(eventInput, arg2, arg3) {
  let lastAmp = 1;
  let steps = 10;
  if (typeof arg2 === "object" && arg2 !== null && !Array.isArray(arg2)) {
    lastAmp = arg2.lastAmp ?? lastAmp;
    steps = arg2.steps ?? steps;
  } else {
    if (arg2 !== undefined) lastAmp = arg2;
    if (arg3 !== undefined) steps = arg3;
  }
  return changeLoudness(eventInput, lastAmp, steps);
}

export function softer(eventInput, arg2, arg3) {
  let lastAmp = 0.1;
  let steps = 10;
  if (typeof arg2 === "object" && arg2 !== null && !Array.isArray(arg2)) {
    lastAmp = arg2.lastAmp ?? lastAmp;
    steps = arg2.steps ?? steps;
  } else {
    if (arg2 !== undefined) lastAmp = arg2;
    if (arg3 !== undefined) steps = arg3;
  }
  return changeLoudness(eventInput, lastAmp, steps);
}

function changeLoudness(eventInput, last = 1, steps = 10) {
  let l = eventList.create();
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

export function ostinato(eventInput, arg2, arg3) {
  let repetitions = 1;
  let rhythm;
  const [what, howLoud, when, howLong, onSomething] = resolveEvent(eventInput);

  if (typeof arg2 === "object" && arg2 !== null && !Array.isArray(arg2)) {
    repetitions = arg2.repetitions ?? repetitions;
    rhythm = arg2.rhythm ?? rhythm;
  } else {
    if (arg2 !== undefined) repetitions = arg2;
    if (arg3 !== undefined) rhythm = arg3;
  }

  const durations = rhythm || [howLong];
  const resolvePitch = (val) => (typeof val === "function" ? val() : val);
  const firstPitch = resolvePitch(what);
  let l = eventList.create([what, howLoud, when, howLong, onSomething]);
  let initialTime = when;

  for (let i = 0, len = repetitions; i < len; i++) {
    for (let j of durations) {
      initialTime += j;
      const currentPitch = resolvePitch(what);
      l.add([currentPitch, howLoud, initialTime, howLong, onSomething]);
    }
  }
  return l;
}

export function euclidean(eventInput, arg2, arg3, arg4, arg5) {
  let repetitions = 1;
  let steps = rnd(4, 12);
  let hits = steps - rnd(1, 3);
  let rotation = 0;
  let a = [];
  let l = eventList.create();

  if (typeof arg2 === "object" && arg2 !== null && !Array.isArray(arg2)) {
    repetitions = arg2.repetitions ?? repetitions;
    steps = arg2.steps ?? steps;
    hits = arg2.hits ?? hits;
    rotation = arg2.rotation ?? rotation;
  } else {
    if (arg2 !== undefined) repetitions = arg2;
    if (arg3 !== undefined) steps = arg3;
    if (arg4 !== undefined) hits = arg4;
    if (arg5 !== undefined) rotation = arg5;
  }

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

export function rotationSequence(eventInput, arg2) {
  let rhythm;
  const [what, howLoud, when, howLong, onSomething] = resolveEvent(eventInput);

  if (typeof arg2 === "object" && arg2 !== null && !Array.isArray(arg2)) {
    rhythm = arg2.rhythm ?? rhythm;
  } else {
    if (arg2 !== undefined) rhythm = arg2;
  }

  const l = eventList.create();
  let currentTime = when;
  let durations = rhythm || [howLong];
  let currentPattern = [...durations];

  for (let i = 0; i < durations.length; i++) {
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

export function autoPan(onSomething, arg2) {
  let hertz = 1;
  if (typeof arg2 === "object" && arg2 !== null && !Array.isArray(arg2)) {
    hertz = arg2.hertz ?? hertz;
  } else {
    if (arg2 !== undefined) hertz = arg2;
  }

  if (onSomething.panInterval) {
    clearInterval(onSomething.panInterval);
  }
  onSomething.panInterval = setInterval(() => {
    let timeInSeconds = Date.now() / 1000;
    let panValue = Math.sin((timeInSeconds / hertz) * Math.PI * 2);
    onSomething.pan(panValue);
  }, 10);
}

export function glissando(eventInput) {
  let targetPitch = 60;
  if (typeof arg2 === "object" && arg2 !== null && !Array.isArray(arg2)) {
    targetPitch = arg2.targetPitch ?? targetPitch;
  } else {
    if (arg2 !== undefined) targetPitch = arg2;
  }

  let [startPitch, howLoud, when, howLong, onSomething] =
    resolveEvent(eventInput);
  onSomething.play(eventInput);
  const durationMs = howLong * 1000;
  const startTime = performance.now();

  function runGlissandoLoop() {
    const elapsedTime = performance.now() - startTime;
    let progress = elapsedTime / durationMs;
    if (progress > 1) progress = 1;
    const currentPitch = startPitch + (targetPitch - startPitch) * progress;
    const bendOffset = currentPitch - startPitch;
    onSomething.bend(bendOffset);
    if (progress < 1) {
      setTimeout(runGlissandoLoop, 10);
    }
  }
  runGlissandoLoop();
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
