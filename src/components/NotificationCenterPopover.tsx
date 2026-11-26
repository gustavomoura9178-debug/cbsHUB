import React, { useState } from "react";
import {
  Bell,
  Check,
  Download,
  Hash,
  RefreshCw,
  RotateCw,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useHubStore } from "../store/useHubStore";
import { webrtcEngine } from "../lib/webrtcEngine";
import { sanitizeReleaseNotes } from "../lib/appUpdaterUi";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

export const NotificationCenterPopover: React.FC = () => {
  const { pendingRequests, roomInvites, appUpdate, removeRoomInvite } =
    useHubStore(
      useShallow((s) => ({
        pendingRequests: s.pendingRequests,
        roomInvites: s.roomInvites,
        appUpdate: s.appUpdate,
        removeRoomInvite: s.removeRoomInvite,
      })),
    );

  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const incomingFriends = pendingRequests.filter(
    (r) => r.direction === "incoming",
  );
  const hasUpdateNotice =
    appUpdate.status === "available" ||
    appUpdate.status === "downloading" ||
    appUpdate.status === "downloaded" ||
    appUpdate.status === "installing";

  const totalBadgeCount =
    incomingFriends.length + roomInvites.length + (hasUpdateNotice ? 1 : 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="native-window-button relative"
          aria-label={
            totalBadgeCount > 0
              ? `Notificações (${totalBadgeCount} pendentes)`
              : "Notificações"
          }
          title="Central de Notificações"
        >
          <Bell className="size-3.5" />
          {totalBadgeCount > 0 && (
            <span className="absolute top-1 right-1.5 min-w-3.5 h-3.5 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold leading-none flex items-center justify-center">
              {totalBadgeCount > 9 ? "9+" : totalBadgeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-surface/60">
          <div className="flex items-center gap-2">
            <Bell className="size-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              Central de Notificações
            </span>
          </div>
          {window.cbsHubAPI?.checkForUpdates && (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              title="Verificar atualizações"
              aria-label="Verificar atualizações"
              disabled={appUpdate.status === "checking"}
              onClick={() => void window.cbsHubAPI?.checkForUpdates?.()}
            >
              <RefreshCw
                className={`size-3 ${appUpdate.status === "checking" ? "animate-spin text-primary" : ""}`}
              />
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-96">
          <div className="p-3 space-y-3">
            {/* 1. Atualização do App */}
            {(hasUpdateNotice || appUpdate.status === "error") && (
              <section className="rounded-xl border border-primary/40 bg-primary/8 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-primary" />
                    {appUpdate.status === "downloaded"
                      ? `Atualização v${appUpdate.version || ""} pronta!`
                      : appUpdate.status === "downloading"
                        ? `Baixando atualização… ${appUpdate.percent ?? 0}%`
                        : appUpdate.status === "error"
                          ? "Falha ao atualizar"
                          : `Nova versão v${appUpdate.version || ""} disponível`}
                  </span>
                </div>

                {appUpdate.releaseNotes && (
                  <p className="text-2xs text-muted-foreground line-clamp-2">
                    {sanitizeReleaseNotes(appUpdate.releaseNotes)}
                  </p>
                )}

                {appUpdate.status === "error" && appUpdate.message && (
                  <p className="text-2xs text-destructive">{appUpdate.message}</p>
                )}

                {appUpdate.status === "downloading" && (
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${appUpdate.percent ?? 0}%` }}
                    />
                  </div>
                )}

                {appUpdate.status === "available" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      void window.cbsHubAPI?.startUpdateFlow?.();
                    }}
                    className="w-full h-7 text-xs gap-1.5"
                  >
                    <Download className="size-3.5" />
                    <span>Atualizar agora</span>
                  </Button>
                )}

                {appUpdate.status === "downloaded" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      void window.cbsHubAPI?.startUpdateFlow?.();
                    }}
                    className="w-full h-7 text-xs gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
                  >
                    <RotateCw className="size-3.5" />
                    <span>Reiniciar para Atualizar</span>
                  </Button>
                )}
              </section>
            )}

            {/* 2. Pedidos de Amizade Pendentes */}
            {incomingFriends.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="text-micro uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
                  <UserPlus className="size-3 text-primary" />
                  <span>Solicitações de amizade ({incomingFriends.length})</span>
                </h3>
                {incomingFriends.map((req) => (
                  <div
                    key={req.friendshipId}
                    className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/70 px-2.5 py-2"
                  >
                    <div
                      className="size-7 rounded-full flex items-center justify-center text-2xs font-bold text-white shrink-0"
                      style={{ backgroundColor: req.avatarColor }}
                    >
                      {req.nickname.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {req.nickname}
                      </p>
                      <p className="text-micro text-muted-foreground">
                        Quer adicionar você
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Aceitar ${req.nickname}`}
                        disabled={busyId === req.friendshipId}
                        className="text-success hover:bg-success/15"
                        onClick={async () => {
                          setBusyId(req.friendshipId);
                          try {
                            await webrtcEngine.respondFriendRequest(
                              req.friendshipId,
                              true,
                            );
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Recusar ${req.nickname}`}
                        disabled={busyId === req.friendshipId}
                        className="text-destructive hover:bg-destructive/15"
                        onClick={async () => {
                          setBusyId(req.friendshipId);
                          try {
                            await webrtcEngine.respondFriendRequest(
                              req.friendshipId,
                              false,
                            );
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* 3. Convites de Sala Recebidos */}
            {roomInvites.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="text-micro uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
                  <Hash className="size-3 text-primary" />
                  <span>Convites de sala ({roomInvites.length})</span>
                </h3>
                {roomInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/70 px-2.5 py-2"
                  >
                    <div className="size-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Hash className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        #{inv.slug}
                      </p>
                      <p className="truncate text-micro text-muted-foreground">
                        Convite de {inv.senderNickname}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        removeRoomInvite(inv.id);
                        setOpen(false);
                        void webrtcEngine.createOrJoinRoom(inv.slug);
                      }}
                      className="h-7 px-2.5 text-2xs shrink-0"
                    >
                      Entrar
                    </Button>
                  </div>
                ))}
              </section>
            )}

            {totalBadgeCount === 0 && appUpdate.status !== "error" && (
              <div className="py-6 text-center space-y-1.5">
                <Bell className="size-5 text-muted-foreground/60 mx-auto" />
                <p className="text-xs text-muted-foreground">
                  Tudo em dia! Nenhuma pendência no momento.
                </p>
                {appUpdate.status === "not-available" && (
                  <p className="text-micro text-muted-foreground/75">
                    Você já está na versão mais recente.
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
