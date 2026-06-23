import { describe, it, expect, beforeAll, vi } from 'vitest';

import * as extra from '../src/core/extra.js';

beforeAll(() => {
  globalThis.window = {};
  globalThis.eventList = {
    events: [],
    create: (...evtLst) => {
      let e = Object.create(globalThis.eventList);
      e.events = evtLst;
      return e;
    },
    add: (...evtLst) => {},
    insert: (pos, ...evtLst) => {},
    clear: () => {},
    remove: (ndx = -1) => {},
  };
  globalThis.rnd = (min, max) => Math.random() * (max - min) + min;
  globalThis.rndInt = (min, max) =>
    Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min)) + Math.ceil(min));
  globalThis.choose = (...options) => options[0];
  globalThis.C4 = 60;
  globalThis.midPitch = () => 60;
});

describe('midiToName', () => {
  it('converts MIDI numbers to note names', () => {
    expect(extra.midiToName(60)).toBe('C4');
    expect(extra.midiToName(69)).toBe('A4');
    expect(extra.midiToName(0)).toBe('C-1');
    expect(extra.midiToName(127)).toBe('G9');
    expect(extra.midiToName(61)).toBe('Cs4');
    expect(extra.midiToName(71)).toBe('B4');
  });

  it('returns undefined for out-of-range values', () => {
    expect(extra.midiToName(-1)).toBeUndefined();
    expect(extra.midiToName(128)).toBeUndefined();
  });
});

describe('transpose', () => {
  it('transposes notes by positive interval', () => {
    expect(extra.transpose([60, 64, 67], 2)).toEqual([62, 66, 69]);
  });

  it('transposes by negative interval', () => {
    expect(extra.transpose([60, 64, 67], -5)).toEqual([55, 59, 62]);
  });

  it('returns empty array for empty input', () => {
    expect(extra.transpose([], 5)).toEqual([]);
  });

  it('defaults to interval 0', () => {
    expect(extra.transpose([60, 64])).toEqual([60, 64]);
  });
});

describe('edo', () => {
  it('returns correct number of divisions + 1', () => {
    expect(extra.edo(12)).toHaveLength(13);
    expect(extra.edo(24)).toHaveLength(25);
    expect(extra.edo(5)).toHaveLength(6);
    expect(extra.edo(1)).toHaveLength(2);
  });

  it('each step is equal for 6 divisions', () => {
    const result = extra.edo(6);
    for (let i = 1; i < result.length; i++) {
      expect(result[i] - result[i - 1]).toBeCloseTo(2, 10);
    }
  });

  it('starts at 0 and ends at 12', () => {
    const result = extra.edo(12);
    expect(result[0]).toBe(0);
    expect(result[result.length - 1]).toBe(12);
  });
});

describe('midiToFrequency', () => {
  it('A4 (69) is 440 Hz', () => {
    expect(extra.midiToFrequency(69)).toBeCloseTo(440, 1);
  });

  it('C4 (60) is approximately 261.63 Hz', () => {
    expect(extra.midiToFrequency(60)).toBeCloseTo(261.63, 0);
  });

  it('each octave doubles the frequency', () => {
    const f1 = extra.midiToFrequency(60);
    const f2 = extra.midiToFrequency(72);
    expect(f2 / f1).toBeCloseTo(2, 5);
  });
});

describe('frequencyToMidi', () => {
  it('440 Hz returns 69', () => {
    expect(extra.frequencyToMidi(440)).toBeCloseTo(69, 5);
  });

  it('roundtrip: midi -> freq -> midi', () => {
    const original = 60;
    const freq = extra.midiToFrequency(original);
    const back = extra.frequencyToMidi(freq);
    expect(back).toBeCloseTo(original, 5);
  });
});

describe('justIntonation', () => {
  it('generates the correct number of tones', () => {
    const result = extra.justIntonation(60, 8);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(9);
  });

  it('all tones are within one octave + root', () => {
    const root = 60;
    const result = extra.justIntonation(root, 14);
    for (const tone of result) {
      expect(tone).toBeGreaterThanOrEqual(root);
      expect(tone).toBeLessThanOrEqual(root + 12);
    }
  });

  it('contains the root note and the octave', () => {
    const result = extra.justIntonation(60, 14);
    expect(result).toContain(60);
    expect(result).toContain(72);
  });
});

describe('monotone', () => {
  it('returns a number', () => {
    const result = extra.monotone(60, 1);
    expect(typeof result).toBe('number');
  });
});

describe('randomChord', () => {
  it('returns an array of numbers', () => {
    const chord = extra.randomChord();
    expect(Array.isArray(chord)).toBe(true);
    for (const n of chord) {
      expect(typeof n).toBe('number');
    }
  });

  it('returns up to the requested size', () => {
    const chord = extra.randomChord(3);
    expect(chord.length).toBeLessThanOrEqual(3);
  });

  it('returns sorted unique notes with deterministic range', () => {
    const chord = extra.randomChord(6, () => 60);
    expect(chord).toEqual([60]);
  });
});

describe('invert', () => {
  it('inverts a melody modally around an axis', () => {
    const melody = [60, 64, 67];
    const axis = 60;
    const result = extra.invert(melody, axis);
    expect(result[0]).toBe(60);
    expect(result[1]).toBe(68);
    expect(result[2]).toBe(65);
  });

  it('preserves melody length', () => {
    const melody = [60, 62, 64, 65, 67];
    expect(extra.invert(melody, 60)).toHaveLength(5);
  });

  it('defaults axis to C4', () => {
    const melody = [60, 64, 67];
    const result = extra.invert(melody);
    expect(result).toEqual([60, 68, 65]);
  });
});

