/*This script reads microphone input information gathered by Csound*/
import { csound, audio_context } from "../core/litePlay.js";

// Global exposes for the editor
window.allPhrases = [];
window.lastPhrase = [];
window.lastMelody = [];
window.lastRhythm = [];
window.lastWhen = [];
window.lastAmps = [];
window.lastEvent = [];

// System state
let isListening = false;
let analysisInstrStarted = false;
let micStream = null;
let inputSourceNode = null;
let pollIntervalId = null;
let pollInFlight = false;

// Trigger trackers to detect when Csound increments a counter
let lastNoteEndTrig = 0;
let lastPhraseEndTrig = 0;

// Current phrase accumulator
let currentPhrase = [];

// Event callbacks for UI
let onEventCallback = null;
let onPhraseCallback = null;
let onMeterCallback = null;

/**
 * Start or stop listening to the microphone.
 * @param {Object} options Configuration parameters
 * @param {Function} onEvent Called each time a single note completes
 * @param {Function} onPhrase Called when a phrase completes after silence
 * @param {Function} onMeter Called continuously with live RMS volume (0..1)
 */
export async function toggleListening(
  options = {},
  onEvent = null,
  onPhrase = null,
  onMeter = null,
) {
  if (isListening) {
    stopListening();
    return false;
  }

  if (!csound) {
    console.error("Csound engine is not ready yet.");
    return false;
  }

  // Store callbacks
  onEventCallback = onEvent;
  onPhraseCallback = onPhrase;
  onMeterCallback = onMeter;

  const {
    fastAtt = 0.05,
    fastRel = 0.15,
    slowAtt = 0.1,
    slowRel = 0.3,
    thresh = 0.005,
    noiseFloor = 0.002,
    holdTime = 0.05,
    silenceThresh = 1.5,
  } = options;

  await csound.setControlChannel("listenerFastAtt", fastAtt);
  await csound.setControlChannel("listenerFastRel", fastRel);
  await csound.setControlChannel("listenerSlowAtt", slowAtt);
  await csound.setControlChannel("listenerSlowRel", slowRel);
  await csound.setControlChannel("listenerThresh", thresh);
  await csound.setControlChannel("listenerNoiseFloor", noiseFloor);
  await csound.setControlChannel("listenerHoldTime", holdTime);
  await csound.setControlChannel("listenerSilenceThresh", silenceThresh);

  try {
    // Get microphone
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    // Route mic audio into Csound's Web Audio node
    const audioCtx = audio_context || (await csound.getAudioContext());
    const csoundNode = await csound.getNode();

    inputSourceNode = audioCtx.createMediaStreamSource(micStream);
    inputSourceNode.connect(csoundNode);

    // Start Csound analysis instrument (instr 99)
    if (!analysisInstrStarted) {
      await csound.inputMessage("i 99 0 -1");
      analysisInstrStarted = true;
    }

    // Reset triggers
    lastNoteEndTrig = await csound.getControlChannel("listenerNoteEndTrig");
    lastPhraseEndTrig = await csound.getControlChannel("listenerPhraseEndTrig");
    currentPhrase = [];
    isListening = true;

    // Start polling loop (runs every 15ms)
    pollIntervalId = setInterval(() => {
      if (pollInFlight) return;
      pollInFlight = true;
      pollListener().finally(() => {
        pollInFlight = false;
      });
    }, 15);

    console.log("Machine listening started.");
    return true;
  } catch (err) {
    console.error("Failed to start machine listening:", err);
    stopListening();
    return false;
  }
}

async function pollListener() {
  if (!isListening) return;

  // Live volume meter for the UI
  //const rms = await csound.getControlChannel("listenerRms");
  //if (onMeterCallback) {
  //  onMeterCallback(rms);
  //}

  // Check if Csound finished a note
  const noteEndTrig = await csound.getControlChannel("listenerNoteEndTrig");
  if (noteEndTrig > lastNoteEndTrig) {
    lastNoteEndTrig = noteEndTrig;

    // Read the 4 event values computed by Csound
    const what = await csound.getControlChannel("listenerWhat");
    const howLoud = await csound.getControlChannel("listenerHowLoud");
    const when = await csound.getControlChannel("listenerWhen");
    const howLong = await csound.getControlChannel("listenerHowLong");

    const event = [
      parseFloat(what.toFixed(2)),
      parseFloat(howLoud.toFixed(2)),
      parseFloat(when.toFixed(3)),
      parseFloat(howLong.toFixed(3)),
    ];

    currentPhrase.push(event);
    window.lastEvent = event;

    if (onEventCallback) {
      onEventCallback(event);
    }
  }

  // Check if Csound finished a phrase after silence
  const phraseEndTrig = await csound.getControlChannel("listenerPhraseEndTrig");
  if (phraseEndTrig > lastPhraseEndTrig) {
    lastPhraseEndTrig = phraseEndTrig;

    if (currentPhrase.length > 0) {
      window.lastPhrase = [...currentPhrase];
      window.lastMelody = currentPhrase.map((e) => e[0]);
      window.lastAmps = currentPhrase.map((e) => e[1]);
      window.lastWhen = currentPhrase.map((e) => e[2]);
      window.lastRhythm = currentPhrase.map((e) => e[3]);
      window.allPhrases.push([...currentPhrase]);

      if (onPhraseCallback) {
        onPhraseCallback(window.lastPhrase);
      }

      // Reset for next phrase
      currentPhrase = [];
    }
  }
}

export function stopListening() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }

  if (analysisInstrStarted && csound) {
    csound.inputMessage("i -99 0 0.1");
    analysisInstrStarted = false;
  }

  if (inputSourceNode) {
    try {
      inputSourceNode.disconnect();
    } catch (e) {}
    inputSourceNode = null;
  }

  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }

  isListening = false;
  if (onMeterCallback) onMeterCallback(0);
  console.log("Machine listening stopped.");
}

// Portuguese aliases
export const escutar = toggleListening;
export const ativarEscuta = toggleListening;
export const pararEscuta = stopListening;
