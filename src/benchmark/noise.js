/**
 * A low-level noise bed injected into Csound's input bus.
 *
 * Digital silence has no noise floor, but every real microphone and live room
 * does. A detector whose threshold is absolute rather than adaptive rides on
 * top of the noise bed and reports constant false onsets, which is exactly the
 * failure mode this is meant to expose.
 *
 * The noise is summed into csoundNode's input, so it reaches `instr 99`'s `ain`
 * without needing any change to the CSD.
 */
export function createNoiseBed(audioCtx, csoundNode) {
  return function startNoise(amp) {
    const frames = Math.floor(audioCtx.sampleRate * 2);
    const buffer = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    // Deterministic noise so a regression is reproducible between runs.
    let seed = 22222 >>> 0;
    for (let i = 0; i < frames; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = (seed / 4294967296) * 2 - 1;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = audioCtx.createGain();
    gain.gain.value = amp;

    source.connect(gain);
    gain.connect(csoundNode);
    source.start();

    return function stopNoise() {
      try {
        source.stop();
      } catch (e) {
        // Already stopped
      }
      try {
        gain.disconnect();
      } catch (e) {}
      try {
        source.disconnect();
      } catch (e) {}
    };
  };
}