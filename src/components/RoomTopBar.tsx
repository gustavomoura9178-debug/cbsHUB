import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  useChatView,
  updateChatView,
  EMPTY_CHAT_VIEW,
} from "../chat/viewState";
import {
  Activity,
  Check,
  Copy,
  DoorOpen,
  Hash,
  Maximize2,
  Menu,
  Minimize2,
  MonitorStop,
  MonitorUp,
  MoreHorizontal,
  PhoneCall,
  PhoneOff,
  Pin,
  Search,
  Send,
  Settings2,
  UserPlus,
  UserRound,
  Video,
  VideoOff,
} from "lucide-react";
import { useHubStore } from "../store/useHubStore";
import { webrtcEngine } from "../lib/webrtcEngine";
import { useMediaState } from "../lib/mediaState";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import type { FriendPresenceState } from "../types/cbshub";

const PRESENCE_TEXT: Record<FriendPresenceState, string> = {
  online: "Online",
  in_call: "Em ligação",
  idle: "Ausente",
  offline: "Offline",
};

interface Props {
  onOpenMobileSidebar?: () => void;
}

export function RoomTopBar({ onOpenMobileSidebar }: Props) {
  const {
    activeFriend,
    activeChannelId,
    activeContext,
    friends,
    participants,
    inVoiceCall,
    outgoingCall,
    isWebcamActive,
    isScreenSharing,
    callStageMode,
    setCallStageMode,
    setIsSettingsOpen,
  } = useHubStore(
    useShallow((s) => ({
      activeFriend: s.activeFriend,
      activeChannelId: s.activeChannelId,
      activeContext: s.activeContext,
      friends: s.friends,
      participants: s.participants,
      inVoiceCall: s.inVoiceCall,
      outgoingCall: s.outgoingCall,
      isWebcamActive: s.isWebcamActive,
      isScreenSharing: s.isScreenSharing,
      callStageMode: s.callStageMode,
      setCallStageMode: s.setCallStageMode,
      setIsSettingsOpen: s.setIsSettingsOpen,
    })),
  );

  const cameraBusy = useMediaState((s) => s.cameraBusy);
  const screenBusy = useMediaState((s) => s.screenBusy);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Record<string, boolean>>({});
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const isRoom = activeContext?.type === "room";
  const key = isRoom
    ? activeContext.roomId
    : activeChannelId || "global";
  const view = useChatView((state) => state.views[key] ?? EMPTY_CHAT_VIEW);
  const friendAvatar = activeFriend
    ? activeFriend.avatarUrl ||
      Object.values(participants).find((p) => p.clientId === activeFriend.id)
        ?.profile?.avatar
    : undefined;

  const participantCount = Math.max(
    1,
    new Set(
      Object.values(participants).map((p) => p.clientId || p.peerId),
    ).size,
  );

  const handleCopyCode = async () => {
    if (!isRoom) return;
    try {
      await navigator.clipboard.writeText(activeContext.slug);
      setCopiedSlug(true);
      window.setTimeout(() => setCopiedSlug(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const handleInviteFriend = async (friendId: string) => {
    if (!isRoom || invitingId) return;
    const friend = friends.find((f) => f.id === friendId);
    if (!friend) return;
    setInvitingId(friendId);
    try {
      await webrtcEngine.sendRoomInviteToFriend(
        friend,
        activeContext.slug,
        activeContext.name,
      );
      setInvitedIds((prev) => ({ ...prev, [friendId]: true }));
      window.setTimeout(() => {
        setInvitedIds((prev) => ({ ...prev, [friendId]: false }));
      }, 2500);
    } catch {
      /* ignore */
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <header className="room-topbar">
      {onOpenMobileSidebar && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpenMobileSidebar}
          aria-label="Abrir navegação"
          className="md:hidden shrink-0"
        >
          <Menu className="size-4" />
        </Button>
      )}

      {isRoom ? (
        <>
          <div className="room-heading-icon bg-primary/15 text-primary">
            <Hash className="size-4" />
          </div>
          <div className="room-heading">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="truncate text-sm font-semibold tracking-tight">
                {activeContext.name}
              </h2>
              <span className="hidden sm:inline-flex rounded bg-secondary px-1.5 py-0.5 text-micro font-mono text-muted-foreground shrink-0">
                #{activeContext.slug}
              </span>
            </div>
            <p className="room-subtitle">
              <span className="status-dot" />
              {participantCount}{" "}
              {participantCount === 1
                ? "participante na sala"
                : "participantes na sala"}
            </p>
          </div>
        </>
      ) : activeFriend ? (
        <>
          <div
            className="size-8 rounded-full overflow-hidden flex shrink-0 items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: activeFriend.avatarColor }}
          >
            {friendAvatar ? (
              <img
                src={friendAvatar}
                alt={activeFriend.nickname}
                className="size-full object-cover"
              />
            ) : (
              activeFriend.nickname.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="room-heading">
            <h2 className="truncate text-sm font-semibold tracking-tight">
              {activeFriend.nickname}
            </h2>
            <p className="room-subtitle">
              <span
                className="status-dot"
                data-offline={activeFriend.presence === "offline"}
              />
              {activeFriend.customStatus ||
                (PRESENCE_TEXT[activeFriend.presence] ?? PRESENCE_TEXT.offline)}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="room-heading-icon">
            <UserRound className="size-4" />
          </div>
          <div className="room-heading">
            <h2 className="truncate text-sm font-semibold tracking-tight">
              Mensagens Diretas e Salas
            </h2>
            <p className="room-subtitle">
              Escolha um amigo para DM ou crie uma sala na barra lateral
            </p>
          </div>
        </>
      )}

      <div className="room-actions">
        {isRoom ? (
          <>
            {!inVoiceCall ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="voice-action gap-1.5"
                      onClick={() => void webrtcEngine.joinRoomVoiceCall(false)}
                      aria-label="Entrar na voz"
                    >
                      <PhoneCall className="size-4 text-success" />
                      <span className="hidden sm:inline">Entrar na Voz</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Entrar na chamada de voz da sala</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="secondary"
                      onClick={() => void webrtcEngine.joinRoomVoiceCall(true)}
                      aria-label="Entrar com vídeo"
                    >
                      <Video className="size-4 text-primary" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Entrar com câmera</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant={isWebcamActive ? "default" : "secondary"}
                      disabled={cameraBusy}
                      onClick={() => void webrtcEngine.toggleWebcam()}
                      aria-label={
                        isWebcamActive ? "Desligar câmera" : "Ligar câmera"
                      }
                    >
                      {isWebcamActive ? (
                        <VideoOff className="size-4" />
                      ) : (
                        <Video className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isWebcamActive ? "Desligar câmera" : "Ligar câmera"}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant={isScreenSharing ? "default" : "secondary"}
                      disabled={screenBusy}
                      onClick={() =>
                        isScreenSharing
                          ? webrtcEngine.stopScreenShare()
                          : useHubStore.getState().setIsScreenPickerOpen(true)
                      }
                      aria-label={
                        isScreenSharing
                          ? "Parar compartilhamento"
                          : "Compartilhar tela"
                      }
                    >
                      {isScreenSharing ? (
                        <MonitorStop className="size-4" />
                      ) : (
                        <MonitorUp className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isScreenSharing
                      ? "Parar compartilhamento"
                      : "Compartilhar tela"}
                  </TooltipContent>
                </Tooltip>

                <Button
                  size="sm"
                  variant="destructive"
                  className="voice-action gap-1.5"
                  onClick={() => webrtcEngine.leaveVoiceCall()}
                  aria-label="Sair da voz"
                >
                  <PhoneOff className="size-4" />
                  <span className="hidden sm:inline">Sair da Voz</span>
                </Button>
              </>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => void handleCopyCode()}
                  aria-label="Copiar código da sala"
                >
                  {copiedSlug ? (
                    <Check className="size-4 text-success" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {copiedSlug
                  ? "Código copiado!"
                  : `Copiar código: ${activeContext.slug}`}
              </TooltipContent>
            </Tooltip>

            <Popover open={inviteOpen} onOpenChange={setInviteOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  aria-label="Convidar amigo"
                >
                  <UserPlus className="size-4 text-primary" />
                  <span className="hidden lg:inline">Convidar</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    Convidar Amigo
                  </span>
                  <span className="text-micro font-mono text-muted-foreground">
                    #{activeContext.slug}
                  </span>
                </div>
                {friends.length === 0 ? (
                  <p className="text-2xs text-muted-foreground py-2">
                    Você ainda não tem amigos aceitos para convidar.
                  </p>
                ) : (
                  <ScrollArea className="max-h-52">
                    <div className="space-y-1">
                      {friends.map((friend) => {
                        const isSent = Boolean(invitedIds[friend.id]);
                        return (
                          <div
                            key={friend.id}
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/50"
                          >
                            <div
                              className="size-6 rounded-full flex items-center justify-center text-micro font-bold text-white shrink-0"
                              style={{ backgroundColor: friend.avatarColor }}
                            >
                              {friend.nickname.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-foreground">
                                {friend.nickname}
                              </p>
                              <p className="text-micro text-muted-foreground">
                                {PRESENCE_TEXT[friend.presence] ??
                                  PRESENCE_TEXT.offline}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={isSent ? "secondary" : "default"}
                              disabled={invitingId === friend.id}
                              onClick={() =>
                                void handleInviteFriend(friend.id)
                              }
                              className="h-6 px-2 text-2xs gap-1 shrink-0"
                            >
                              {isSent ? (
                                <>
                                  <Check className="size-3 text-success" />
                                  <span>Enviado</span>
                                </>
                              ) : (
                                <>
                                  <Send className="size-3" />
                                  <span>Convidar</span>
                                </>
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </PopoverContent>
            </Popover>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => webrtcEngine.leaveRoom()}
                  aria-label="Sair da sala"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <DoorOpen className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sair da sala</TooltipContent>
            </Tooltip>
          </>
        ) : (
          activeFriend && (
            <>
              {!inVoiceCall && !outgoingCall ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="voice-action gap-1.5"
                        onClick={() =>
                          void webrtcEngine.startDirectCall(activeFriend, false)
                        }
                        aria-label="Iniciar chamada de voz"
                      >
                        <PhoneCall className="size-4 text-success" />
                        <span className="hidden sm:inline">Ligar</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Iniciar chamada de voz</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="secondary"
                        onClick={() =>
                          void webrtcEngine.startDirectCall(activeFriend, true)
                        }
                        aria-label="Iniciar chamada de vídeo"
                      >
                        <Video className="size-4 text-primary" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Chamada de Vídeo</TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  className="voice-action gap-1.5"
                  onClick={() => webrtcEngine.leaveVoiceCall()}
                  aria-label="Desligar chamada"
                >
                  <PhoneOff className="size-4" />
                  <span className="hidden sm:inline">Desligar</span>
                </Button>
              )}
            </>
          )
        )}

        {inVoiceCall && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="stage-toggle"
                onClick={() =>
                  setCallStageMode(
                    callStageMode === "minimized" ? "grid" : "minimized",
                  )
                }
                aria-label={
                  callStageMode === "minimized"
                    ? "Expandir palco"
                    : "Minimizar palco"
                }
              >
                {callStageMode === "minimized" ? (
                  <Maximize2 className="size-4" />
                ) : (
                  <Minimize2 className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Alternar palco da chamada</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Pesquisar mensagens"
              aria-expanded={view.searchOpen}
              onClick={() =>
                updateChatView(key, {
                  searchOpen: !view.searchOpen,
                  query: view.searchOpen ? "" : view.query,
                })
              }
            >
              <Search className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Pesquisar mensagens</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Opções da conversa">
              <MoreHorizontal className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => updateChatView(key, { pinned: !view.pinned })}
            >
              <Pin className="mr-2 size-4" />
              {view.pinned
                ? "Mostrar todas as mensagens"
                : "Mensagens fixadas"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => updateChatView(key, { activities: true })}
            >
              <Activity className="mr-2 size-4" />
              Atividades de Efeitos Sonoros
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setIsSettingsOpen(true)}>
              <Settings2 className="mr-2 size-4" />
              Configurações
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
