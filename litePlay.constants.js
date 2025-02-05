// litePlay URL
const lp_URL = "https://vlazzarini.github.io/litePlay.js/litePlay.js";

// MIDI NOTE constants

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

function notes(start) {
  let l = [];
  for (let i = start; i < 127; i += 12) l.push(i);
  return l;
}

const C = notes(0);
const C0 = C[2], C1 = C[3], C2 = C[4], C3 = C[5], C4 = C[6],
      C5 = C[7], C6 = C[8], C7 = C[9], Cm1 = C[1], Cm2 = C[0];
const Cs = notes(1);
const Cs0 = Cs[2], Cs1 = Cs[3], Cs2 = Cs[4], Cs3 = Cs[5], Cs4 = Cs[6],
      Cs5 = Cs[7], Cs6 = Cs[8], Cs7 = Cs[9], Csm1 = Cs[1], Csm2 = Cs[0];
const Db = Cs;
const Db0 = Db[2], Db1 = Db[3], Db2 = Db[4], Db3 = Db[5], Db4 = Db[6],
      Db5 = Db[7], Db6 = Db[8], Db7 = Db[9], Dbm1 = Db[1], Dbm2 = Db[0];
const D = notes(2);
const D0 = D[2], D1 = D[3], D2 = D[4], D3 = D[5], D4 = D[6],
      D5 = D[7], D6 = D[8], D7 = D[9], Dm1 = D[1], Dm2 = D[0];
const Ds = notes(3);
const Ds0 = Ds[2], Ds1 = Ds[3], Ds2 = Ds[4], Ds3 = Ds[5], Ds4 = Ds[6],
      Ds5 = Ds[7], Ds6 = Ds[8], Ds7 = Ds[9], Dsm1 = Ds[1], Dsm2 = Ds[0];
const Eb = Ds;
const Eb0 = Eb[2], Eb1 = Eb[3], Eb2 = Eb[4], Eb3 = Eb[5], Eb4 = Eb[6],
      Eb5 = Eb[7], Eb6 = Eb[8], Eb7 = Eb[9], Ebm1 = Eb[1], Ebm2 = Eb[0];
const E = notes(4);
const E0 = E[2], E1 = E[3], E2 = E[4], E3 = E[5], E4 = E[6],
      E5 = E[7], E6 = E[8], E7 = E[9], Em1 = E[1], Em2 = E[0];
const Es = notes(5);
const Es0 = Es[2], Es1 = Es[3], Es2 = Es[4], Es3 = Es[5], Es4 = Es[6],
      Es5 = Es[7], Es6 = Es[8], Es7 = Es[9], Esm1 = Es[1], Esm2 = Es[0];
const F = Es;
const F0 = F[2], F1 = F[3], F2 = F[4], F3 = F[5], F4 = F[6],
      F5 = F[7], F6 = F[8], F7 = F[9], Fm1 = F[1], Fm2 = F[0];
const Fs = notes(6);
const Fs0 = Fs[2], Fs1 = Fs[3], Fs2 = Fs[4], Fs3 = Fs[5], Fs4 = Fs[6],
      Fs5 = Fs[7], Fs6 = Fs[8], Fs7 = Fs[9], Fsm1 = Fs[1], Fsm2 = Fs[0];
const Gb = Fs;
const Gb0 = Gb[2], Gb1 = Gb[3], Gb2 = Gb[4], Gb3 = Gb[5], Gb4 = Gb[6],
      Gb5 = Gb[7], Gb6 = Gb[8], Gb7 = Gb[9], Gbm1 = Gb[1], Gbm2 = Gb[0];
const G = notes(7);
const G0 = G[2], G1 = G[3], G2 = G[4], G3 = G[5], G4 = G[6],
      G5 = G[7], G6 = G[8], G7 = G[9], Gm1 = G[1], Gm2 = G[0];
const Gs = notes(8);
const Gs0 = Gs[2], Gs1 = Gs[3], Gs2 = Gs[4], Gs3 = Gs[5], Gs4 = Gs[6],
      Gs5 = Gs[7], Gs6 = Gs[8], Gs7 = Gs[9], Gsm1 = Gs[1], Gsm2 = Gs[0];
const Ab = Gs;
const Ab0 = Ab[2], Ab1 = Ab[3], Ab2 = Ab[4], Ab3 = Ab[5], Ab4 = Ab[6],
      Ab5 = Ab[7], Ab6 = Ab[8], Abm1 = Ab[1], Abm2 = Ab[0];
const A = notes(9);
const A0 = A[2], A1 = A[3], A2 = A[4], A3 = A[5], A4 = A[6],
      A5 = A[7], A6 = A[8], Am1 = A[1], Am2 = A[0];
const As = notes(10);
const As0 = As[2], As1 = As[3], As2 = As[4], As3 = As[5], As4 = As[6],
      As5 = As[7], As6 = As[8], Asm1 = As[1], Asm2 = As[0];
const Bb = As;
const Bb0 = Bb[2], Bb1 = Bb[3], Bb2 = Bb[4], Bb3 = Bb[5], Bb4 = Bb[6],
      Bb5 = Bb[7], Bb6 = Bb[8], Bbm1 = Bb[1], Bbm2 = Bb[0];
const B = notes(12);
const B0 = B[2], B1 = B[3], B2 = B[4], B3 = B[5], B4 = B[6],
      B5 = B[7], B6 = B[8], Bm1 = B[1], Bm2 = B[0];
const Bs = C;
const Bs0 = Bs[2], Bs1 = Bs[3], Bs2 = Bs[4], Bs3 = Bs[5], Bs4 = Bs[6],
      Bs5 = Bs[7], Bs6 = Bs[8], Bs7 = Bs[9], Bsm1 = Bs[1], Bsm2 = Bs[0];
const O = -999;

const quarterTone = 0.25;
const thirdTone =  0.333;
const oneCent = 0.01;
const tenCent = 0.1;

const lpRun = (code = null) => {
     import(lp_URL).then((val) => {
         lp = val; 
         lp.startEngine().then(() => { 
             if(typeof(code) === 'function') code();
             else console.log("litePlay.js: running\n");
         }
       );
     });
}
