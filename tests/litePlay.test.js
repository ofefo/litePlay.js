import { describe, it, expect, beforeAll } from 'vitest';

let litePlay;

beforeAll(async () => {
  globalThis.quarterTone = 0.5;
  globalThis.thirdTone = 0.3333333333333333;
  globalThis.eighthTone = 0.25;
  globalThis.tenCent = 0.1;
  globalThis.oneCent = 0.01;
  globalThis.window = {};
  litePlay = await import('../src/core/litePlay.js');
});

describe('secs', () => {
  it('converts beats to seconds at default 60 BPM', () => {
    expect(litePlay.secs(1)).toBeCloseTo(1, 5);
    expect(litePlay.secs(60)).toBeCloseTo(60, 5);
    expect(litePlay.secs(0)).toBe(0);
  });
});

describe('beats', () => {
  it('converts seconds to beats at default 60 BPM', () => {
    expect(litePlay.beats(1)).toBeCloseTo(1, 5);
    expect(litePlay.beats(60)).toBeCloseTo(60, 5);
    expect(litePlay.beats(0)).toBe(0);
  });

  it('roundtrips with secs', () => {
    const original = 4.5;
    const sec = litePlay.secs(original);
    const back = litePlay.beats(sec);
    expect(back).toBeCloseTo(original, 5);
  });
});

describe('setBpm / getBpm', () => {
  it('defaults to 60 BPM', () => {
    expect(litePlay.getBpm()).toBe(60);
  });

  it('getBpm returns value set by setBpm', () => {
    litePlay.setBpm(120);
    expect(litePlay.getBpm()).toBe(120);
    litePlay.setBpm(90);
    expect(litePlay.getBpm()).toBe(90);
    litePlay.setBpm(60);
    expect(litePlay.getBpm()).toBe(60);
  });
});

describe('rnd', () => {
  it('returns a number within the given range', () => {
    for (let i = 0; i < 100; i++) {
      const val = litePlay.rnd(5, 10);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThan(10);
    }
  });

  it('returns a float', () => {
    const val = litePlay.rnd(0, 1);
    expect(Number.isInteger(val)).toBe(false);
  });
});

describe('rndInt', () => {
  it('returns an integer within the given range', () => {
    for (let i = 0; i < 100; i++) {
      const val = litePlay.rndInt(0, 10);
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(10);
    }
  });
});

describe('choose', () => {
  it('returns one of the provided options', () => {
    const options = [1, 2, 3, 4, 5];
    const result = litePlay.choose(...options);
    expect(options).toContain(result);
  });

  it('handles a single array argument', () => {
    const options = [1, 2, 3];
    const result = litePlay.choose(options);
    expect(options).toContain(result);
  });
});

describe('dictionaryToArray', () => {
  it('converts an object to an array of parameters', () => {
    const input = { what: 60, howLoud: 0.8, when: 1, howLong: 2 };
    const result = litePlay.dictionaryToArray(input);
    expect(result[0]).toBe(60);
    expect(result[1]).toBe(0.8);
    expect(result[2]).toBe(1);
    expect(result[3]).toBe(2);
  });

  it('passes through an array unchanged', () => {
    const input = [60, 0.5, 0, 1];
    expect(litePlay.dictionaryToArray(input)).toBe(input);
  });
});

describe('sub', () => {
  it('creates a subdivision object', () => {
    const s = litePlay.sub(60, 64, 67);
    expect(s).toEqual({ isSub: true, notes: [60, 64, 67] });
  });
});

describe('Instrument', () => {
  it('constructor sets basic properties', () => {
    const instr = new litePlay.Instrument(0);
    expect(instr.pgm).toBe(0);
    expect(instr.isDrums).toBe(false);
    expect(instr.chn).toBeGreaterThanOrEqual(16);
    expect(instr.instr).toBe(10);
  });

  it('drum instrument sets isDrums flag', () => {
    const drumInstr = new litePlay.Instrument(2, true, 40);
    expect(drumInstr.isDrums).toBe(true);
  });

  it('what sets the pitch', () => {
    const instr = new litePlay.Instrument(0);
    instr.what(72);
    expect(instr.what_).toBe(72);
  });

  it('score generates a Csound score string', () => {
    const instr = new litePlay.Instrument(0);
    const score = instr.score(60, 0.5, 0, 1);
    expect(typeof score).toBe('string');
    expect(score).toMatch(/^i/);
    expect(score).toContain('60');
  });
});

describe('audioClock', () => {
  it('returns 0 when no audio context', () => {
    expect(litePlay.audioClock()).toBe(0);
  });
});

describe('Level generators', () => {
  it('softLevel returns value in [0.01, 0.1)', () => {
    for (let i = 0; i < 50; i++) {
      const v = litePlay.softLevel();
      expect(v).toBeGreaterThanOrEqual(0.01);
      expect(v).toBeLessThan(0.1);
    }
  });

  it('midLevel returns value in [0.1, 0.4)', () => {
    for (let i = 0; i < 50; i++) {
      const v = litePlay.midLevel();
      expect(v).toBeGreaterThanOrEqual(0.1);
      expect(v).toBeLessThan(0.4);
    }
  });

  it('loudLevel returns value in [0.4, 0.9)', () => {
    for (let i = 0; i < 50; i++) {
      const v = litePlay.loudLevel();
      expect(v).toBeGreaterThanOrEqual(0.4);
      expect(v).toBeLessThan(0.9);
    }
  });
});