describe('retrograde', () => {
  it('reverses an array', () => {
    expect(extra.retrograde([1, 2, 3, 4])).toEqual([4, 3, 2, 1]);
  });

  it('mutates the original array', () => {
    const arr = [1, 2, 3];
    extra.retrograde(arr);
    expect(arr).toEqual([3, 2, 1]);
  });
});

describe('rotate', () => {
  it('rotates forward by default step of 1', () => {
    expect(extra.rotate([1, 2, 3, 4])).toEqual([2, 3, 4, 1]);
  });

  it('rotates by specified steps', () => {
    expect(extra.rotate([1, 2, 3, 4], 2)).toEqual([3, 4, 1, 2]);
  });

  it('handles negative steps', () => {
    expect(extra.rotate([1, 2, 3, 4], -1)).toEqual([4, 1, 2, 3]);
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3, 4];
    const result = extra.rotate(arr, 1);
    expect(arr).toEqual([1, 2, 3, 4]);
    expect(result).toEqual([2, 3, 4, 1]);
  });
});

describe('blend', () => {
  it('weaves two arrays of equal length', () => {
    expect(extra.blend([1, 2], [3, 4])).toEqual([1, 3, 2, 4]);
  });

  it('handles arrays of different lengths', () => {
    const result = extra.blend([1, 2, 3], [4, 5]);
    expect(result).toEqual([1, 4, 2, 5, 3, 4]);
  });
});

describe('shuffle', () => {
  it('returns an array with the same elements', () => {
    const input = [1, 2, 3, 4, 5];
    const result = extra.shuffle([...input]);
    expect(result.sort()).toEqual(input);
  });

  it('mutates the original array', () => {
    const input = [1, 2, 3, 4];
    extra.shuffle(input);
    expect(input).toHaveLength(4);
    expect(input.sort()).toEqual([1, 2, 3, 4]);
  });

  it('single-element array stays unchanged', () => {
    expect(extra.shuffle([42])).toEqual([42]);
  });
});

describe('resolveEvent (internal, tested via blockChord)', () => {
  it('is used internally by event-building functions', () => {
    const result = extra.blockChord();
    expect(result).toBeDefined();
    expect(typeof result.add).toBe('function');
  });
});

describe('faster', () => {
  it('returns an eventList-like result', () => {
    const result = extra.faster();
    expect(result).toBeDefined();
    expect(typeof result.add).toBe('function');
  });
});

describe('slower', () => {
  it('returns an eventList-like result', () => {
    const result = extra.slower();
    expect(result).toBeDefined();
    expect(typeof result.add).toBe('function');
  });
});

describe('louder', () => {
  it('returns an eventList-like result', () => {
    const result = extra.louder();
    expect(result).toBeDefined();
    expect(typeof result.add).toBe('function');
  });
});

describe('softer', () => {
  it('returns an eventList-like result', () => {
    const result = extra.softer();
    expect(result).toBeDefined();
    expect(typeof result.add).toBe('function');
  });
});

describe('blockChord', () => {
  it('returns an eventList-like result', () => {
    const result = extra.blockChord();
    expect(result).toBeDefined();
    expect(typeof result.add).toBe('function');
  });
});

describe('arpeggio', () => {
  it('returns an eventList-like result', () => {
    const result = extra.arpeggio();
    expect(result).toBeDefined();
    expect(typeof result.add).toBe('function');
  });
});

describe('intervalSequence', () => {
  it('returns an eventList-like result', () => {
    const result = extra.intervalSequence();
    expect(result).toBeDefined();
    expect(typeof result.add).toBe('function');
  });
});

describe('ostinato', () => {
  it('returns an eventList-like result', () => {
    const result = extra.ostinato();
    expect(result).toBeDefined();
    expect(typeof result.add).toBe('function');
  });
});

describe('euclidean', () => {
  it('returns an eventList-like result', () => {
    const result = extra.euclidean();
    expect(result).toBeDefined();
    expect(typeof result.add).toBe('function');
  });

  it('logs error when hits > steps', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    extra.euclidean(60, 1, 4, 6);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('rotationSequence', () => {
  it('returns an eventList-like result', () => {
    const result = extra.rotationSequence();
    expect(result).toBeDefined();
    expect(typeof result.add).toBe('function');
  });
});

describe('Portuguese aliases', () => {
  it('midiParaNome matches midiToName', () => {
    expect(extra.midiParaNome).toBe(extra.midiToName);
  });

  it('transpôr matches transpose', () => {
    expect(extra.transpôr).toBe(extra.transpose);
  });

  it('inverter matches invert', () => {
    expect(extra.inverter).toBe(extra.invert);
  });

  it('retrogradar matches retrograde', () => {
    expect(extra.retrogradar).toBe(extra.retrograde);
  });

  it('rotacionar matches rotate', () => {
    expect(extra.rotacionar).toBe(extra.rotate);
  });

  it('misturar matches blend', () => {
    expect(extra.misturar).toBe(extra.blend);
  });

  it('embaralhar matches shuffle', () => {
    expect(extra.embaralhar).toBe(extra.shuffle);
  });
});
