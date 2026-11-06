import { useEffect, useRef, useState } from "react";
import { AnimatedLogo } from "./AnimatedLogo";
import { Button } from "./ui/button";
import { useHubStore } from "../store/useHubStore";
import { useMediaState } from "../lib/mediaState";
import { webrtcEngine } from "../lib/webrtcEngine";
export function BootSplash() {
  return (
    <div
      className="brand-loading-screen"
      role="status"
      aria-label="Inicializando cbsHUB"
    >
      <AnimatedLogo />
      <p>Preparando seu espaço…</p>
    </div>
  );
}
export function ConnectionScreen() {
  const signaling = useMediaState((s) => s.signaling),
    reconnecting = useMediaState((s) => s.reconnecting),
    attempt = useMediaState((s) => s.recoveryAttempt),
    quality = useMediaState((s) => s.quality);
  const inVoice = useHubStore((s) => s.inVoiceCall),
    connected = useHubStore((s) => s.isConnected);
  const wasConnected = useRef(false),
    [blocked, setBlocked] = useState(false);
  if (signaling === "online" || connected) wasConnected.current = true;
  const usableVoice = Object.values(quality).some(
    (q) => q.state === "connected",
  );
  const impaired =
    wasConnected.current &&
    !connected &&
    signaling !== "online" &&
    signaling !== "idle" &&
    reconnecting &&
    !usableVoice;
  useEffect(() => {
    if (!impaired) {
      setBlocked(false);
      return;
    }
    const timer = window.setTimeout(() => setBlocked(true), 2500);
    return () => clearTimeout(timer);
  }, [impaired]);
  if (!blocked || !impaired) return null;
  return (
    <section
      className="brand-loading-screen reconnection-screen"
      aria-label="Reconectando à sala"
      role="status"
    >
      <AnimatedLogo />
      <h2>Reconectando...</h2>
      <p>Sinalização indisponível · tentativa {attempt} de 8</p>
      <p className="text-xs text-muted-foreground">
        Os estados de microfone e áudio foram preservados.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => webrtcEngine.cancelRecovery()}>
          Continuar no histórico local
        </Button>
        {inVoice && (
          <Button
            variant="destructive"
            onClick={() => webrtcEngine.leaveVoiceCall()}
          >
            Encerrar chamada
          </Button>
        )}
      </div>
    </section>
  );
}
