import { NoiseSuppressorWorklet_Name } from "@timephy/rnnoise-wasm";
import rnnoiseWasmBase64 from "../../node_modules/@timephy/rnnoise-wasm/dist/generated/rnnoise-sync.js?rnnoise-wasm-base64";
import rnnoiseWorkletSource from "./rnnoiseWorklet.js?audioworklet-source";
import { createAudioPeakGuard, safeAudioGain } from "./audioPeakGuard";
import { callEvent } from "./callDiagnostics";
import type { AudioProcessingConfig } from "../types/cbshub";

// Stock NoiseSuppressorWorklet emits its first denoised quantum after four
// 128-sample inputs. Delaying the clean route equally prevents phase/latency
// jumps during a live crossfade.
const RNNOISE_LATENCY_SAMPLES = 384;
const RNNOISE_CROSSFADE_SECONDS = 0.02;

let cachedRnnoiseWasmBinary: ArrayBuffer | null = null;
let rnnoiseWasmBinaryPromise: Promise<ArrayBuffer> | null = null;
let rnnoiseWorkletBlobUrl: string | null = null;

async function getRnnoiseWasmBinary(): Promise<ArrayBuffer> {
  if (cachedRnnoiseWasmBinary) return cachedRnnoiseWasmBinary;
  if (!rnnoiseWasmBinaryPromise) {
    rnnoiseWasmBinaryPromise = Promise.resolve().then(() => {
      const decoded = atob(rnnoiseWasmBase64);
      const buffer = new ArrayBuffer(decoded.length);
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i);
      }
      if (!WebAssembly.validate(buffer)) {
        throw new Error("Invalid embedded RNNoise WebAssembly binary");
      }
      cachedRnnoiseWasmBinary = buffer;
      return buffer;
    });
  }

  try {
    return await rnnoiseWasmBinaryPromise;
  } catch (error) {
    rnnoiseWasmBinaryPromise = null;
    throw error;
  }
}

function getRnnoiseWorkletBlobUrl(): string {
  if (!rnnoiseWorkletBlobUrl) {
    rnnoiseWorkletBlobUrl = URL.createObjectURL(
      new Blob([rnnoiseWorkletSource], { type: "application/javascript" }),
    );
  }
  return rnnoiseWorkletBlobUrl;
}

function rampAudioParam(
  param: AudioParam,
  target: number,
  context: AudioContext,
  immediate: boolean,
): void {
  const now = context.currentTime;
  if (immediate) {
    param.cancelScheduledValues(now);
    param.setValueAtTime(target, now);
    return;
  }

  // cancelAndHold avoids jumps even if the user toggles during another ramp.
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(now);
  } else {
    const current = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(current, now);
  }
  param.linearRampToValueAtTime(target, now + RNNOISE_CROSSFADE_SECONDS);
}

class RnnoiseWorkletNode extends AudioWorkletNode {
  constructor(context: AudioContext, wasmBinary: ArrayBuffer) {
    super(context, NoiseSuppressorWorklet_Name, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
      processorOptions: { maxChannels: 1, wasmBinary },
    });
  }
}

export type SpeakingCallback = (isSpeaking: boolean, level: number) => void;

export class VoiceAudioPipeline {
  private rawStream: MediaStream;
  private config: AudioProcessingConfig;
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;
  private workletNode: RnnoiseWorkletNode | null = null;
  private cleanBypassDelay: DelayNode | null = null;
  private cleanBypassGain: GainNode | null = null;
  private denoisedGain: GainNode | null = null;
  private nativeNoiseFallbackActive = false;
  private nativeNoiseFallbackRevision = 0;
  private outputPeakGuard: WaveShaperNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private micMuteNode: GainNode | null = null;
  private soundboardInputNode: GainNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private processedStream: MediaStream | null = null;
  private meterInterval: number | null = null;
  private onSpeakingChange: SpeakingCallback | null = null;
  private isDestroyed = false;
  private isMicMuted = false;
  private onInterrupted: (() => void) | null = null;
  private suspendTimer: number | null = null;
  private soundboardCompressorNode: DynamicsCompressorNode | null = null;

  constructor(
    stream: MediaStream,
    config: AudioProcessingConfig,
    onSpeakingChange?: SpeakingCallback,
  ) {
    this.rawStream = stream;
    this.config = { ...config };
    if (onSpeakingChange) {
      this.onSpeakingChange = onSpeakingChange;
    }
  }

  public async initialize(): Promise<MediaStream> {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.audioCtx = new AudioCtx({
      sampleRate: 48000,
      latencyHint: "interactive",
    });

    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }

