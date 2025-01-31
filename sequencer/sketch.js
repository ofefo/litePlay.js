// litePlay URL
const lpURL = "https://vlazzarini.github.io/litePlay.js/litePlay.js";
// sequencer patterns
let riff, melody, shuf, kck, snr;
// sequencer tracks
let cymbals, kicks, snares, bassline, topline;
const MSECS = 1000;

// sequencer setup
function sequence() {
  // set beat division
  const beatDiv = 1 / 3; 
  // set the BPM
  lp.setBpm(100);
  
  // eventLists for sequencer
  riff = [Eb3, [G3, 1, 0, 0.5], Bb3, [Db3, 2, 0.75, 0.2]];
  melody = [
    [[Eb5, 3, 0, 2, organ], [Bb5, 3, 0, 2, organ], [G6, 1, 0, 2]],
    [[F5, 3, 0, 2, organ], [Ab5, 3, 0, 2, organ], [Db6, 1, 0, 3.5]],
    O,
    [Bb5, 1, 0.5, 0.5],
    [[Eb5, 3, 0, 1, organ], [G5, 3, 0, 1, organ], [C6]],
    O,
    Bb5,
    Ab5,
  ];
  shuf = [[cymbal, 1, 0, 1 / 3], O, [cymbal, 0.9], [cymbal, 0.9]];
  kck = [[kick, 0.5], O, [kick, 1]];
  snr = [snare, O];

  // set up sequencer tracks
  // sequencer.add(instrument, events, amplitude, beatDiv)
  cymbals = sequencer.add(drums, shuf, 0.5, beatDiv);
  kicks = sequencer.add(drums, kck, 0.1, beatDiv);
  snares = sequencer.add(drums, snr, 0.1);
  bassline = sequencer.add(bass, riff, 0.1);
  topline = sequencer.add(synth, melody, 0.1);
  
  // run sequencer
  sequencer.play();
}

// arpeggio 
function arp() {
  // create an eventList with four events, each defined by
  // instrument.event(what, howLoud, when, howLong)
  const eList = eventList.create(
     piano.event(Eb7, 0.1, 0, 1),
     piano.event(Bb6, 0.1, 0.25, 1),
     piano.event(G6, 0.1, 0.75, 1),
     piano.event(Eb6, 0.1, 1, 1)
  );
  // set a function to play this in the litePlay sequencer
  sequencer.addCallback((t) => {
    eList.play(t);
  });
}

let lp, sequencer = null, drums, bass, 
    synth, organ, piano;
async function setup() {
  // import litePlay
  lp = await import(lpURL);
  await lp.startEngine();
  sequencer = lp.sequencer;
  eventList = lp.eventList;
  drums = lp.drums;
  bass = lp.bass;
  synth = lp.synth; 
  organ = lp.organ;
  piano = lp.piano;
  sequence();
  
  createCanvas(400, 400);
  const heartbeat = (t) => {
    fill('red');
    rect(20, 20, 60, 60);
    setTimeout(()=> {
      fill('grey');
      rect(20, 20, 60, 60);
      }, 100);
    sequencer.addCallback(heartbeat);
  }
  sequencer.addCallback(heartbeat);
}

