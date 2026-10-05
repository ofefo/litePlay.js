import { csound } from "../core/litePlay.js";

// System state
let isListening = false;
let analysisInstrStarted = false;
let isSounding = false;
const durationThreshold = 0.02;
let eventOnset = 0;
let phraseOnset = 0;
let framePitches = [];
let frameLoudness = [];
let currentPhrase = [];
let lastNoteEndTime = 0;
let recentPauses = [];
let silenceThreshold = 1.5;
let pollIntervalId = null;
let phraseCheckIntervalId = null;
let pollInFlight = false;

// Csound channel tracking
let lastOnsetTrig = 0;
let lastOffsetTrig = 0;

// instr 99 reports timeinsts(), which counts from the moment the analysis
// instrument was started. This is the audio clock reading at that same
// moment, so subtracting it maps engine time onto audio_context.currentTime.
let timeOrigin = 0;

// Onsets that arrived faster than the poll interval could resolve separately.
export let collapsedOnsets = 0;

export function resetCollapsedOnsets() {
  collapsedOnsets = 0;
}

// Global exposes
window.allEvents = [];
window.lastEvent = [];
window.lastMelody = [];
window.lastRhythm = [];
window.lastOnsetTimes = [];
window.lastAmps = [];
window.lastPhrase = [];

let micStream = null;
let inputSourceNode = null;
let feedbackDelayNode = null;
let feedbackGainNode = null;

export async function toggleListening(audioCtx, arg2, arg3) {
  let onEventDetected = null;
  let options = {};

  if (typeof arg2 === "object" && arg2 !== null && !Array.isArray(arg2)) {
    options = arg2;
    if (typeof arg3 === "function") onEventDetected = arg3;
  } else {
    if (typeof arg2 === "function") onEventDetected = arg2;
    if (typeof arg3 === "object" && arg3 !== null && !Array.isArray(arg3))
      options = arg3;
  }

  const {
    fastAtt = 0.01,
    fastRel = 0.05,
    slowAtt = 0.1,
    slowRel = 0.3,
    thresh = 0.005,
    noiseFloor = 0.002,
    holdTime = 0.05,
  } = options;

  if (!csound) {
    console.error("Csound engine not ready. Start litePlay first.");
    return false;
  }

  // Update parameters even if already listening
  csound.setControlChannel("listenerFastAtt", fastAtt);
  csound.setControlChannel("listenerFastRel", fastRel);
  csound.setControlChannel("listenerSlowAtt", slowAtt);
  csound.setControlChannel("listenerSlowRel", slowRel);
  csound.setControlChannel("listenerThresh", thresh);
  csound.setControlChannel("listenerNoiseFloor", noiseFloor);
  csound.setControlChannel("listenerHoldTime", holdTime);

  if (isListening) return true;

  try {
    const csoundNode = await csound.getNode();

    if (inputSourceNode) {
      try {
        inputSourceNode.disconnect();
      } catch (e) {}
      inputSourceNode = null;
    }
    if (feedbackDelayNode) {
      try {
        feedbackDelayNode.disconnect();
      } catch (e) {}
      feedbackDelayNode = null;
    }
    if (feedbackGainNode) {
      try {
        feedbackGainNode.disconnect();
      } catch (e) {}
      feedbackGainNode = null;
    }

    if (options.node) {
      // Feed a graph node straight into Csound's input. Web Audio only allows a
      // cycle when it contains a DelayNode, so route it through a one render
      // quantum delay. Going through the node avoids the same-context
      // MediaStream round trip, which stalls the render callback in some browsers.
      feedbackGainNode = audioCtx.createGain();
      feedbackGainNode.gain.value = 1;
      feedbackDelayNode = audioCtx.createDelay(1);
      feedbackDelayNode.delayTime.value = 128 / audioCtx.sampleRate;
      options.node.connect(feedbackGainNode);
      feedbackGainNode.connect(feedbackDelayNode);
      feedbackDelayNode.connect(csoundNode);
    } else {
      let stream = options.stream;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        micStream = stream;
      }
      inputSourceNode = audioCtx.createMediaStreamSource(stream);
      inputSourceNode.connect(csoundNode);
    }

    if (!analysisInstrStarted) {
      timeOrigin = audioCtx.currentTime;
      csound.inputMessage("i 99 0 -1");
      analysisInstrStarted = true;
    }

isListening = true;
  lastOnsetTrig = 0;
  lastOffsetTrig = 0;
  collapsedOnsets = 0;
  pollInFlight = false;

    pollIntervalId = setInterval(() => {
      // getControlChannel round trips can outlast the interval. Without this
      // guard, slow polls overlap and interleave their trigger-counter reads.
      if (pollInFlight) return;
      pollInFlight = true;
      pollListener(onEventDetected).finally(() => {
        pollInFlight = false;
      });
    }, 10);
    phraseCheckIntervalId = setInterval(() => {
      if (!isSounding) checkPhraseCompletion(performance.now() / 1000);
    }, 100);

    return true;
  } catch (err) {
    console.error("Csound listener error:", err);
    return false;
  }
}

