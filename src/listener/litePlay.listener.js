/* This script reads microphone input information gathered by instrument 99 in
 * litePlay.csd*/
import { csound, audio_context } from "../core/litePlay.js";

// Global exposes for the editor
window.allPhrases = [];
window.lastPhrase = [];
window.lastWhat = [];
window.lastHowLoud = [];
window.lastWhen = [];
window.lastHowLong = [];
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

/**
 * Start or stop listening to the microphone.
 * @param {Object} options Configuration parameters
 * @param {Function} onEvent Called each time a single note completes
 * @param {Function} onPhrase Called when a phrase completes after silence
 */
export async function startListening(
  options = {},
  onEvent = null,
  onPhrase = null,
) {
  if (!csound) {
    console.error("Csound is not running yet.");
    return false;
  }

  // Store callbacks
  onEventCallback = onEvent;
  onPhraseCallback = onPhrase;

  const {
    fastAtt = 0.05,
    fastRel = 0.15,
    slowAtt = 0.1,
    slowRel = 0.3,
    thresh = 0.05,
    noiseFloor = 0.02,
    holdTime = 0.05,
    silenceThresh = 1,
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

  // Check if Csound finished a note
  const noteEndTrig = await csound.getControlChannel("listenerNoteEndTrig");
  if (noteEndTrig > lastNoteEndTrig) {
    lastNoteEndTrig = noteEndTrig;

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
      window.lastWhat = currentPhrase.map((e) => e[0]);
      window.lastHowLoud = currentPhrase.map((e) => e[1]);
      window.lastWhen = currentPhrase.map((e) => e[2]);
      window.lastHowLong = currentPhrase.map((e) => e[3]);
      window.allPhrases.push([...currentPhrase]);
      console.log(lastPhrase);

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
}

// Portuguese aliases
export const ativarEscuta = startListening;
export const pararEscuta = stopListening;
