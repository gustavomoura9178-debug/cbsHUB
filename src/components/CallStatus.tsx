import { useHubStore } from "../store/useHubStore";
import { useMediaState } from "../lib/mediaState";
import { Button } from "./ui/button";

export function MediaNotice() {
  const error = useMediaState((s) => s.error);
  if (!error) return null;
  return (
    <div
      className="flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-1.5 text-xs"
      role="alert"
    >
      <span>{error}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => useMediaState.setState({ error: null })}
      >
        Dispensar
      </Button>
    </div>
  );
}

export function CallQualityBadge({ peerId }: { peerId: string }) {
  const quality = useMediaState((s) => s.quality[peerId]);
  const hasStream = useHubStore((s) =>
    Boolean(
      s.remoteStreams[peerId]?.voice ||
        s.remoteStreams[peerId]?.webcam ||
        s.remoteStreams[peerId]?.screen,
    ),
  );
  const unstable =
    quality?.state === "connected" &&
    ((quality.loss ?? 0) > 5 || (quality.rttMs ?? 0) > 300);

  const isConnected =
    quality?.state === "connected" || (!quality && hasStream);

  const status = isConnected
    ? unstable
      ? "Instável"
      : "Conectado"
    : quality?.state === "closed" || quality?.state === "failed"
      ? "Desconectado"
      : "Conectando";

  const metrics =
    isConnected && quality?.rttMs !== null && quality?.rttMs !== undefined
      ? ` · ${quality.rttMs} ms`
      : "";

  return (
    <span
      className={`call-quality-badge rounded-md bg-overlay px-2 py-0.5 text-micro ${unstable || (!isConnected && quality?.state === "failed") ? "text-warning" : "text-white"}`}
      title={`${status}${metrics}`}
      aria-label={`${status}${metrics}`}
    >
      <span className="quality-text">
        {status}
        {metrics}
      </span>
      <span className="quality-dot" aria-hidden="true">
        ●
      </span>
    </span>
  );
}

export function LocalConnectionBadge() {
  const signaling = useMediaState((s) => s.signaling);
  const connected = useHubStore((s) => s.isConnected);
  const inVoice = useHubStore((s) => s.inVoiceCall);
  const lost = signaling === "offline" || signaling === "failed";
  const status = lost
    ? "Reconectando"
    : signaling === "connecting" && !inVoice
      ? "Conectando"
      : connected || inVoice
        ? "Conectado"
        : "Online";
  return (
    <span
      data-local-connection
      className={`call-quality-badge rounded-md bg-overlay px-2 py-0.5 text-micro ${!lost ? "text-success" : "text-warning"}`}
      aria-label={`Sua conexão: ${status}`}
    >
      <span className="quality-text">{status}</span>
      <span className="quality-dot" aria-hidden="true">
        ●
      </span>
    </span>
  );
}