async function pollListener(onEventDetected) {
  const rms = await csound.getControlChannel("listenerRms");

  // Engine time counts from the analysis instrument's start. Shift it onto the
  // AudioContext clock so both listeners report a comparable time base.
  const engineTime = await csound.getControlChannel("listenerOnsetTime");
  const onsetTrig = await csound.getControlChannel("listenerOnsetTrig");
  if (onsetTrig > lastOnsetTrig) {
    // A jump of more than one means several onsets fell inside a single poll
    // interval. Only the latest carries a usable timestamp, so the extras are
    // counted rather than silently discarded: density losses must stay visible
    // instead of looking like clean silence.
    collapsedOnsets += onsetTrig - lastOnsetTrig - 1;
    lastOnsetTrig = onsetTrig;
    triggerNoteOn(engineTime - timeOrigin);
  }

  const offsetEngineTime = await csound.getControlChannel(
    "listenerOffsetTime",
  );
  const offsetTrig = await csound.getControlChannel("listenerOffsetTrig");
  if (offsetTrig > lastOffsetTrig) {
    lastOffsetTrig = offsetTrig;
    triggerNoteOff(offsetEngineTime - timeOrigin, onEventDetected);
  }

  if (isSounding) {
    frameLoudness.push(rms);
    const pitch = await csound.getControlChannel("listenerPitch");
    if (pitch > 20) framePitches.push(pitch);
  }
}

function triggerNoteOn(currentTime) {
  isSounding = true;
  eventOnset = currentTime;

  if (lastNoteEndTime > 0) {
    updateSilenceThreshold(currentTime);
  }
  if (currentPhrase.length === 0) {
    phraseOnset = eventOnset;
  }

  framePitches = [];
  frameLoudness = [];
}

function triggerNoteOff(currentTime, onEventDetected) {
  isSounding = false;
  const duration = currentTime - eventOnset;

  if (duration > durationThreshold) {
    const relativeOnsetTime = eventOnset - phraseOnset;
    const eventData = processEventData(
      framePitches,
      frameLoudness,
      relativeOnsetTime,
      duration,
    );

    saveEventData(eventData);
    if (onEventDetected) {
      // Second argument is additive: eventData keeps its phrase-relative shape
      // for existing callers, while absolute timings let a benchmark align
      // detections against ground truth.
      onEventDetected(eventData, {
        onsetTime: eventOnset,
        endTime: currentTime,
        duration,
        peakRms: frameLoudness.length
          ? Math.max(...frameLoudness)
          : 0,
      });
    }

    // Log individual note to ML console immediately
    const mlConsole = document.getElementById("ml-console");
    if (mlConsole) {
      mlConsole.value += `{what: ${eventData[0]}, howLoud: ${eventData[1]}, when: ${eventData[2]}, howLong: ${eventData[3]}\n`;
      mlConsole.scrollTop = mlConsole.scrollHeight;
    }
  }

  lastNoteEndTime = currentTime;
}

function processEventData(pitches, loudnesses, onsetTime, duration) {
  const avgLoudness = normAmp(loudnesses);

  return [
    robustPitchMidi(pitches),
    parseFloat(avgLoudness.toFixed(2)),
    parseFloat(onsetTime.toFixed(3)),
    parseFloat(duration.toFixed(3)),
  ];
}

