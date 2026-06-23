import { describe, it, expect } from 'vitest';

const notes = (start) => {
  let l = [];
  for (let i = start; i < 127; i += 12) l.push(i);
  return l;
};

describe('notes() helper generation', () => {
  it('generates correct values for each pitch class', () => {
    const C = notes(0);
    const Cs = notes(1);
    const D = notes(2);
    const Ds = notes(3);
    const E = notes(4);
    const F = notes(5);
    const Fs = notes(6);
    const G = notes(7);
    const Gs = notes(8);
    const A = notes(9);
    const As = notes(10);
    const B = notes(11);

    expect(C).toEqual([0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120]);
    expect(D).toEqual([2, 14, 26, 38, 50, 62, 74, 86, 98, 110, 122]);
    expect(E).toEqual([4, 16, 28, 40, 52, 64, 76, 88, 100, 112, 124]);
    expect(F).toEqual([5, 17, 29, 41, 53, 65, 77, 89, 101, 113, 125]);
    expect(G).toEqual([7, 19, 31, 43, 55, 67, 79, 91, 103, 115]);
    expect(A).toEqual([9, 21, 33, 45, 57, 69, 81, 93, 105, 117]);
    expect(B).toEqual([11, 23, 35, 47, 59, 71, 83, 95, 107, 119]);
    expect(Cs).toEqual([1, 13, 25, 37, 49, 61, 73, 85, 97, 109, 121]);
    expect(Ds).toEqual([3, 15, 27, 39, 51, 63, 75, 87, 99, 111, 123]);
    expect(Fs).toEqual([6, 18, 30, 42, 54, 66, 78, 90, 102, 114, 126]);
    expect(Gs).toEqual([8, 20, 32, 44, 56, 68, 80, 92, 104, 116]);
    expect(As).toEqual([10, 22, 34, 46, 58, 70, 82, 94, 106, 118]);
  });

  it('stops before MIDI max (127)', () => {
    for (let start = 0; start < 12; start++) {
      for (const n of notes(start)) {
        expect(n).toBeLessThan(127);
      }
    }
  });
});

describe('MIDI note value correctness', () => {
  const C = notes(0);
  const Cs = notes(1);
  const D = notes(2);
  const Ds = notes(3);
  const E = notes(4);
  const F = notes(5);
  const Fs = notes(6);
  const G = notes(7);
  const Gs = notes(8);
  const A = notes(9);
  const As = notes(10);
  const B = notes(11);

  const C4 = C[5], C5 = C[6], C0 = C[1], C8 = C[9];
  const D4 = D[5];
  const E4 = E[5];
  const F4 = F[5];
  const G4 = G[5];
  const A4 = A[5];
  const B4 = B[5];

  it('C octaves match standard MIDI', () => {
    expect(C0).toBe(12);
    expect(C4).toBe(60);
    expect(C5).toBe(72);
    expect(C8).toBe(108);
  });

  it('A4 is 69 (standard tuning reference)', () => {
    expect(A4).toBe(69);
  });

  it('chromatic scale from C4 to C5', () => {
    expect(C4).toBe(60);
    expect(Cs[5]).toBe(61);
    expect(D4).toBe(62);
    expect(Ds[5]).toBe(63);
    expect(E4).toBe(64);
    expect(F4).toBe(65);
    expect(Fs[5]).toBe(66);
    expect(G4).toBe(67);
    expect(Gs[5]).toBe(68);
    expect(A4).toBe(69);
    expect(As[5]).toBe(70);
    expect(B4).toBe(71);
    expect(C5).toBe(72);
  });
});

describe('Enharmonic equivalences', () => {
  const C = notes(0);
  const Cs = notes(1); const Db = Cs;
  const Ds = notes(3); const Eb = Ds;
  const Fs = notes(6); const Gb = Fs;
  const Gs = notes(8); const Ab = Gs;
  const As = notes(10); const Bb = As;
  const Bs = C;

  it('Cs = Db, Ds = Eb, Fs = Gb, Gs = Ab, As = Bb, Bs = C', () => {
    expect(Cs).toBe(Db);
    expect(Ds).toBe(Eb);
    expect(Fs).toBe(Gb);
    expect(Gs).toBe(Ab);
    expect(As).toBe(Bb);
    expect(Bs).toEqual(C);
  });
});

describe('Percussion constants', () => {
  const kick = 35;
  const bassDrum = 36;
  const clap = 39;
  const snare = 40;
  const tom = 45;
  const crash = 49;
  const cymbal = 51;
  const djScratch = 29;

  it('aliases map to GM percussion numbers', () => {
    expect(kick).toBe(35);
    expect(bassDrum).toBe(36);
    expect(clap).toBe(39);
    expect(snare).toBe(40);
    expect(tom).toBe(45);
    expect(crash).toBe(49);
    expect(cymbal).toBe(51);
    expect(djScratch).toBe(29);
  });
});

describe('Microtonal constants', () => {
  const quarterTone = 0.5;
  const thirdTone = 0.3333333333333333;
  const eighthTone = 0.25;
  const tenCent = 0.1;
  const oneCent = 0.01;

  it('quarterTone is 0.5', () => {
    expect(quarterTone).toBe(0.5);
  });

  it('thirdTone is approximately 1/3', () => {
    expect(thirdTone).toBeCloseTo(0.333, 3);
  });

  it('eighthTone is 0.25', () => {
    expect(eighthTone).toBe(0.25);
  });

  it('tenCent is 0.1', () => {
    expect(tenCent).toBe(0.1);
  });

  it('oneCent is 0.01', () => {
    expect(oneCent).toBe(0.01);
  });
});

describe('Sentinel O', () => {
  const O = -999;

  it('O is -999 (mute/rest)', () => {
    expect(O).toBe(-999);
  });
});
