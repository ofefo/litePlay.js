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
lp.instrument(organ)
```

the default was set to piano at the start, but we now changed it to organ.

We can also tell what to play. If the sound is from a pitched instrument,
we can ask it to play a given pitch,

```
lp.play(E4)
```

The pitch symbolic names range from Cm1 ($=C_{-1}$) to G8 ($=G_{8}$),
in such a way that the middle C of a piano keyboard is set to C4.

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

In this case, the events will be separated by a default
_howLong_ (1 sec) and played in sequence.


- A list of incomplete events

```
lp.play([C3], [C4], [C5]);
```



