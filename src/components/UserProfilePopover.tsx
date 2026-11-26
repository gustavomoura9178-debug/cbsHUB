import React, { useState } from "react";
import {
  Check,
  Clock,
  MessageSquare,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { useHubStore } from "../store/useHubStore";
import { webrtcEngine } from "../lib/webrtcEngine";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import type { FriendPresenceState } from "../types/cbshub";

const STATUS_DOT: Record<FriendPresenceState | "unknown", string> = {
  online: "bg-success",
  in_call: "bg-primary animate-pulse",
  idle: "bg-warning",
  offline: "bg-muted-foreground/50",
  unknown: "bg-muted-foreground/50",
};

const STATUS_TEXT: Record<FriendPresenceState | "unknown", string> = {
  online: "Online",
  in_call: "Em ligação",
  idle: "Ausente",
  offline: "Offline",
  unknown: "Online na sala",
};

export interface UserProfilePopoverProps {
  userId: string;
  nickname: string;
  avatarColor?: string;
  avatarUrl?: string;
  presence?: FriendPresenceState;
  customStatus?: string | null;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

export const UserProfilePopover: React.FC<UserProfilePopoverProps> = ({
  userId,
  nickname,
  avatarColor = "#6eddbd",
  avatarUrl,
  presence,
  customStatus,
  children,
  side = "right",
  align = "start",
}) => {
  const authUserId = useHubStore((s) => s.authUserId);
  const friends = useHubStore((s) => s.friends);
  const pendingRequests = useHubStore((s) => s.pendingRequests);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!userId || userId === authUserId) {
    return <>{children}</>;
  }

  const acceptedFriend = friends.find((f) => f.id === userId);
  const pendingReq = pendingRequests.find((r) => r.id === userId);
  const resolvedPresence =
    acceptedFriend?.presence ?? presence ?? ("online" as FriendPresenceState);
  const resolvedAvatarColor = acceptedFriend?.avatarColor || avatarColor;
  const resolvedAvatarUrl = avatarUrl || acceptedFriend?.avatarUrl || undefined;

  const handleAddFriend = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await webrtcEngine.sendFriendRequestByUserId(userId, nickname);
      setFeedback("Solicitação enviada!");
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Erro ao enviar solicitação.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRespond = async (accept: boolean) => {
    if (!pendingReq || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await webrtcEngine.respondFriendRequest(pendingReq.friendshipId, accept);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Erro ao responder.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-64 p-3.5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div
              className="size-11 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-white border border-border"
              style={{ backgroundColor: resolvedAvatarColor }}
            >
              {resolvedAvatarUrl ? (
                <img
                  src={resolvedAvatarUrl}
                  alt={nickname}
                  className="size-full object-cover"
                />
              ) : (
                nickname.slice(0, 2).toUpperCase()
              )}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-popover ${
                STATUS_DOT[resolvedPresence] ?? STATUS_DOT.unknown
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {nickname}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {customStatus ||
                (STATUS_TEXT[resolvedPresence] ?? STATUS_TEXT.unknown)}
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 space-y-1.5">
          {acceptedFriend ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full h-8 text-xs gap-1.5"
              onClick={() => {
                setOpen(false);
                void webrtcEngine.openDirectMessage(acceptedFriend);
              }}
            >
              <MessageSquare className="size-3.5 text-primary" />
              <span>Enviar Mensagem (DM)</span>
            </Button>
          ) : pendingReq?.direction === "incoming" ? (
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void handleRespond(true)}
                className="flex-1 h-8 text-xs gap-1 bg-success hover:bg-success/90 text-success-foreground"
              >
                <Check className="size-3.5" />
                <span>Aceitar</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void handleRespond(false)}
                className="flex-1 h-8 text-xs gap-1 text-destructive"
              >
                <X className="size-3.5" />
                <span>Recusar</span>
              </Button>
            </div>
          ) : pendingReq?.direction === "outgoing" ? (
            <div className="flex items-center justify-center gap-1.5 rounded-md bg-secondary/70 border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5 text-primary" />
              <span>Convite enviado</span>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void handleAddFriend()}
              className="w-full h-8 text-xs gap-1.5"
            >
              <UserPlus className="size-3.5" />
              <span>{busy ? "Enviando…" : "Adicionar Amigo"}</span>
            </Button>
          )}

          {acceptedFriend && (
            <div className="flex items-center justify-center gap-1 text-micro text-muted-foreground pt-0.5">
              <UserCheck className="size-3 text-success" />
              <span>Vocês já são amigos</span>
            </div>
          )}

          {feedback && (
            <p
              role="status"
              className="text-micro text-center text-primary pt-0.5"
            >
              {feedback}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