    // Um AudioContext suspenso (troca de dispositivo, driver, política do
    // navegador) deixa a trilha enviada em silêncio sem disparar "ended".
    // Tenta retomar e só avisa o motor se continuar parado.
    this.audioCtx.onstatechange = () => {
      const ctx = this.audioCtx;
      if (this.isDestroyed || !ctx || ctx.state === "closed") return;
      if (ctx.state === "running") {
        this.clearSuspendTimer();
        return;
      }
      ctx.resume().catch(() => {});
      if (this.suspendTimer !== null) return;
      this.suspendTimer = window.setTimeout(() => {
        this.suspendTimer = null;
        if (this.isDestroyed || !this.audioCtx) return;
        if (this.audioCtx.state !== "running") this.onInterrupted?.();
      }, 2000);
    };

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.rawStream);

    // Biquad High-Pass Filter @ 80Hz, Q=0.707 (Corta ruído de mesa / coolers)
    this.highPassFilter = this.audioCtx.createBiquadFilter();
    this.highPassFilter.type = "highpass";
    this.highPassFilter.frequency.setValueAtTime(
      this.config.highPassFilter80Hz ? 80 : 10,
      this.audioCtx.currentTime,
    );
    this.highPassFilter.Q.setValueAtTime(0.707, this.audioCtx.currentTime);

    // Biquad Low-Pass Filter @ 14000Hz (Corta chiado agudo elétrico)
    this.lowPassFilter = this.audioCtx.createBiquadFilter();
    this.lowPassFilter.type = "lowpass";
    this.lowPassFilter.frequency.setValueAtTime(
      14000,
      this.audioCtx.currentTime,
    );

    // O código já chega empacotado e o WASM já vem em memória: nenhum fetch,
    // caminho absoluto ou acesso file:// é necessário, inclusive no .exe.
    try {
      const wasmBinary = await getRnnoiseWasmBinary();
      await this.audioCtx.audioWorklet.addModule(getRnnoiseWorkletBlobUrl());
      if (this.isDestroyed) throw new Error("Audio pipeline destroyed");

      this.workletNode = new RnnoiseWorkletNode(this.audioCtx, wasmBinary);
      this.cleanBypassDelay = this.audioCtx.createDelay(1);
      this.cleanBypassDelay.delayTime.setValueAtTime(
        RNNOISE_LATENCY_SAMPLES / this.audioCtx.sampleRate,
        this.audioCtx.currentTime,
      );
      this.cleanBypassGain = this.audioCtx.createGain();
      this.denoisedGain = this.audioCtx.createGain();
      this.setRnnoiseEnabled(this.config.neuralNoiseGate, true);
    } catch (error) {
      // Nunca derruba o microfone: rota limpa + supressão nativa de contingência.
      callEvent("audio_processor_error");
      console.warn("[Audio] RNNoise unavailable; using native fallback", error);
      this.workletNode?.port.close();
      this.workletNode?.disconnect();
      this.workletNode = null;
      this.cleanBypassDelay = null;
      this.cleanBypassGain = null;
      this.denoisedGain = null;
      this.syncNativeNoiseFallback();
    }

    // Compressor vocal dinâmico
    this.compressorNode = this.audioCtx.createDynamicsCompressor();
    this.compressorNode.threshold.setValueAtTime(
      -18,
      this.audioCtx.currentTime,
    );
    this.compressorNode.knee.setValueAtTime(12, this.audioCtx.currentTime);
    this.compressorNode.ratio.setValueAtTime(4, this.audioCtx.currentTime);
    this.compressorNode.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
    this.compressorNode.release.setValueAtTime(0.25, this.audioCtx.currentTime);

    // Ganho do microfone (micGain)
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.setValueAtTime(
      safeAudioGain(this.config.micGain),
      this.audioCtx.currentTime,
    );

    // Analisador para VU meter e detecção de fala Discord-style
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.analyserNode.smoothingTimeConstant = 0.4;

    // Nó de mute suave exclusivo do Microfone (corta voz sem cortar o Soundboard!)
    this.micMuteNode = this.audioCtx.createGain();
    this.micMuteNode.gain.setValueAtTime(
      this.isMicMuted ? 0 : 1,
      this.audioCtx.currentTime,
    );

    // Destino final para envio WebRTC
    this.destinationNode = this.audioCtx.createMediaStreamDestination();

    // Protect the sum of microphone and effects before WebRTC, independently of mute/gate.
    this.outputPeakGuard = createAudioPeakGuard(this.audioCtx);
    this.outputPeakGuard.connect(this.destinationNode);

    // Compressor dinâmico rápido dedicado aos efeitos sonoros para prevenir estouro/clipagem de DAC
    this.soundboardCompressorNode = this.audioCtx.createDynamicsCompressor();
    this.soundboardCompressorNode.threshold.setValueAtTime(-6, this.audioCtx.currentTime);
    this.soundboardCompressorNode.knee.setValueAtTime(6, this.audioCtx.currentTime);
    this.soundboardCompressorNode.ratio.setValueAtTime(8, this.audioCtx.currentTime);
    this.soundboardCompressorNode.attack.setValueAtTime(0.001, this.audioCtx.currentTime);
    this.soundboardCompressorNode.release.setValueAtTime(0.08, this.audioCtx.currentTime);
    this.soundboardCompressorNode.connect(this.outputPeakGuard);

    // Entrada dos efeitos pós-filtros/gate, com compressão antes da proteção final de picos.
    this.soundboardInputNode = this.audioCtx.createGain();
    this.soundboardInputNode.gain.setValueAtTime(
      1.0,
      this.audioCtx.currentTime,
    );
    this.soundboardInputNode.connect(this.soundboardCompressorNode);

    // source -> highPass -> lowPass -> [RNNoise/bypass] -> compressor -> gain
    // -> analyser -> micMuteNode -> outputPeakGuard -> destination.
    // O soundboard entra separadamente, depois de todo o processamento do mic.
    this.sourceNode.connect(this.highPassFilter);
    this.highPassFilter.connect(this.lowPassFilter);

    if (
      this.workletNode &&
      this.cleanBypassDelay &&
      this.cleanBypassGain &&
      this.denoisedGain
    ) {
      this.lowPassFilter.connect(this.workletNode);
      this.workletNode.connect(this.denoisedGain);
      this.denoisedGain.connect(this.compressorNode);

      this.lowPassFilter.connect(this.cleanBypassDelay);
      this.cleanBypassDelay.connect(this.cleanBypassGain);
      this.cleanBypassGain.connect(this.compressorNode);
    } else {
      this.lowPassFilter.connect(this.compressorNode);
    }

    this.compressorNode.connect(this.gainNode);
    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.micMuteNode);
    this.micMuteNode.connect(this.outputPeakGuard);

    // Em falha do processor, a rota limpa já conectada assume sem trocar a
    // trilha WebRTC e sem afetar VAD, mute, limiter ou soundboard.
    if (this.workletNode) {
      const rnnoise = this.workletNode;
      rnnoise.addEventListener(
        "processorerror",
        () => {
          if (this.isDestroyed || this.workletNode !== rnnoise) return;
          callEvent("audio_processor_error");
          this.lowPassFilter?.disconnect(rnnoise);
          rnnoise.disconnect();
          rnnoise.port.close();
          this.workletNode = null;
          this.setRnnoiseEnabled(false);
          this.syncNativeNoiseFallback();
        },
        { once: true },
      );
    }

    this.processedStream = this.destinationNode.stream;

    this.startVoiceActivityDetection();

    return this.processedStream;
  }

  private startVoiceActivityDetection(): void {
    if (!this.analyserNode) return;

    const dataArray = new Float32Array(this.analyserNode.fftSize);
    let lastLoudAt = 0;

    this.meterInterval = window.setInterval(() => {
      if (this.isDestroyed || !this.analyserNode) return;
      if (this.audioCtx && this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(() => {});
      }

      // Se estiver mutado no microfone, reporta sempre fala inativa e nível 0
      if (this.isMicMuted) {
        if (this.onSpeakingChange) {
          this.onSpeakingChange(false, 0);
        }
        return;
      }

      this.analyserNode.getFloatTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = dataArray[i];
        sum += val * val;
      }

      const rms = Math.sqrt(sum / dataArray.length);
      const db = rms > 0.00001 ? 20 * Math.log10(rms) : -100;

      // Anel verde ativo quando o volume passar de -42 dB
      if (db > -42) lastLoudAt = Date.now();
      const isSpeaking = Date.now() - lastLoudAt < 180;
      const normalizedLevel = Math.min(
        100,
        Math.max(0, Math.round(((db + 60) / 60) * 100)),
      );

      if (this.onSpeakingChange) {
        this.onSpeakingChange(isSpeaking, normalizedLevel);
      }
    }, 45);
  }

  public setInterruptionHandler(handler: (() => void) | null): void {
    this.onInterrupted = handler;
  }

  private clearSuspendTimer(): void {
    if (this.suspendTimer !== null) {
      clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
  }

  public setMicMuted(muted: boolean): void {
    this.isMicMuted = muted;
    if (this.micMuteNode && this.audioCtx) {
      this.micMuteNode.gain.setTargetAtTime(
        muted ? 0 : 1,
        this.audioCtx.currentTime,
        0.015,
      );
    }
    if (muted && this.onSpeakingChange) {
      this.onSpeakingChange(false, 0);
    }
  }

  public getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }

  public getSoundboardInputNode(): GainNode | null {
    return this.soundboardInputNode;
  }

  private setRnnoiseEnabled(enabled: boolean, immediate = false): void {
    if (!this.audioCtx || !this.cleanBypassGain || !this.denoisedGain) return;
    const denoisedTarget = enabled && this.workletNode ? 1 : 0;
    rampAudioParam(
      this.denoisedGain.gain,
      denoisedTarget,
      this.audioCtx,
      immediate,
    );
    rampAudioParam(
      this.cleanBypassGain.gain,
      1 - denoisedTarget,
      this.audioCtx,
      immediate,
    );
  }

  private syncNativeNoiseFallback(): void {
    const shouldEnable = this.config.neuralNoiseGate && !this.workletNode;
    if (
      this.isDestroyed ||
      shouldEnable === this.nativeNoiseFallbackActive
    ) {
      return;
    }

    const track = this.rawStream.getAudioTracks()[0];
    if (!track || typeof track.applyConstraints !== "function") return;

    const revision = ++this.nativeNoiseFallbackRevision;
    this.nativeNoiseFallbackActive = shouldEnable;
    track
      .applyConstraints({ noiseSuppression: shouldEnable })
      .catch((error) => {
        if (revision === this.nativeNoiseFallbackRevision) {
          this.nativeNoiseFallbackActive = !shouldEnable;
        }
        console.warn("[Audio] Native noise-suppression fallback failed", error);
      });
  }

  public updateConfig(newConfig: Partial<AudioProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (this.highPassFilter && this.audioCtx) {
      const targetFreq = this.config.highPassFilter80Hz ? 80 : 10;
      this.highPassFilter.frequency.setTargetAtTime(
        targetFreq,
        this.audioCtx.currentTime,
        0.05,
      );
    }

    if (typeof newConfig.neuralNoiseGate === "boolean") {
      this.setRnnoiseEnabled(newConfig.neuralNoiseGate);
      this.syncNativeNoiseFallback();
    }

    if (
      this.gainNode &&
      this.audioCtx &&
      typeof newConfig.micGain === "number"
    ) {
      this.gainNode.gain.setTargetAtTime(
        safeAudioGain(newConfig.micGain),
        this.audioCtx.currentTime,
        0.05,
      );
    }
  }

  public getProcessedStream(): MediaStream | null {
    return this.processedStream;
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.nativeNoiseFallbackRevision++;
    this.onInterrupted = null;
    this.clearSuspendTimer();
    if (this.audioCtx) this.audioCtx.onstatechange = null;

    if (this.meterInterval !== null) {
      clearInterval(this.meterInterval);
      this.meterInterval = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (this.highPassFilter) {
      try {
        this.highPassFilter.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (this.lowPassFilter) {
      try {
        this.lowPassFilter.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (this.workletNode) {
      try {
        this.workletNode.port.postMessage({ type: "destroy" });
      } catch {
        /* ignore */
      }
      this.workletNode.port.close();
      try {
        this.workletNode.disconnect();
      } catch {
        /* ignore */
      }
    }
    for (const node of [
      this.cleanBypassDelay,
      this.cleanBypassGain,
      this.denoisedGain,
    ]) {
      try {
        node?.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.cleanBypassDelay = null;
    this.cleanBypassGain = null;
    this.denoisedGain = null;
    if (this.compressorNode) {
      try {
        this.compressorNode.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (this.micMuteNode) {
      try {
        this.micMuteNode.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (this.soundboardInputNode) {
      try {
        this.soundboardInputNode.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (this.soundboardCompressorNode) {
      try {
        this.soundboardCompressorNode.disconnect();
      } catch {
        /* ignore */
      }
      this.soundboardCompressorNode = null;
    }

    this.outputPeakGuard?.disconnect();
    this.outputPeakGuard = null;
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      this.audioCtx.close().catch(() => {});
    }

    this.processedStream?.getTracks().forEach((track) => track.stop());
    this.audioCtx = null;
    this.processedStream = null;
  }
}
