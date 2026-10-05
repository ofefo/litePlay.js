// System Variables
let essentia = null;
let essentiaLoadPromise = null;
async function getEssentia() {
  if (!essentia) {
    if (!essentiaLoadPromise) {
      essentiaLoadPromise = (async () => {
        const { default: Essentia } = await import(
          "https://unpkg.com/essentia.js@0.1.3/dist/essentia.js-core.es.min.js"
        );
        const { EssentiaWASM } = await import(
          "https://unpkg.com/essentia.js@0.1.3/dist/essentia-wasm.es.js"
        );
        essentia = new Essentia(EssentiaWASM);
      })();
    }
    await essentiaLoadPromise;
  }
  return essentia;
}
let isListening = false;
let workletNode = null;
let micSource = null;
let analysisSource = null;
let keepAliveNode = null;

// Analysis State
let isSounding = false;
const onsetThreshold = 0.05;
const durationThreshold = 0.02;
let eventOnset = 0;
let phraseOnset = 0;
let framePitches = [];
let frameLoudness = [];
let currentPhrase = [];
let lastNoteEndTime = 0;
let recentPauses = [];
let silenceThreshold = 0.5;

// Global Exposes
window.allEvents = [];
window.lastEvent = [];
window.lastMelody = [];
window.lastRhythm = [];
window.lastOnsetTimes = [];
window.lastAmps = [];
window.lastPhrase = [];

let micStream = null;

// Toggles the machine listening state
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

  await getEssentia();

  try {
    // Define worklet
    await audioCtx.audioWorklet.addModule("./src/listener/processor.js");

    if (options.node) {
      // Analyse a graph node directly. Avoids the same-context MediaStream
      // round trip, which stalls the render callback in some browsers.
      analysisSource = options.node;
    } else {
      let stream = options.stream;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });
        micStream = stream;
      }
      micSource = audioCtx.createMediaStreamSource(stream);
      analysisSource = micSource;
    }

    workletNode = new AudioWorkletNode(audioCtx, "audio-capture-processor");

    // Central audio processing hub
    workletNode.port.onmessage = (event) => {
      // The worklet reports the frame position it captured. Timestamping on
      // `audioCtx.currentTime` instead would charge the listener a full
      // analysis window of latency that belongs to this transport rather than
      // to the detector.
      const { samples, frame } = event.data;
      const captureSec =
        typeof frame === "number"
          ? frame / audioCtx.sampleRate
          : audioCtx.currentTime;

      const vectorData = essentia.arrayToVector(samples);
      const rms = essentia.RMS(vectorData).rms;
      const currentTime = captureSec;

      if (rms > onsetThreshold) {
        handleSoundingFrame(vectorData, rms, currentTime);
      } else {
        handleSilentFrame(currentTime, onEventDetected);
      }
    };

    analysisSource.connect(workletNode);

    // The processor writes nothing to its output, so a muted sink guarantees
    // it stays pulled by the graph even when nothing else consumes it.
    keepAliveNode = audioCtx.createGain();
    keepAliveNode.gain.value = 0;
    workletNode.connect(keepAliveNode);
    keepAliveNode.connect(audioCtx.destination);

    isListening = true;
    return true;
  } catch (err) {
    console.error("Machine Listening error:", err);
    return false;
  }
}

// is Sounding
function handleSoundingFrame(vectorData, rms, currentTime) {
  if (!isSounding) {
    triggerNoteOn(currentTime);
  }
  extractFeatures(vectorData, rms);
}

// is Silent
function handleSilentFrame(currentTime, onEventDetected) {
  if (isSounding) {
    triggerNoteOff(currentTime, onEventDetected);
  } else {
    checkPhraseCompletion(currentTime);
  }
}

// Sub-Routines
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
  }

  lastNoteEndTime = currentTime;
}

function extractFeatures(vectorData, rms) {
  const spectrum = essentia.Spectrum(vectorData).spectrum;
  const pitchInfo = essentia.PitchYinFFT(spectrum);

  if (pitchInfo.pitchConfidence > 0.8) {
    framePitches.push(pitchInfo.pitch);
  }
  frameLoudness.push(rms);
}

function updateSilenceThreshold(currentTime) {
  const pauseDuration = currentTime - lastNoteEndTime;
  recentPauses.push(pauseDuration);

  if (recentPauses.length > 10) recentPauses.shift();

  const avgPause =
    recentPauses.reduce((a, b) => a + b, 0) / recentPauses.length;
  silenceThreshold = Math.max(0.5, Math.min(avgPause * 1.5, 2));
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
    const logText = `> Phrase grouped: ${window.lastMelody.length} events. (Threshold: ${silenceThreshold.toFixed(2)}s)\n`;
    const arrayText =
      `Melody: ${JSON.stringify(window.lastMelody)}\n` +
      `Amps:   ${JSON.stringify(window.lastAmps)}\n` +
      `Rhythm: ${JSON.stringify(window.lastRhythm)}\n\n`;
    mlConsole.value += logText + arrayText;
    mlConsole.scrollTop = mlConsole.scrollHeight;
  }
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

const normAmp = (loudnesses) => {
  if (!loudnesses || loudnesses.length === 0) return 0;
  const peakRms = Math.max(...loudnesses);
  if (peakRms <= 0) return 0;
  const db = 20 * Math.log10(peakRms);
  const minDb = -50; // Noise floor becomes 0.0
  const maxDb = -10; // Maximum instrument volume becomes 1.0
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

  const avgCents =
    kept.reduce((a, b) => a + b, 0) / kept.length;

  return parseFloat((avgCents / 100).toFixed(2));
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

export function stopListening() {
  if (micSource) {
    try {
      micSource.disconnect();
    } catch (e) {}
    micSource = null;
  }
  if (analysisSource) {
    try {
      if (workletNode) analysisSource.disconnect(workletNode);
    } catch (e) {}
    analysisSource = null;
  }
  if (workletNode) {
    try {
      workletNode.disconnect();
    } catch (e) {}
    workletNode = null;
  }
  if (keepAliveNode) {
    try {
      keepAliveNode.disconnect();
    } catch (e) {}
    keepAliveNode = null;
  }
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  isListening = false;
  isSounding = false;
  essentia = null;
  essentiaLoadPromise = null;
}

// Portuguese aliases
export const ativarEscuta = toggleListening;
export const pararEscuta = stopListening;
