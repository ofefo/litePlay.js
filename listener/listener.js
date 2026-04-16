import Essentia from 'https://unpkg.com/essentia.js@0.1.3/dist/essentia.js-core.es.min.js';
import { EssentiaWASM } from 'https://unpkg.com/essentia.js@0.1.3/dist/essentia-wasm.es.js';

let essentia = null;
let isListening = false;
let workletNode = null;
let micSource = null;

// The global array to hold the sequence of events
window.lastEvent = [];

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

	// Initialize Essentia if not yet 
	if (!essentia) {
		essentia = new Essentia(EssentiaWASM);
	}

	try {
		// Load the background processor module
		await audioCtx.audioWorklet.addModule('./listener/processor.js');

		// Get mic input
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
		micSource = audioCtx.createMediaStreamSource(stream);

		// Create the Worklet Node
		workletNode = new AudioWorkletNode(audioCtx, 'audio-capture-processor');
		
		// State Machine Variables
		const onsetThreshold = 0.02; 
		let isSounding = false;
		let eventStartTime = 0;
		let framePitches = [];
		let frameLoudness = [];

		// Handle incoming buffers from the Worklet thread
		workletNode.port.onmessage = function(event) {
			const inputData = event.data;
			const vectorData = essentia.arrayToVector(inputData);
			const rms = essentia.RMS(vectorData).rms;

			if (rms > onsetThreshold) {
				// status: note on
				if (!isSounding) {
					isSounding = true;
					eventStartTime = audioCtx.currentTime;
					// reset arrays
					framePitches = [];
					frameLoudness = [];
				}

				// get pitch data from spectrum 
				const spectrum = essentia.Spectrum(vectorData).spectrum;
				const pitchInfo = essentia.PitchYinFFT(spectrum);
				
				if (pitchInfo.pitchConfidence > 0.6) {
					framePitches.push(pitchInfo.pitch);
				}
				frameLoudness.push(rms);

			} else {
				// status: note off
				if (isSounding) {
					isSounding = false;
					const duration = audioCtx.currentTime - eventStartTime;
					// Ignore sounds shorter than 10ms
					if (duration > 0.01) {
						const eventData = processEventData(framePitches, frameLoudness, duration);
						window.lastEvent.push(eventData);
						// Send the data back to the UI
						if (onEventDetected) onEventDetected(eventData);
					}
				}
			}
		};
		
		// 5. Connect the routing
		micSource.connect(workletNode);
		isListening = true;
		return true;

	} catch (err) {
		console.error("Machine Listening error:", err);
		return false;
	}
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

function processEventData(pitches, loudnesses, duration) {
	const avgLoudness = loudnesses.reduce((a, b) => a + b, 0) / loudnesses.length;
	let avgPitchHz = 0;
	let midiValue = 0; // 0 represents unpitched sound
	
	if (pitches.length > 0) {
		avgPitchHz = pitches.reduce((a, b) => a + b, 0) / pitches.length;
		midiValue = parseFloat((69 + 12 * Math.log2(avgPitchHz / 440)).toFixed(2));
	}
	
	// [ MIDI, Loudness (rounded), Duration (rounded), [MFCC Array Placeholder] ]
	return [
		midiValue, 
		parseFloat(avgLoudness.toFixed(4)), 
		parseFloat(duration.toFixed(3)), 
		[] 
	];
}
