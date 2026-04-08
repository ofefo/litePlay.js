const consoleOutput = document.getElementById('console-output');
const originalLog = console.log;
const originalError = console.error;
		
console.log = function(...args) {
	originalLog.apply(console, args); // make them variables
			
	const message = args.map(arg => {
		if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
		return String(arg);
	}).join(' ');

	if (consoleOutput) {
		consoleOutput.value += message + '\n';
		consoleOutput.scrollTop = consoleOutput.scrollHeight;
	}
};
		
console.error = function(...args) {
	originalError.apply(console, args);
			
	const message = args.map(arg => {
		if (arg instanceof Error) return arg.message || arg.toString();
		if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
		return String(arg);
	}).join(' ');
			
	if (consoleOutput) {
		consoleOutput.value += "ERROR: " + message + '\n';
		consoleOutput.scrollTop = consoleOutput.scrollHeight;
	}
};

// replace textarea for CodeMirror 
const editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
	mode: "javascript",
	theme: "monokai",
	lineNumbers: true,
	indentUnit: 4,
	tabSize: 4,
	extraKeys: { 
		"Ctrl-Enter": function(cm) {runLP();}, //run with ctrl+enter
		"Cmd-Enter": function(cm) {runLP();}
	}
});

// auto-trigger for the autocomplete
editor.on("keyup", function (cm, event) {
	if (!cm.state.completionActive && event.keyCode >= 65 && event.keyCode <= 90) {
		cm.showHint({ completeSingle: false }); //prevent automatic insertion when there's only one option left
	}
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

			// make the Run button green to show it's ready
			const runBtn = document.getElementById('run-btn');
			if (runBtn) runBtn.classList.add('ready-green');

			const recBtn = document.getElementById('rec-btn');
			if (recBtn) recBtn.classList.add('ready-red');

		} catch (error) {
			console.error("Failed to auto-start litePlay:", error);
		}
	}
}, {once: true});
		
// prevent code to running loops for more than N cycles
function protectCode(code) {
	const maxIterations = 1000; //max allowed loop cycles per run
	let safeCode = `let _loopCount = 0;\n` + code;
	const loopRegex = /(while\s*\(.*?\)\s*\{|for\s*\(.*?\)\s*\{)/g; //regex to find while and for loops brackets
	safeCode = safeCode.replace(loopRegex, `$1 if
			(++_loopCount > ${maxIterations}) {throw new
			Error("Infinite loop detected! Execution stopped.");
			}`);
	return safeCode;
}

// override setTimeout to remember its ID
const activeTimeouts = [];
const originalSetTimeout = window.setTimeout;
		
window.setTimeout = function(func, delay, ...args) {
	const id = originalSetTimeout(func, delay, ...args);
	activeTimeouts.push(id);
	return id;
};
		
// run button
const runLP = async (event) => {
	if (event) event.preventDefault();
	try {
		const lpCode = editor.getValue();
		if (lpCode == "") throw "Empty! Write something!"
		const safeCode = protectCode(lpCode);
		eval(safeCode);
	} catch (error) {
		    	await console.error(error);
    	}
}

// stop button 
const stopLP = async (event) => {
	if (event) event.preventDefault();
	activeTimeouts.forEach(id => clearTimeout(id)); //clear all timeOuts
	activeTimeouts.length = 0;
		
    	if (liteplayEngine) {
    		console.log("Stopping audio...");
		await reset();
    		console.log("Audio stopped.");
    	}
}

//save button
const saveCode = () => {
	const now = new Date();
	const datetime = `${now.getFullYear()}_${now.getMonth()+1}_${now.getDate()}_${now.getHours()}-${now.getMinutes()}`;

	const text = editor.getValue();
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

// recording feature
let mediaRecorder = null;
let audioChunks = [];
let destNode = null;
let connectedCsoundNode = null;
		
async function startRecording() {
	if (!audio_context || !csound || mediaRecorder?.state === "recording") {
	console.error("Engine not ready or already recording.");
	return;
	}
		
	try {
		destNode = audio_context.createMediaStreamDestination();
		connectedCsoundNode = await csound.getNode();
		connectedCsoundNode.connect(destNode);
		mediaRecorder = new MediaRecorder(destNode.stream);
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
			    
			    if (connectedCsoundNode) {
			        connectedCsoundNode.disconnect(destNode);
			        connectedCsoundNode = null;
			    }
		};
		
		mediaRecorder.start();
		console.log("Recording started...");
		
		} catch (err) {
			console.error("Failed to start recording: ", err);
		}
};
		
function stopRecording() {
	if (mediaRecorder && mediaRecorder.state === "recording") {
		await mediaRecorder.stop();
		console.log("Recording stopped! Downloading file...");
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