const normAmp = (loudnesses) => {
  if (!loudnesses || loudnesses.length === 0) return 0;
  const peakRms = Math.max(...loudnesses);
  if (peakRms <= 0) return 0;
  const db = 20 * Math.log10(peakRms);
  const minDb = -50;
  const maxDb = -10;
  const normalized = (db - minDb) / (maxDb - minDb);
  return Math.max(0, Math.min(1, normalized));
};

// Pitch is logarithmic, so it must be averaged in cents (the geometric mean),
// never in Hz. Averaging Hz first biases the result upward and drags it toward
// outliers. Frames more than an octave away from the median are octave errors
// from the detector and are discarded before averaging.
const OCTAVE_CENTS = 1200;

function robustPitchMidi(pitches) {
  if (!pitches || pitches.length === 0) return 0;

  const cents = pitches
    .filter((hz) => hz > 0 && Number.isFinite(hz))
    .map((hz) => 1200 * Math.log2(hz / 440) + 6900);

  if (cents.length === 0) return 0;

  const sorted = [...cents].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const kept = cents.filter((c) => Math.abs(c - median) <= OCTAVE_CENTS);

  const avgCents = kept.reduce((a, b) => a + b, 0) / kept.length;

  return parseFloat((avgCents / 100).toFixed(2));
}

function saveEventData(eventData) {
  window.lastEvent = eventData;
  window.lastPitch = eventData[0];
  window.lastLoudness = eventData[1];
  window.lastOnsetTime = eventData[2];
  window.lastDur = eventData[3];

  window.allEvents.push(eventData);
  currentPhrase.push(eventData);
}

function updateSilenceThreshold(currentTime) {
  const pauseDuration = currentTime - lastNoteEndTime;
  recentPauses.push(pauseDuration);

  if (recentPauses.length > 10) recentPauses.shift();

  const avgPause =
    recentPauses.reduce((a, b) => a + b, 0) / recentPauses.length;
  silenceThreshold = Math.max(1.0, Math.min(avgPause * 1.5, 3));
}

function checkPhraseCompletion(currentTime) {
  if (currentPhrase.length === 0 || lastNoteEndTime === 0) return;

  const timeSinceLastNote = currentTime - lastNoteEndTime;
  if (timeSinceLastNote > silenceThreshold) {
    finalizePhrase();
  }
}

function finalizePhrase() {
  window.lastMelody = currentPhrase.map((event) => event[0]);
  window.lastAmps = currentPhrase.map((event) => event[1]);
  window.lastOnsetTimes = currentPhrase.map((event) => event[2]);
  window.lastRhythm = currentPhrase.map((event) => event[3]);
  window.lastPhrase = [...currentPhrase];

  currentPhrase = [];

  const mlConsole = document.getElementById("ml-console");
  if (mlConsole) {
    const logText = `Phrase: ${window.lastMelody.length} events.\n`;
    const arrayText =
      `lastMelody: ${JSON.stringify(window.lastMelody)}\n` +
      `lastAmps:   ${JSON.stringify(window.lastAmps)}\n` +
      `lastWhen: ${JSON.stringify(window.lastOnsetTimes)}\n` +
      `lastRhythm: ${JSON.stringify(window.lastRhythm)}\n\n`;
    mlConsole.value += logText + arrayText;
    mlConsole.scrollTop = mlConsole.scrollHeight;
  }
}

export function stopListening() {
  if (inputSourceNode) {
    try {
      inputSourceNode.disconnect();
    } catch (e) {}
    inputSourceNode = null;
  }
  if (feedbackGainNode) {
    try {
      feedbackGainNode.disconnect();
    } catch (e) {}
    feedbackGainNode = null;
  }
  if (feedbackDelayNode) {
    try {
      feedbackDelayNode.disconnect();
    } catch (e) {}
    feedbackDelayNode = null;
  }
  if (analysisInstrStarted) {
    csound.inputMessage("i -99 0 0.1");
    analysisInstrStarted = false;
  }
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  if (phraseCheckIntervalId) {
    clearInterval(phraseCheckIntervalId);
    phraseCheckIntervalId = null;
  }
  isListening = false;
  isSounding = false;
}

// Portuguese aliases
export const ativarEscuta = toggleListening;
export const pararEscuta = stopListening;
