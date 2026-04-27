import Essentia from "https://unpkg.com/essentia.js@0.1.3/dist/essentia.js-core.es.min.js";
import { EssentiaWASM } from "https://unpkg.com/essentia.js@0.1.3/dist/essentia-wasm.es.js";

// --- System Variables ---
let essentia = null;
let isListening = false;
let workletNode = null;
let micSource = null;

// --- Analysis State ---
const onsetThreshold = 0.02;
let isSounding = false;
let eventStartTime = 0;
let framePitches = [];
let frameLoudness = [];
let currentPhrase = [];
let lastNoteEndTime = 0;
let recentPauses = [];
let silenceThreshold = 0.5;

// --- Global Exposes ---
window.allEvents = [];
window.lastMelody = [];
window.lastEvent = [];

/**
 * Toggles the machine listening state.
 */
export async function toggleListening(audioCtx, onEventDetected) {
  if (isListening) {
    stopListening();
    return false;
  }

  if (!essentia) essentia = new Essentia(EssentiaWASM);

  try {
    await audioCtx.audioWorklet.addModule("./listener/processor.js");

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    micSource = audioCtx.createMediaStreamSource(stream);
    workletNode = new AudioWorkletNode(audioCtx, "audio-capture-processor");

    // Central audio processing hub
    workletNode.port.onmessage = (event) => {
      const vectorData = essentia.arrayToVector(event.data);
      const rms = essentia.RMS(vectorData).rms;
      const currentTime = audioCtx.currentTime;

      if (rms > onsetThreshold) {
        handleSoundingFrame(vectorData, rms, currentTime);
      } else {
        handleSilentFrame(currentTime, onEventDetected);
      }
    };

    micSource.connect(workletNode);
    isListening = true;
    return true;
  } catch (err) {
    console.error("Machine Listening error:", err);
    return false;
  }
}

// -----------------------------------------------------------------
// Core Processing Modules
// -----------------------------------------------------------------

function handleSoundingFrame(vectorData, rms, currentTime) {
  if (!isSounding) {
    triggerNoteOn(currentTime);
  }
  extractFeatures(vectorData, rms);
}

function handleSilentFrame(currentTime, onEventDetected) {
  if (isSounding) {
    triggerNoteOff(currentTime, onEventDetected);
  } else {
    checkPhraseCompletion(currentTime);
  }
}

// -----------------------------------------------------------------
// Sub-Routines
// -----------------------------------------------------------------

function triggerNoteOn(currentTime) {
  isSounding = true;
  eventStartTime = currentTime;

  if (lastNoteEndTime > 0) {
    updateDynamicThreshold(currentTime);
  }

  framePitches = [];
  frameLoudness = [];
}

function triggerNoteOff(currentTime, onEventDetected) {
  isSounding = false;
  const duration = currentTime - eventStartTime;

  if (duration > 0.01) {
    const eventData = processEventData(framePitches, frameLoudness, duration);
    saveEventData(eventData);

    if (onEventDetected) onEventDetected(eventData);
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

function updateDynamicThreshold(currentTime) {
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
  window.lastMelody = [...currentPhrase];
  currentPhrase = [];

  const mlConsole = document.getElementById("ml-console");
  if (mlConsole) {
    const logText = `> Phrase grouped: ${window.lastMelody.length} events. (Threshold: ${silenceThreshold.toFixed(2)}s)\n`;
    const arrayText = JSON.stringify(window.lastMelody) + "\n\n";
    mlConsole.value += logText + arrayText;
    mlConsole.scrollTop = mlConsole.scrollHeight;
  }
}

function saveEventData(eventData) {
  window.lastEvent = eventData;
  window.lastPitch = eventData[0];
  window.lastAmp = eventData[1];
  window.lastDur = eventData[2];

  window.allEvents.push(eventData);
  currentPhrase.push(eventData);
}

function processEventData(pitches, loudnesses, duration) {
  const avgLoudness = loudnesses.reduce((a, b) => a + b, 0) / loudnesses.length;
  let avgPitchHz = 0;
  let midiValue = 0;

  if (pitches.length > 0) {
    avgPitchHz = pitches.reduce((a, b) => a + b, 0) / pitches.length;
    midiValue = parseFloat((69 + 12 * Math.log2(avgPitchHz / 440)).toFixed(2));
  }

  return [
    midiValue,
    parseFloat(avgLoudness.toFixed(4)),
    parseFloat(duration.toFixed(3)),
    [],
  ];
}

function stopListening() {
  if (workletNode && micSource) {
    micSource.disconnect();
    workletNode.disconnect();
    workletNode = null;
    micSource = null;
  }
  isListening = false;
}
