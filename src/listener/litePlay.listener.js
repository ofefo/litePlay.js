/*This script reads microphone input information gathered by Csound*/

// State tracking
let eventOnset = 0; // when current note started
let phraseOnset = 0; // when current phrase started
let lastNoteEndTime = 0; // when the previous note ended
let currentPhrase = []; // array of events accumulated in current phrase
const durationThreshold = 0.003; // ignore clicks shorter than 3ms
let silenceThreshold = 1.5; // seconds of silence to end a phrase

function triggerNoteOn(engineOnsetTime) {
  isSounding = true;
  eventOnset = engineOnsetTime;

  // If this is the very first note after silence, it defines the phrase start!
  if (currentPhrase.length === 0) {
    phraseOnset = eventOnset;
  }

  // Clear buffers ready to accumulate pitch and loudness frames for this note
  framePitches = [];
  frameLoudness = [];
}

function triggerNoteOff(engineOffsetTime, onEventDetected) {
  isSounding = false;

  // 1. Calculate how long the note sounded
  const duration = engineOffsetTime - eventOnset;

  // 2. Filter out tiny transient clicks (e.g. mouth click or mic bump < 20ms)
  if (duration > durationThreshold) {
    // 3. Calculate start time relative to the phrase start
    const relativeOnsetTime = eventOnset - phraseOnset;

    // 4. Build the musical event: [what, howLoud, when, howLong]
    const eventData = [
      robustPitchMidi(framePitches), // what
      normAmp(frameLoudness), // howLoud
      parseFloat(relativeOnsetTime.toFixed(3)), // when
      parseFloat(duration.toFixed(3)), // howLong
    ];

    // Save event to the active phrase
    currentPhrase.push(eventData);
    window.lastEvent = eventData;

    // Optional user callback
    if (onEventDetected) {
      onEventDetected(eventData);
    }
  }

  // Record when this note finished to start the silence timer
  lastNoteEndTime = engineOffsetTime;
}
