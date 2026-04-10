// code mirror
import { basicSetup } from "https://esm.sh/codemirror";
import { EditorView, keymap } from "https://esm.sh/@codemirror/view";
import { EditorState, Prec } from "https://esm.sh/@codemirror/state";
import { javascript, javascriptLanguage } from "https://esm.sh/@codemirror/lang-javascript";
import { autocompletion } from "https://esm.sh/@codemirror/autocomplete";
import { oneDark } from "https://esm.sh/@codemirror/theme-one-dark";
// extendable media recorder
import { MediaRecorder, register } from "https://esm.sh/extendable-media-recorder";
import { connect } from "https://esm.sh/extendable-media-recorder-wav-encoder";

// override function to print output in console
const consoleOutput = document.getElementById('console-output');
const originalLog = console.log;

console.log = function(...args) {
	originalLog.apply(console, args);
    	const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    	if (consoleOutput) {
        	consoleOutput.value += message + '\n';
        	consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
};

// override function to print errors in console
const originalError = console.error;
console.error = function(...args) {
    originalError.apply(console, args);
    const message = args.map(arg => arg instanceof Error ? arg.message : String(arg)).join(' ');
    if (consoleOutput) {
        consoleOutput.value += "ERROR: " + message + '\n';
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
};

// run and stop litePlay (must be before startState)
function runLP() {
	try {
        	const currentCode = editor.state.doc.toString();
        	if (currentCode.trim() === "") throw new Error("Empty! Write something!");
        
        	eval(currentCode);
		return true;
    	} catch (error) {
    	    	console.error(error);
    	    	return true;
    	}
}

// stop button 
const stopLP = async (event) => {
    	if (liteplayEngine) {
    		console.log("Stopping audio...");
		await reset();
    		console.log("Audio stopped.");
    	}
}

// import constants for autocompletion
import * as litePlayLang from "../litePlay.js";
const lpKeys = Object.keys(litePlayLang);

function litePlayCompletions(context) {
    let word = context.matchBefore(/[a-zA-Z0-9_À-ÿ]+/);
    if (!word && !context.explicit) return null;

    return {
        from: word ? word.from : context.pos,
        options: lpKeys.map(keyword => {
            // check the actual type of the exported item
            const itemValue = litePlayLang[keyword];
            const jsType = typeof itemValue;
            
            // map JS types to CodeMirror autocomplete types
            let cmType = "variable";
            if (jsType === "function") cmType = "function";
            else if (jsType === "number" || jsType === "string") cmType = "constant";
            else if (jsType === "object") cmType = "class";

            return {
                label: keyword,
                type: cmType,
                detail: jsType,
                info: "litePlay"
            };
        })
    };
}

// CM startState
const startState = EditorState.create({
	extensions: [
        	basicSetup,
        	oneDark,
        	javascript(),
		javascriptLanguage.data.of({
			autocomplete: litePlayCompletions
	        }),
		autocompletion(), 
		Prec.highest(
			keymap.of([
				{ key: "Mod-Enter", run: runLP },
				{ key: "Mod-.", run: stopLP },
				{ key: "Mod-r", run: startRecording },
			])
		),
	]
});

let editor = new EditorView({
    state: startState,
    parent: document.getElementById("editor-container") 
});

// start litePlay
let liteplayEngine = null;
   
document.addEventListener('pointerdown', async () => {
	if (!liteplayEngine) {
		try {
			console.log("Loading litePlay engine...");
			liteplayEngine = await lpLoad(); 

			// expose all of litePlay.js exports to the global window
			Object.assign(window, liteplayEngine);
			console.log("litePlay is ready!");

			// change button colors when ready
			const runBtn = document.getElementById('run-btn');
			if (runBtn) runBtn.classList.add('ready-green');

			const recBtn = document.getElementById('rec-btn');
			if (recBtn) recBtn.classList.add('ready-red');

		} catch (error) {
			console.error("Failed to auto-start litePlay:", error);
		}
	}
}, {once: true});
		
// save button
const saveCode = () => {
	const now = new Date();
	const datetime = `${now.getFullYear()}_${now.getMonth()+1}_${now.getDate()}_${now.getHours()}-${now.getMinutes()}`;

	const text = editor.state.doc.toString();
	const blob = new Blob([text], { type: 'text/javascript' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a'); 
	a.href = url;
	a.download = 'litePlay' + datetime + '.js';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

// recording feature (extendable mediaRecorder)
let mediaRecorder = null;
let audioChunks = [];
let connectedCsoundNode = null;
let destNode = null;
let encoderRegistered = false;

async function startRecording() {
    	if (!window.audio_context || !window.csound || (mediaRecorder && mediaRecorder.state === "recording")) {
    	    	console.error("Engine not ready or already recording.");
    	    	return;
    	}
    	    
    	try {
    	    	if (!encoderRegistered) {
    	    	    	console.log("Registering WAV encoder...");
    	    	    	await register(await connect());
    	    	    	encoderRegistered = true;
    	    	}

    	    	connectedCsoundNode = await window.csound.getNode();
    	    	destNode = window.audio_context.createMediaStreamDestination();
    	    	connectedCsoundNode.connect(destNode);
    	    	mediaRecorder = new MediaRecorder(destNode.stream, { mimeType: 'audio/wav' });
    	    	audioChunks = [];

    	    	mediaRecorder.ondataavailable = (event) => {
    	    	    	if (event.data.size > 0) {
    	    	    	    audioChunks.push(event.data);
    	    	    	}
    	    	};

    	    	mediaRecorder.onstop = () => {
    	    	    	const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    	    	    	const audioUrl = URL.createObjectURL(audioBlob);
    	    	    	
    	    	    	const now = new Date();
    	    	    	const datetime = `${now.getFullYear()}_${now.getMonth()+1}_${now.getDate()}_${now.getHours()}-${now.getMinutes()}`;
    	    	    	const link = document.createElement('a');
    	    	    	
    	    	    	link.href = audioUrl;
    	    	    	link.download = 'litePlay_' + datetime + '.wav';
    	    	    	document.body.appendChild(link);
    	    	    	link.click();
    	    	    	link.remove(); 
    	    	    	URL.revokeObjectURL(audioUrl);
    	    	    	
    	    	    	if (connectedCsoundNode && destNode) {
    	    	    	    connectedCsoundNode.disconnect(destNode);
    	    	    	}
    	    	};
    	    
    		mediaRecorder.start();
    		console.log("Recording started...");
    	    
    	} catch (err) {
    	    console.error("Failed to start recording: ", err);
    	}
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        console.log("Recording stopped! Downloading sound file...");
    }
}

// buttons actions
const runButton = document.querySelector('#run-btn');
runButton.addEventListener('click', runLP);

const stopButton = document.querySelector('#stop-btn');
stopButton.addEventListener('click', stopLP);

const saveButton = document.querySelector('#save-btn');
saveButton.addEventListener('click', saveCode);

const recButton = document.querySelector('#rec-btn');
recButton.addEventListener('click', startRecording);

const stopRecButton = document.querySelector('#stopRec-btn');
stopRecButton.addEventListener('click', stopRecording);