describe('Duration generators', () => {
  it('shortDuration returns value in [0.05, 0.2)', () => {
    for (let i = 0; i < 50; i++) {
      const v = litePlay.shortDuration();
      expect(v).toBeGreaterThanOrEqual(0.05);
      expect(v).toBeLessThan(0.2);
    }
  });

  it('midDuration returns value in [0.2, 2)', () => {
    for (let i = 0; i < 50; i++) {
      const v = litePlay.midDuration();
      expect(v).toBeGreaterThanOrEqual(0.2);
      expect(v).toBeLessThan(2);
    }
  });

  it('longDuration returns value in [2, 5)', () => {
    for (let i = 0; i < 50; i++) {
      const v = litePlay.longDuration();
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThan(5);
    }
  });
});

describe('Timing generators', () => {
  it('now returns value in [0.01, 0.5)', () => {
    for (let i = 0; i < 50; i++) {
      const v = litePlay.now();
      expect(v).toBeGreaterThanOrEqual(0.01);
      expect(v).toBeLessThan(0.5);
    }
  });

  it('soon returns value in [0.5, 4)', () => {
    for (let i = 0; i < 50; i++) {
      const v = litePlay.soon();
      expect(v).toBeGreaterThanOrEqual(0.5);
      expect(v).toBeLessThan(4);
    }
  });

  it('later returns value in [4, 8)', () => {
    for (let i = 0; i < 50; i++) {
      const v = litePlay.later();
      expect(v).toBeGreaterThanOrEqual(4);
      expect(v).toBeLessThan(8);
    }
  });
});

describe('Pitch generators', () => {
  it('lowPitch returns value in [12, 48)', () => {
    for (let i = 0; i < 50; i++) {
      const v = litePlay.lowPitch();
      expect(v).toBeGreaterThanOrEqual(12);
      expect(v).toBeLessThan(48);
    }
  });

  it('midPitch returns value in [48, 72)', () => {
    for (let i = 0; i < 50; i++) {
      const v = litePlay.midPitch();
      expect(v).toBeGreaterThanOrEqual(48);
      expect(v).toBeLessThan(72);
    }
  });

  it('hiPitch returns value in [72, 108)', () => {
    for (let i = 0; i < 50; i++) {
      const v = litePlay.hiPitch();
      expect(v).toBeGreaterThanOrEqual(72);
      expect(v).toBeLessThan(108);
    }
  });
});

describe('Instrument instances', () => {
  it('grandPiano is an Instrument with pgm 0', () => {
    expect(litePlay.grandPiano.pgm).toBe(0);
  });

  it('piano alias points to grandPiano', () => {
    expect(litePlay.piano).toBe(litePlay.grandPiano);
  });

  it('drums is a drum instrument', () => {
    expect(litePlay.drums.isDrums).toBe(true);
  });

  it('bass alias points to fretlessBass', () => {
    expect(litePlay.bass).toBe(litePlay.fretlessBass);
  });
});

describe('Random instrument selectors', () => {
  it('onSomething returns an Instrument', () => {
    expect(litePlay.onSomething()).toBeInstanceOf(litePlay.Instrument);
  });

  it('onDrums returns a number (due to comma-operator bug in source)', () => {
    const result = litePlay.onDrums();
    expect(typeof result).toBe('number');
  });

  it('onStruck returns an Instrument', () => {
    expect(litePlay.onStruck()).toBeInstanceOf(litePlay.Instrument);
  });

  it('onPluck returns an Instrument', () => {
    expect(litePlay.onPluck()).toBeInstanceOf(litePlay.Instrument);
  });

  it('onBowed returns an Instrument', () => {
    expect(litePlay.onBowed()).toBeInstanceOf(litePlay.Instrument);
  });

  it('onBlow returns an Instrument', () => {
    expect(litePlay.onBlow()).toBeInstanceOf(litePlay.Instrument);
  });

  it('onWind returns an Instrument', () => {
    expect(litePlay.onWind()).toBeInstanceOf(litePlay.Instrument);
  });

  it('onLead returns an Instrument', () => {
    expect(litePlay.onLead()).toBeInstanceOf(litePlay.Instrument);
  });
});

describe('eventList', () => {
  it('create returns a new event list', () => {
    const evt = litePlay.eventList.create(60, 64);
    expect(evt.events).toEqual([60, 64]);
  });

  it('add appends events', () => {
    const evt = litePlay.eventList.create();
    evt.add(60);
    expect(evt.events).toContain(60);
  });

  it('clear empties events', () => {
    const evt = litePlay.eventList.create(60);
    evt.clear();
    expect(evt.events).toEqual([]);
  });

  it('remove pops last event by default', () => {
    const evt = litePlay.eventList.create(60, 64, 67);
    evt.remove();
    expect(evt.events).toEqual([60, 64]);
  });

  it('remove removes at index', () => {
    const evt = litePlay.eventList.create(60, 64, 67);
    evt.remove(0);
    expect(evt.events).toEqual([64, 67]);
  });

  it('insert adds at position', () => {
    const evt = litePlay.eventList.create(60, 67);
    evt.insert(1, 64);
    expect(evt.events).toEqual([60, 64, 67]);
  });
});

describe('sequencer', () => {
  it('is initially stopped', () => {
    expect(litePlay.sequencer.isRunning()).toBe(false);
  });

  it('clickOn is initially false', () => {
    expect(litePlay.sequencer.clickOn).toBe(false);
  });
});

describe('silently', () => {
  it('returns a promise', () => {
    const p = litePlay.silently(100);
    expect(p).toBeInstanceOf(Promise);
  });
});

describe('Portuguese aliases', () => {
  it('toque matches play', () => {
    expect(litePlay.toque).toBe(litePlay.play);
  });

  it('pare matches stop', () => {
    expect(litePlay.pare).toBe(litePlay.stop);
  });

  it('instrumento matches instrument', () => {
    expect(litePlay.instrumento).toBe(litePlay.instrument);
  });

  it('bateria matches drums1', () => {
    expect(litePlay.bateria).toBe(litePlay.drums1);
  });
});
