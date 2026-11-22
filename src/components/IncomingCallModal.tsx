import React from "react";
import { PhoneCall, PhoneOff, Loader2 } from "lucide-react";
import { useHubStore } from "../store/useHubStore";
import { webrtcEngine } from "../lib/webrtcEngine";
import { Button } from "./ui/button";

export const IncomingCallModal: React.FC = () => {
  const incomingCall = useHubStore((s) => s.incomingCall);
  const outgoingCall = useHubStore((s) => s.outgoingCall);

  if (!incomingCall && !outgoingCall) return null;

  const active = incomingCall || outgoingCall!;
  const isIncoming = Boolean(incomingCall);
  const name = active.peerNickname || "Amigo";
  const color = active.peerAvatarColor || "#6eddbd";
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div
      role="dialog"
      aria-label={isIncoming ? "Chamada recebida" : "Chamando amigo"}
      className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl border border-border bg-surface/95 backdrop-blur-xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div
            className="size-12 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-lg ring-2 ring-primary/50 animate-pulse"
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-success border-2 border-surface animate-ping" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {name}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            {isIncoming ? (
              "Chamada direta recebida…"
            ) : (
              <>
                <Loader2 className="size-3 animate-spin text-primary" />
                <span>Chamando…</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {isIncoming ? (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => void webrtcEngine.acceptIncomingCall()}
              className="flex-1 bg-success hover:bg-success/90 text-success-foreground gap-1.5 font-semibold"
            >
              <PhoneCall className="size-4" />
              <span>Atender</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => void webrtcEngine.rejectIncomingCall()}
              className="flex-1 gap-1.5 font-semibold"
            >
              <PhoneOff className="size-4" />
              <span>Recusar</span>
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => webrtcEngine.leaveVoiceCall()}
            className="w-full gap-1.5 font-semibold"
          >
            <PhoneOff className="size-4" />
            <span>Cancelar chamada</span>
          </Button>
        )}
      </div>
    </div>
  );
};
