A Start-Up Tutorial
========

litePlay.js is a JavaScript (JS) module for music lite coding. It can be used in any web applications, but typically we anticipate it to be helpful for interactive music programming. This may be oriented to performance or composition (or both). This tutorial is focused on such use cases.

JS Coding Environments
--------

There are various online coding environments available for JS development with different characteristics and support for various kinds of uses. For the present tutorial, we are looking at the following requirements:

- Allow editing access both to the JS script and the main HTML page code.
- Provide a means of interaction with the code, so it can be typed and executed interactively

Not all environments fulfill these. The following three do:

- [JS Playground](https://www.jsplayground.dev/): a lightweight interactive JS code platform with a read-eval-print loop (REPL), allowing editing of HTML and JS (as well as CSS). No support for saving projects at the time of writing.

- [Playcode](https://playcode.io): an interactive JS code platform with the facility for live refreshing/re-running of code, but no REPL. Support for saving projects in user accounts is available.

- [p5.js editor](https://editor.p5js.org/): an interactive JS platform, which is designed for developing p5.js multimedia applications, but supports litePlay.js very well. It allows editing of HTML and JS code as well as import other media files into the project. It provides a REPL, and it also supports saving projects in user accounts.

The code in this tutorial can be run in any of the three platforms. Whenever the REPL is mentioned, if not present (e.g. in Playcode), the code can be evaluated directly from the script in the live mode.


Loading the LitePlay.js module
-------

The simplest way to load the litePlay.js module is to add the following script tag to the main HTML page header (generally called index.html).

```
<script  src="https://vlazzarini.github.io/litePlay.js/litePlay.constants.js"></script>
```

when the page is loaded, you will have access to various system constants, as well as the following function

```
lpRun(f)
```

which loads the module, starts the audio engine, and then calls the function `f()` which is supplied to it. At the simplest, we can have the following JS script code

```
lpRun();
```

which tells the user that the system is ready to use when a message is printed to the JS console. Alternatively, the function `f()` can be use as the starting point of the litePlay.js application. Or it can simply contain all the code that is to be executed when the script is run,

```
function code() {
 // we start executing from here ...
}
lpRun(code);
```

Once the litePlay.js engine is running, we can use its functionality anywhere by prefixing its functions etc with `lp.`.

The `play()` action
---------

At the core of litePlay.js we have `play()`. This can be simply run as

```
lp.play()
```

to play a sound, and `lp.stop()` to stop it. These code lines can be typed directly on an interactive REPL console or added to the script.

We can make changes to this sound by setting
the default instrument playing it,

```
lp.instrument(lp.organ)
```

the default was set to piano at the start, but we now changed it to
organ. An introduction to instruments is given at the end of the tutorial.

We can also tell what to play. If the sound is from a pitched instrument,
we can ask it to play a given pitch,

```
lp.play(E4)
```

The pitch symbolic names range from Cm1 ($=C_{-1}$) to G8 ($=G_{8}$),
in such a way that the middle C of a piano keyboard is set to C4. The
sound is played immediately and lasts indefinitely (although some
may decay in intensity over time).

Events
---

In litePlay.js we can think of the resulting action of `play()` in this form is a musical _event_. We can define it with five attributes:

- _what_: the thing that we play, which may vary, but in the case shown earlier, is the pitch of the sound.

- _howLoud_: the level of the sound, which can be set by a numeric value in a scale from 0 to 1.

- _when_: the event time, when it is supposed to be happening, in the present case, set in seconds.

- _howLong_: how long the sound is to last for, in seconds.

- _onSomething_: the thing that will be making the sound, the instrument, such as `lp.organ`, `lp.violin` etc. There are several of these to choose from. Depending on the type of instrument, _what_ can be played may vary. For example, in the case of `lp.drums`, we do not have pitch, but different percussion sounds like `snare`, `kick`,  etc.

Event attributes (or parameters) are optional, as we have seen. If we do pass them, defaults are used. It is possible to pass only a few parameters, for example just _what_; _what_ and _howLoud_; _what_, _howLoud_, and _when_; as well as _what_, _howLoud_,_when_, and _howLong_.

Events are passed using a JS list (or array) with attributes in the order listed earlier

```
[what,  howLoud, when, howLong, onSomething]
```

For example,

```
lp.play([C4, 0.5, 0, 2, lp.violin])
```

The top-level`play()` action can take several events as arguments, such
as

```
lp.play([C4, 0.1, 0, 3],[E4, 0.2, 0.5, 0.5], [G4, 0.4, 2, 0.1])
```

Event Lists
-----------

The last example of the previous section demonstrated that we can work
with lists of events, instead of only sending individual events to
`play()`.  There is a particular aspect of this that we should note,
the _when_ attributes of each event will be interpreted in a certain
way.

- A simple list of _what_

```
lp.play(C3, C4, C5);
```

In this case, the events will be separated by the default 
_howLong_ for the _onSomething_ being played (set to 1 sec). So we
hear the sounds in sequence.


- A list of incomplete events

```
lp.play([C3], [C4], [C5]);
```

In this case, the default for _when_ is 0, immediately, for
all events in the list. We hear the sounds starting at the same
time, mixed up.


- A list of events with _when_ attributes explicitly defined

```
lp.play([C3, 0.1, 0], [C4, 0.2, 1], [C5, 0.4, 2]);
```

In this case, the timing of events is relative to the time we
asked for the event list to be played, with perhaps a very
short delay. All events are precisely timed in relation to
that. We can decide when these should come in with an
exact time.

This brings us the concept of an _eventList_, which is
expressed in litePlay.js by JS object  that can be manipulated.
For example, we can create it

```
evts = eventList.create([C3, 0.1, 0], [C4, 0.2, 1], [C5, 0.4, 2]);
```

then we can play it

```
evts.play()
```

repeatedly (by calling `play()` on it). The `play()` can take
two optional parameters,

```
eventList.play(when, events);
```

the first one is a _when_ for the complete list, taken from the
time of the action, so we can place the performance in the
future. The second is a list of events, basically a JS list of
lists, such as

```
[ [C3, 0.1, 0, 1], [C4, 0.2, 1, 1], [C5, 0.4, 2, 1]]
```

as can be seen, there is an outer lists which holds two
events, which are themselves lists (of attributes). One
fundamental aspect is that the event list passed to `play()`
replaces the existing events (if any have been added)
in the object. Beyond that, we may, amongst other things,

-`eventList.add(event, ...)` events to the end of the list. This can
take any number of events (as `create()` did).

- `eventList.remove(index)` remove an event with a given `index`
from the list, or the last event (if no `index` is given).

- `eventList.insert(pos, event, ...)` insert one or more events into
the object, after position `pos`.

We can also repeat an `eventList` any number of `times`, `when`
seconds later from the action,

```
evt.repeat(times, when)
```

Both `eventList.play()` and `eventList.repeat()` return the end time
of the playback. So we can use that information to schedule other
events. For example, this code plays an event list, adds two events
to it and then schedule to repeat that longer sequence for three
times after the end of the first `play()` action,

```
  let evt = lp.eventList.create([C4, 0.1, 0, 1],
                                [E4, 0.2, 1, 1], 
                                [G4, 0.4, 2, 1]);
  end = evt.play();
  evt.add([C1, 0.1, 3, 3], [C1, 0.1, 0, 4]);
  evt.repeat(3, end);
```

One consequence of all these ideas is that we have introduced the
idea that a `play()` action may have different forms, depending on
which context it is being invoked, which at the moment can be

- The global litePlay.js context: `lp.play()`

- An instrument object : `lp.organ.play()`

- An _eventList_: `eventList.play()`

With events and eventLists we can construct compositions and
performances with precise relative timing between events, which is
something desirable in musical activities.

Instruments
-----

In litePlay.js, sound generation is managed by instrument objects. In
general, we can access these by using one of the names defined in the
JS module, like `lp.piano`, `lp.organ`, `lp.synth`, etc. These are
constants provided by litePlay.js, allowing an easy selection of sound
generators (to fulfill the _onSomething_ attribute of an event).

This is the complete set of JS constant declarations for instruments.
Note that each one of them has the form `const instrName = new
Instrument(number)`. There are 128 different instruments plus six
special drum kits that can be accessed via their individual numbers.

- _Struck_: pitched sounds create by striking something like a
string, bar, etc

```
const grandPiano = new Instrument(0);
const  piano = grandPiano;
const  brightPiano = new Instrument(1);
const  electricGrand = new Instrument(2);
const  honkyPiano = new Instrument(3);
const  electricPiano = new Instrument(4);
const  electricPiano2 = new Instrument(5);
const  harpsichord = new Instrument(6);
const  clavinet = new Instrument(7);
const  celesta = new Instrument(8);
const  glockenspiel = new Instrument(9);
const musicBox = new Instrument(10);
const vibraphone = new Instrument(11);
const marimba = new Instrument(12);
const xylophone = new Instrument(13);
const tubularBells = new Instrument(14);
const dulcimer = new Instrument(15);
const tinkleBell = new Instrument(112);
```

- _Sustained_: pitched sounds created by sustaining tones

```
const drawbarOrgan = new Instrument(16);
const percussiveOrgan = new Instrument(17);
const rockOrgan = new Instrument(18);
const organ = rockOrgan;
const churchOrgan = new Instrument(19);
const reedOrgan = new Instrument(20);
const accordion = new Instrument(21);
const harmonic = new Instrument(22);
const tangoAccordion = new Instrument(23);
```

- _Plucked_: pitched sounds created by plucking strings

```
const nylonAcousticGuitar = new Instrument(24);
const guitar = nylonAcousticGuitar;
const steelAcousticGuitar = new Instrument(25);
const jazzElectricGuitar = new Instrument(26);
const clearElectricGuitar = new Instrument(27);
const mutedElectricGuitar = new Instrument(28);
const overdrivenGuitar = new Instrument(29);
const  distortionGuitar = new Instrument(30);
const  guitarHarmonics = new Instrument(31);
const  sitar = new Instrument(105);
const  banjo = new Instrument(106);
const  shamisen = new Instrument(107);
const  koto = new Instrument(108);
const  kalimba = new Instrument(109);
const  pizzicatoStrings = new Instrument(45);
const  orchestralHarp = new Instrument(46);
const harp = orchestralHarp;
```

- _Bass_: various types of pitched sounds for the bass range

```
const  acousticBass = new Instrument(32);
const  fingerElectricBass = new Instrument(33);
const  pickElectricBass = new Instrument(34);
const  fretlessBass = new Instrument(35);
const  bass = fretlessBass;
const  slapBass1 = new Instrument(36);
const  slapBass2 = new Instrument(37);
const  synthBass1 = new Instrument(38);
const  synthBass2 = new Instrument(39);
```

- _Bowed_: pitched sounds created by bowing strings

```
const  violin = new Instrument(40);
const  viola = new Instrument(41);
const  cello = new Instrument(42);
const  contrabass = new Instrument(43);
const  tremoloStrings = new Instrument(44);
```

- _Ensemble_: ensemble-like pitched sounds

```
const  stringEnsemble1 = new Instrument(48);
const  strings = stringEnsemble1;
const  stringEnsemble2 = new Instrument(49);
const  synthStrings1 = new Instrument(50);
const  synthStrings2 = new Instrument(51);
```

- _Voice_: pitched sounds created through singing

```
const  choirAahs = new Instrument(52);
const  voiceOohs = new Instrument(53);
const  synthVoice = new Instrument(54);
```
- _Blow_: pitched sounds created by blowing on a open mouthpiece
  connected to a pipe

```
const  trumpet = new Instrument(56);
const  trombone = new Instrument(57);
const  tuba = new Instrument(58);
const  mutedTrumpet = new Instrument(59);
const  frenchHorn = new Instrument(60);
const  horn = frenchHorn;
const  brassSection = new Instrument(61);
const  brass = brassSection;
const  synthBrass1 = new Instrument(62);
const  synthBrass2 = new Instrument(63);
```

-_Wind_: pitched sounds created by blowing on different types of reeds 

```
const  sopranoSax = new Instrument(64);
const  altoSax = new Instrument(65);
const  tenorSax = new Instrument(66);
const  baritoneSax = new Instrument(67);
const  oboe = new Instrument(68);
const  englishHorn = new Instrument(69);
const  bassoon = new Instrument(70);
const  clarinet = new Instrument(71);
const  piccolo = new Instrument(72);
const  flute = new Instrument(73);
const  recorder = new Instrument(74);
const  panFlute = new Instrument(75);
const  blownBottle = new Instrument(76);
const  shakuhachi = new Instrument(77);
const  whistle = new Instrument(78);
const  ocarina = new Instrument(79);
```

-_Lead_: lead-type pitched synthesizer sounds

```
const  lead1 = new Instrument(80);
const  lead2 = new Instrument(81);
const  lead3 = new Instrument(82);
const  lead4 = new Instrument(83);
const  lead5 = new Instrument(84);
const  lead6 = new Instrument(85);
const  lead7 = new Instrument(86);
const  lead8 = new Instrument(87);
```
-_Synth_: generic pitched synthesizer sounds

```
const  pad1 = new Instrument(88);
const  pad2 = new Instrument(89);
const  pad3 = new Instrument(90);
const  pad4 = new Instrument(91);
const  pad5 = new Instrument(92);
const  synth = pad5;
const  pad6 = new Instrument(93);
const  pad7 = new Instrument(94);
const  pad8 = new Instrument(96);
```
- _Fx_: mostly unpitched effects sounds

```
const  fx1 = new Instrument(97);
const  fx2 = new Instrument(98);
const  fx3 = new Instrument(99);
const  fx4 = new Instrument(100);
const  fx5 = new Instrument(101);
const  fx6 = new Instrument(102);
const  fx7 = new Instrument(103);
const  fx8 = new Instrument(104);
```

-_Perc_: mostly unpitched percussion sounds.

```
const  agogo = new Instrument(113);
const  steelDrums = new Instrument(114);
const  woodblock = new Instrument(115);
const  taikoDrum = new Instrument(116);
const  melodicTom = new Instrument(117);
const  synthDrum = new Instrument(118);
const  reverseCymbal = new Instrument(119);
const  guitarFretNoise = new Instrument(120);
const  breathNoise = new Instrument(121);
const  seaShore = new Instrument(122);
const  birdTweet = new Instrument(123);
const  telephoneRing = new Instrument(124);
const  helicopter = new Instrument(125);
const  applause = new Instrument(126);
const  gunshot = new Instrument(127);
```

- _Drums_: unpitched drum/percussion kits, with specific sounds that
  can be selected individually. For these, the instrument names are
  `drums`, `drums1`,`drums2`, `drums3`,  `drums4`, `drums5`, and
  `drums6`. The sounds can be selected via a _what_ attribute, which
  can be one of the following as defined below:

```
const acousticBassDrum = 35;
const kick = acousticBassDrum;
const bassDrum1 = 36;
const sideStick = 37;
const acousticSnare = 38;
const handClap = 39;
const electricSnare = 40;
const snare = electricSnare;
const lowFloorTom = 41;
const closedHiHat = 42;
const highFloorTom = 43;
const pedalHiHat = 44;
const lowTom = 45;
const tom = lowTom;
const openHiHat = 46;
const lowMidTom = 47;
const hiMidTom = 48;
const crashCymbal = 49;
const crash = crashCymbal;
const hiTom = 50;
const rideCymbal1 = 51;
const cymbal = rideCymbal1;
const chineseCymbal = 52;
const rideBell = 53;
const tambourine = 54;
const splashCymbal = 55;
const cowbell = 56;
const crashCymbal2 = 57;
const vibraslap = 58;
const rideCymbal2 = 59;
const hiBongo = 60;
const lowBongo = 61;
const muteHiConga = 62;
const openHiConga = 63;
const lowConga = 64;
const hiTimbale= 65;
const lowTimbale = 66;
const hiAgogo = 67;
const lowAgogo = 68;
const cabasa = 69;
const maracas = 70;
const shortWhistle = 71;
const longWhistle = 72;
const shortGuiro = 73;
const longGuiro = 74;
const claves = 75;
const hiWoodBlock= 76;
const lowWoodBlock = 77;
const muteCuica = 78;
const openCuica = 79;
const muteTriangle = 80;
const openTriangle = 81;
```


