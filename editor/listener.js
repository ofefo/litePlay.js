import { EssentiaWASM } from "https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.es.js";
import Essentia from "https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.es.js";

let essentia = null;
let isListening = false;
let processor = null;
let micSource = null;

// The global array to hold the sequence of events
window.lastPhrase = [];

/**
 * Toggles the machine listening state.
 * @param {AudioContext} audioCtx - The active audio context from litePlay
 * @param {Function} onEventDetected - Callback function triggered when a note ends
 * @returns {boolean} - Returns true if currently listening, false otherwise
 */
export async function toggleListening(audioCtx, onEventDetected) {
    if (isListening) {
        stopListening();
        return false;
    }

    // Initialize Essentia only once
    if (!essentia) {
        essentia = new Essentia(EssentiaWASM);
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micSource = audioCtx.createMediaStreamSource(stream);
        
        const bufferSize = 4096;
        processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
        
        // --- State Machine Variables ---
        const THRESHOLD = 0.02; 
        let isSounding = false;
        let eventStartTime = 0;
        let framePitches = [];
        let frameLoudness = [];

        processor.onaudioprocess = function(e) {
            const inputData = e.inputBuffer.getChannelData(0);
            const vectorData = essentia.arrayToVector(inputData);
            const rms = essentia.RMS(vectorData).rms;

            if (rms > THRESHOLD) {
                // STATE 1: Sounding
                if (!isSounding) {
                    isSounding = true;
                    eventStartTime = audioCtx.currentTime;
                    framePitches = [];
                    frameLoudness = [];
                }
                
                const spectrum = essentia.Spectrum(vectorData).spectrum;
                const pitchInfo = essentia.PitchYinFFT(spectrum);
                
                if (pitchInfo.pitchConfidence > 0.5) {
                    framePitches.push(pitchInfo.pitch);
                }
                frameLoudness.push(rms);
                
            } else {
                // STATE 0: Silence
                if (isSounding) {
                    isSounding = false;
                    const duration = audioCtx.currentTime - eventStartTime;
                    
                    // Ignore clicks/pops shorter than 50ms
                    if (duration > 0.05) {
                        const eventData = processEventData(framePitches, frameLoudness, duration);
                        window.lastPhrase.push(eventData);
                        
                        // Send the data back to the UI
                        if (onEventDetected) onEventDetected(eventData);
                    }
                }
            }
        };
        
        micSource.connect(processor);
        processor.connect(audioCtx.destination);
        isListening = true;
        return true;

    } catch (err) {
        console.error("Machine Listening Error:", err);
        return false;
    }
}

function stopListening() {
    if (processor && micSource) {
        micSource.disconnect();
        processor.disconnect();
        processor = null;
        micSource = null;
    }
    isListening = false;
}

function processEventData(pitches, loudnesses, duration) {
    const avgLoudness = loudnesses.reduce((a, b) => a + b, 0) / loudnesses.length;
    let avgPitchHz = 0;
    let midiValue = 0; // 0 represents unpitched sound
    
    if (pitches.length > 0) {
        avgPitchHz = pitches.reduce((a, b) => a + b, 0) / pitches.length;
        midiValue = Math.round(69 + 12 * Math.log2(avgPitchHz / 440)); 
    }
    
    // [ MIDI, Loudness (rounded), Duration (rounded), [MFCC Array Placeholder] ]
    return [
        midiValue, 
        parseFloat(avgLoudness.toFixed(4)), 
        parseFloat(duration.toFixed(3)), 
        [] 
    ];
}
