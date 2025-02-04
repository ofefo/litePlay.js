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

which loads the module, starts the audio engine, and then calls the function `f` which is supplied to it. At the simplest, we can have the following JS script code

```
function code() {
    console.log("litePlay.js: ready")
}
lpRun(code);
```

which tells the user that the system is ready to use when the message is printed to the JS console. The function `code()` can be use as the starting point of the litePlay.js application.
Or it can simply contain all the code that is to be executed when the script is run.

