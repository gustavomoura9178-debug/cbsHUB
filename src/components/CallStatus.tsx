import { useMediaState } from "../lib/mediaState";
import { webrtcEngine } from "../lib/webrtcEngine";
import { Button } from "./ui/button";

export function MediaNotice() {
  const error = useMediaState((s) => s.error),
    reconnecting = useMediaState((s) => s.reconnecting);
  if (!error && !reconnecting) return null;
  return (
    <div
      className="flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2 text-xs"
      role={error ? "alert" : "status"}
    >
      <span>
        {error ||
          "Reconectando à sala. As chamadas existentes serão preservadas enquanto possível."}
      </span>
      {error && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => webrtcEngine.retryConnection()}
        >
          Tentar novamente
        </Button>
      )}
      {reconnecting && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => webrtcEngine.cancelRecovery()}
        >
          Cancelar reconexão
        </Button>
      )}
      {error ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => useMediaState.setState({ error: null })}
        >
          Dispensar
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => webrtcEngine.retryConnection()}
        >
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
export function CallQualityBadge({ peerId }: { peerId: string }) {
  const quality = useMediaState((s) => s.quality[peerId]);
  const bad =
    quality?.state !== "connected" ||
    (quality.loss ?? 0) > 5 ||
    (quality.rttMs ?? 0) > 300;
  return (
    <span
      className={`rounded-md bg-overlay px-2 py-1 text-micro ${quality && bad ? "text-warning" : "text-white"}`}
      title="Qualidade da conexão de voz; amostragem a cada 2 segundos"
    >
      {!quality
        ? "Qualidade: aguardando"
        : quality.state !== "connected"
          ? "Voz: reconectando"
          : `${quality.rttMs === null ? "RTT indisponível" : quality.rttMs + " ms"} · ${quality.loss === null ? "perda indisponível" : quality.loss + "% perda"}`}
    </span>
  );
}
