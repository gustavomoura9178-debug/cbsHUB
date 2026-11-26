// Adapted from @timephy/rnnoise-wasm/dist/NoiseSuppressorWorklet.js.
// The package embeds RNNoise 0.2 as base64; the renderer supplies the same
// validated bytes through processorOptions so no URL/fetch is needed.
import "../../node_modules/@timephy/rnnoise-wasm/dist/polyfills.js";
import RnnoiseProcessor from "../../node_modules/@timephy/rnnoise-wasm/dist/RnnoiseProcessor.js";
import createRNNWasmModuleSync from "../../node_modules/@timephy/rnnoise-wasm/dist/generated/rnnoise-sync.js";
import { NoiseSuppressorWorklet_Name } from "@timephy/rnnoise-wasm";
import { leastCommonMultiple } from "../../node_modules/@timephy/rnnoise-wasm/dist/math.js";

class NoiseSuppressorWorklet extends AudioWorkletProcessor {
  constructor(options = {}) {
    super();

    const processorOptions = options.processorOptions || {};
    if (processorOptions.maxChannels !== 1) {
      throw new Error("RNNoise requires maxChannels: 1");
    }
    if (!(processorOptions.wasmBinary instanceof ArrayBuffer)) {
      throw new Error("RNNoise requires a cached WASM ArrayBuffer");
    }

    this.destroyed = false;
    this.denoiseProcessor = new RnnoiseProcessor(
      createRNNWasmModuleSync({ wasmBinary: processorOptions.wasmBinary }),
    );
    this.procNodeSampleRate = 128;
    this.denoiseSampleSize = this.denoiseProcessor.getSampleLength();
    this.circularBufferLength = leastCommonMultiple(
      this.procNodeSampleRate,
      this.denoiseSampleSize,
    );
    this.circularBuffer = new Float32Array(this.circularBufferLength);
    this.inputBufferLength = 0;
    this.denoisedBufferLength = 0;
    this.denoisedBufferIndex = 0;

    this.port.onmessage = (event) => {
      if (event.data?.type !== "destroy") return;
      this.destroyed = true;
      this.denoiseProcessor.destroy();
    };
  }

  process(inputs, outputs) {
    if (this.destroyed) return false;

    // RNNoise is deliberately mono. Soundboard audio never enters this node.
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!input || !output) return true;

    this.circularBuffer.set(input, this.inputBufferLength);
    this.inputBufferLength += input.length;

    for (
      ;
      this.denoisedBufferLength + this.denoiseSampleSize <=
      this.inputBufferLength;
      this.denoisedBufferLength += this.denoiseSampleSize
    ) {
      const denoiseFrame = this.circularBuffer.subarray(
        this.denoisedBufferLength,
        this.denoisedBufferLength + this.denoiseSampleSize,
      );
      this.denoiseProcessor.processAudioFrame(denoiseFrame, true);
    }

    const unsentDenoisedDataLength =
      this.denoisedBufferIndex > this.denoisedBufferLength
        ? this.circularBufferLength - this.denoisedBufferIndex
        : this.denoisedBufferLength - this.denoisedBufferIndex;

    if (unsentDenoisedDataLength >= output.length) {
      const denoisedFrame = this.circularBuffer.subarray(
        this.denoisedBufferIndex,
        this.denoisedBufferIndex + output.length,
      );
      output.set(denoisedFrame, 0);
      this.denoisedBufferIndex += output.length;
    }

    if (this.denoisedBufferIndex === this.circularBufferLength) {
      this.denoisedBufferIndex = 0;
    }
    if (this.inputBufferLength === this.circularBufferLength) {
      this.inputBufferLength = 0;
      this.denoisedBufferLength = 0;
    }
    return true;
  }
}

registerProcessor(NoiseSuppressorWorklet_Name, NoiseSuppressorWorklet);
