import { useEffect, useRef, useState } from "react";
import { VoiceAudioPipeline } from "../lib/audioPipeline";
import { useHubStore } from "../store/useHubStore";
import { Button } from "./ui/button";

export function MicrophoneTest() {
  const inVoice = useHubStore((s) => s.inVoiceCall),
    audioConfig = useHubStore((s) => s.audioConfig),
    input = audioConfig.inputDeviceId;
  const [running, setRunning] = useState(false),
    [busy, setBusy] = useState(false),
    [level, setLevel] = useState(0),
    [error, setError] = useState("");
  const active = useRef<{
      stream: MediaStream;
      pipeline: VoiceAudioPipeline;
    } | null>(null),
    generation = useRef(0);

  const stop = () => {
    generation.current++;
    const current = active.current;
    active.current = null;
    if (current) {
      current.pipeline.destroy();
      current.stream.getTracks().forEach((track) => track.stop());
    }
    setRunning(false);
    setBusy(false);
    setLevel(0);
  };

  useEffect(() => {
    stop();
    return stop;
  }, [inVoice, input]);

  // Permite comparar o bypass/RNNoise sem reabrir o dispositivo ou o WebRTC.
  useEffect(() => {
    active.current?.pipeline.updateConfig(audioConfig);
  }, [audioConfig]);

  const start = async () => {
    const attempt = ++generation.current;
    setBusy(true);
    setError("");
    let stream: MediaStream | null = null,
      pipeline: VoiceAudioPipeline | null = null;
    try {
      const config = useHubStore.getState().audioConfig;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: input === "default" ? undefined : { exact: input },
          echoCancellation: config.echoCancellation,
          autoGainControl: config.autoGainControl,
          // O pipeline usa RNNoise; o nativo só entra se o WASM falhar.
          noiseSuppression: false,
          sampleRate: 48000,
          channelCount: 1,
        },
        video: false,
      });
      if (attempt !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      pipeline = new VoiceAudioPipeline(stream, config, (_, nextLevel) => {
        if (attempt === generation.current) setLevel(nextLevel);
      });
      await pipeline.initialize();
      if (attempt !== generation.current) {
        pipeline.destroy();
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      // Aplica qualquer alteração feita enquanto o worklet era carregado.
      pipeline.updateConfig(useHubStore.getState().audioConfig);
      active.current = { stream, pipeline };
      setRunning(true);
      stream.getTracks().forEach((track) => {
        track.onended = stop;
      });
    } catch {
      pipeline?.destroy();
      stream?.getTracks().forEach((track) => track.stop());
      if (attempt === generation.current) {
        setError(
          "Não foi possível testar o microfone. Verifique o dispositivo e a permissão.",
        );
      }
    } finally {
      if (attempt === generation.current) setBusy(false);
    }
  };

  return (
    <section className="space-y-2" aria-label="Teste de microfone">
      <p className="text-xs text-muted-foreground">
        Teste local de nível com o mesmo RNNoise da chamada, sem reprodução ou
        envio para a sala. Durante uma chamada, use o medidor existente.
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={inVoice || busy}
        onClick={() => (running ? stop() : void start())}
      >
        {busy
          ? "Abrindo microfone…"
          : running
            ? "Parar teste de microfone"
            : "Testar microfone"}
      </Button>
      {running && (
        <div
          role="meter"
          aria-label="Nível do teste de microfone"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={level}
          className="h-2 rounded-full bg-secondary overflow-hidden"
        >
          <div className="h-full bg-primary" style={{ width: `${level}%` }} />
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs">
          {error}
        </p>
      )}
    </section>
  );
}
