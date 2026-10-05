class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Maintain the 4096 buffer size needed by Essentia for pitch detection
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.pointer = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    // Check if input stream is active
    if (input && input.length > 0) {
      const channelData = input[0];

      // Accumulate the standard 128 frames into our 4096 buffer
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.pointer] = channelData[i];
        this.pointer++;

        // Once our buffer is full, ship it to the main thread and reset
        if (this.pointer >= this.bufferSize) {
          // `currentFrame` is a global in AudioWorkletGlobalScope counting
          // frames since context creation. The first sample in this buffer is
          // one full window behind it, so this is the true capture position.
          // Without it the main thread can only timestamp on arrival, which
          // charges the listener a full window of latency that belongs to this
          // transport rather than to the detector.
          //
          // postMessage takes (message, transfer), so the frame index rides
          // along as a field on the message object; only the typed array's
          // buffer is transferred.
          const samples = new Float32Array(this.buffer);
          this.port.postMessage(
            { samples, frame: currentFrame - this.bufferSize },
            [samples.buffer],
          );
          this.pointer = 0;
        }
      }
    }

    // Return true to keep the processor alive in the background
    return true;
  }
}

registerProcessor("audio-capture-processor", AudioCaptureProcessor);