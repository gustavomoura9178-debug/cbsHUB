import { useEffect, useState } from "react";
import { openSettings } from "../lib/settingsNavigation";
import { OfficialLogo } from "./OfficialLogo";
import { useProfiles } from "../profiles/ProfileProvider";
import { UserProfilePopover } from "./UserProfilePopover";
import { useShallow } from "zustand/react/shallow";
import { useVoicePreferences } from "../lib/voicePreferences";
import {
  Check,
  DoorOpen,
  Hash,
  Headphones,
  LogOut,
  Mic,
  MicOff,
  MonitorStop,
  MonitorUp,
  PhoneCall,
  PhoneOff,
  Plus,
  Search,
  Settings2,
  Signal,
  Sliders,
  Sparkles,
  UserPlus,
  Users,
  Video,
  VideoOff,
  Wand2,
  X,
} from "lucide-react";
import { useHubStore } from "../store/useHubStore";
import { webrtcEngine } from "../lib/webrtcEngine";
import { supabase, type DbOnlineStatus } from "../lib/supabase";
import { CallQualityBadge, LocalConnectionBadge } from "./CallStatus";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useMediaState } from "../lib/mediaState";
import type { FriendPresenceState } from "../types/cbshub";

const PRESENCE_DOT: Record<FriendPresenceState, string> = {
  online: "bg-success",
  in_call: "bg-primary animate-pulse",
  idle: "bg-warning",
  offline: "bg-muted-foreground/40",
};

const PRESENCE_LABEL: Record<FriendPresenceState, string> = {
  online: "Online",
  in_call: "Em chamada",
  idle: "Ausente",
  offline: "Offline",
};

const SELF_STATUS_META: Record<
  DbOnlineStatus,
  { label: string; dot: string }
> = {
  online: { label: "Online", dot: "bg-success" },
  idle: { label: "Ausente", dot: "bg-warning" },
  invisible: { label: "Invisível", dot: "bg-muted-foreground/50" },
};

export function LeftSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const {
    nickname,
    avatarColor,
    onlineStatus,
    friends,
    pendingRequests,
    activeFriend,
    activeContext,
    recentRooms,
    removeRecentRoom,
    isMuted,
    isDeafened,
    isLocalSpeaking,
    inVoiceCall,
    participants,
    setIsSettingsOpen,
  } = useHubStore(
    useShallow((state) => ({
      nickname: state.nickname,
      avatarColor: state.avatarColor,
      onlineStatus: state.onlineStatus,
      friends: state.friends,
      pendingRequests: state.pendingRequests,
      activeFriend: state.activeFriend,
      activeContext: state.activeContext,
      recentRooms: state.recentRooms,
      removeRecentRoom: state.removeRecentRoom,
      isMuted: state.isMuted,
      isDeafened: state.isDeafened,
      isLocalSpeaking: state.isLocalSpeaking,
      inVoiceCall: state.inVoiceCall,
      participants: state.participants,
      setIsSettingsOpen: state.setIsSettingsOpen,
    })),
  );

  const ptt = useVoicePreferences((s) => s.pushToTalk);
  const talkKey = useVoicePreferences((s) => s.talkKey);
  const signaling = useMediaState((s) => s.signaling);
  const cameraBusy = useMediaState((s) => s.cameraBusy);
  const screenBusy = useMediaState((s) => s.screenBusy);
  const isWebcamActive = useHubStore((s) => s.isWebcamActive);
  const isScreenSharing = useHubStore((s) => s.isScreenSharing);
  const profiles = useProfiles();

  const [sidebarTab, setSidebarTab] = useState<"friends" | "rooms">(
    activeContext?.type === "room" ? "rooms" : "friends",
  );
  const [addNick, setAddNick] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addFeedback, setAddFeedback] = useState<{
    kind: "error" | "ok";
    text: string;
  } | null>(null);
  const [filterQuery, setFilterQuery] = useState("");

  const [roomInput, setRoomInput] = useState("");
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomFeedback, setRoomFeedback] = useState<string | null>(null);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [nickDraft, setNickDraft] = useState(nickname);
  const [savingNick, setSavingNick] = useState(false);

  useEffect(() => {
    if (activeContext?.type === "room") {
      setSidebarTab("rooms");
    } else if (activeContext?.type === "dm") {
      setSidebarTab("friends");
    }
  }, [activeContext?.type]);

  const incomingRequests = pendingRequests.filter(
    (r) => r.direction === "incoming",
  );
  const outgoingRequests = pendingRequests.filter(
    (r) => r.direction === "outgoing",
  );
  const selfStatusMeta =
    SELF_STATUS_META[onlineStatus] ?? SELF_STATUS_META.online;

  const filteredFriends = friends.filter((f) =>
    f.nickname.toLowerCase().includes(filterQuery.toLowerCase()),
  );

  // Deduplica participantes visíveis da sala por clientId (userId) para jamais duplicar cards
  const uniqueParticipants = Array.from(
    new Map(
      Object.values(participants).map((p) => [p.clientId || p.peerId, p]),
    ).values(),
  );

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addNick.trim() || addBusy) return;
    setAddBusy(true);
    setAddFeedback(null);
    try {
      await webrtcEngine.sendFriendRequest(addNick);
      setAddFeedback({
        kind: "ok",
        text: `Solicitação enviada para ${addNick.trim()}.`,
      });
      setAddNick("");
    } catch (err) {
      setAddFeedback({
        kind: "error",
        text: err instanceof Error ? err.message : "Erro ao adicionar amigo.",
      });
    } finally {
      setAddBusy(false);
    }
  };

  const handleJoinRoom = async (nameOrSlug: string) => {
    const clean = nameOrSlug.trim();
    if (!clean || roomBusy) return;
    setRoomBusy(true);
    setRoomFeedback(null);
    try {
      await webrtcEngine.createOrJoinRoom(clean);
      setRoomInput("");
      onNavigate?.();
    } catch (err) {
      setRoomFeedback(
        err instanceof Error ? err.message : "Não foi possível entrar na sala.",
      );
    } finally {
      setRoomBusy(false);
    }
  };

  const handleQuickRoom = async () => {
    const code = `cbs-${Math.random().toString(36).substring(2, 6)}`;
    await handleJoinRoom(code);
  };

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nickDraft.trim();
    if (clean.length < 2 || savingNick) return;
    setSavingNick(true);
    try {
      await webrtcEngine.updateCloudProfile({ nickname: clean });
      setProfileMenuOpen(false);
    } catch {
      /* ignore */
    } finally {
      setSavingNick(false);
    }
  };

  const handleLogout = async () => {
    webrtcEngine.leaveRoom();
    webrtcEngine.teardownCloudSubscriptions();
    await supabase.auth.signOut();
    useHubStore.getState().logoutClearState();
  };

  const activeCallLabel =
    activeContext?.type === "room"
      ? `#${activeContext.slug}`
      : activeFriend?.nickname || "Chamada 1:1";

  return (
    <aside
      id="room-navigation"
      className="room-navigation w-60 shrink-0"
      aria-label="Amigos, DMs e Salas"
    >
      <div className="px-3 pt-3 pb-3 border-b border-border/50 space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 min-w-0">
            <OfficialLogo size={16} decorative />
            <h1 className="text-sm font-semibold tracking-tight text-foreground truncate">
              {sidebarTab === "friends" ? "Amigos" : "Salas"}
            </h1>
          </div>
          <span className="text-2xs font-medium text-muted-foreground tabular-nums">
            {sidebarTab === "friends"
              ? `${friends.filter((f) => f.presence !== "offline").length}/${friends.length} online`
              : activeContext?.type === "room"
                ? `${uniqueParticipants.length} na sala`
                : `${recentRooms.length} recentes`}
          </span>
        </div>

        <div
          className="grid grid-cols-2 gap-1 rounded-lg bg-background/70 p-0.5 border border-border/60"
          role="tablist"
          aria-label="Alternar entre Amigos e Salas"
        >
          <button
            type="button"
            role="tab"
            aria-selected={sidebarTab === "friends"}
            onClick={() => setSidebarTab("friends")}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors ${
              sidebarTab === "friends"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="size-3.5" />
            <span>Amigos</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sidebarTab === "rooms"}
            onClick={() => setSidebarTab("rooms")}
            className={`relative flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors ${
              sidebarTab === "rooms"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Hash className="size-3.5" />
            <span>Salas</span>
            {activeContext?.type === "room" && (
              <span
                className="size-1.5 rounded-full bg-success"
                aria-hidden="true"
              />
            )}
          </button>
        </div>

        {sidebarTab === "friends" ? (
          <form onSubmit={handleAddFriend} className="space-y-1.5">
            <div className="flex gap-1.5">
              <Input
                value={addNick}
                onChange={(e) => setAddNick(e.target.value)}
                placeholder="Adicionar por nickname…"
                className="h-8 text-xs bg-background/60"
                maxLength={32}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="submit"
                    size="icon-sm"
                    variant="secondary"
                    disabled={!addNick.trim() || addBusy}
                    aria-label="Adicionar amigo"
                    className="shrink-0 h-8 w-8"
                  >
                    <UserPlus className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Enviar pedido de amizade</TooltipContent>
              </Tooltip>
            </div>
            {addFeedback && (
              <p
                role="status"
                className={`text-2xs leading-tight ${
                  addFeedback.kind === "error"
                    ? "text-destructive"
                    : "text-success"
                }`}
              >
                {addFeedback.text}
              </p>
            )}
          </form>
        ) : (
          <div className="space-y-1.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleJoinRoom(roomInput);
              }}
              className="flex gap-1.5"
            >
              <Input
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="Nome ou código da sala…"
                aria-label="Nome ou código da sala"
                className="h-8 text-xs bg-background/60"
                maxLength={48}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="submit"
                    size="icon-sm"
                    variant="secondary"
                    disabled={!roomInput.trim() || roomBusy}
                    aria-label="Criar ou entrar na sala"
                    className="shrink-0 h-8 w-8"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Criar ou entrar na sala</TooltipContent>
              </Tooltip>
            </form>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={roomBusy}
              onClick={() => void handleQuickRoom()}
              className="w-full h-7 justify-center gap-1.5 text-2xs text-primary hover:text-primary hover:bg-primary/10 border border-border/50"
            >
              <Wand2 className="size-3" />
              <span>Gerar sala rápida</span>
            </Button>
            {roomFeedback && (
              <p role="alert" className="text-2xs text-destructive leading-tight">
                {roomFeedback}
              </p>
            )}
          </div>
        )}
      </div>

      {sidebarTab === "friends" ? (
        <>
          <div className="px-3 pt-2.5 pb-1.5 relative">
            <Search className="absolute left-5.5 top-4.5 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              aria-label="Filtrar amigos"
              placeholder="Filtrar amigos…"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="h-7 text-xs bg-background/40 pl-7"
            />
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-3 px-2 py-2">
              {pendingRequests.length > 0 && (
                <section aria-label="Solicitações Pendentes" className="space-y-1">
                  <h2 className="section-eyebrow px-2 py-1">
                    Pendentes ({pendingRequests.length})
                  </h2>
                  {incomingRequests.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="flex items-center gap-2 rounded-lg bg-card/70 border border-border/50 px-2 py-1.5"
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
                          Quer ser amigo
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`Aceitar ${req.nickname}`}
                          className="text-success hover:bg-success/15"
                          onClick={() =>
                            void webrtcEngine.respondFriendRequest(
                              req.friendshipId,
                              true,
                            )
                          }
                        >
                          <Check className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`Recusar ${req.nickname}`}
                          className="text-destructive hover:bg-destructive/15"
                          onClick={() =>
                            void webrtcEngine.respondFriendRequest(
                              req.friendshipId,
                              false,
                            )
                          }
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {outgoingRequests.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-muted-foreground"
                    >
                      <div
                        className="size-6 rounded-full flex items-center justify-center text-micro font-bold text-white shrink-0 opacity-75"
                        style={{ backgroundColor: req.avatarColor }}
                      >
                        {req.nickname.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="truncate text-xs flex-1">
                        {req.nickname}
                      </span>
                      <span className="text-micro">Enviado</span>
                    </div>
                  ))}
                </section>
              )}

              <section aria-label="Mensagens Diretas" className="space-y-0.5">
                <h2 className="section-eyebrow px-2 py-1">Mensagens Diretas</h2>
                {filteredFriends.map((friend) => {
                  const isSelected =
                    activeContext?.type !== "room" &&
                    activeFriend?.id === friend.id;
                  const friendAvatar =
                    friend.avatarUrl ||
                    Object.values(participants).find(
                      (p) => p.clientId === friend.id,
                    )?.profile?.avatar;
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => {
                        void webrtcEngine.openDirectMessage(friend);
                        onNavigate?.();
                      }}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                        isSelected
                          ? "bg-primary/12 text-foreground"
                          : "hover:bg-accent/50 text-foreground/90"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div
                          className="size-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: friend.avatarColor }}
                        >
                          {friendAvatar ? (
                            <img
                              src={friendAvatar}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            friend.nickname.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface ${PRESENCE_DOT[friend.presence] ?? PRESENCE_DOT.offline}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {friend.nickname}
                        </p>
                        <p className="truncate text-micro text-muted-foreground">
                          {friend.customStatus ||
                            (PRESENCE_LABEL[friend.presence] ??
                              PRESENCE_LABEL.offline)}
                        </p>
                      </div>
                    </button>
                  );
                })}

                {filteredFriends.length === 0 && (
                  <div className="px-2 py-4 text-center space-y-1.5">
                    <Sparkles className="size-4 text-primary mx-auto opacity-80" />
                    <p className="text-2xs text-muted-foreground leading-relaxed">
                      {friends.length === 0
                        ? "Adicione amigos pelo nickname acima para começar."
                        : "Nenhum amigo encontrado."}
                    </p>
                  </div>
                )}
              </section>
            </div>
          </ScrollArea>
        </>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 px-2 py-2.5">
            {activeContext?.type === "room" && (
              <section aria-label="Sala Ativa" className="space-y-1.5">
                <div className="flex items-center justify-between px-2">
                  <h2 className="section-eyebrow">Sala Atual</h2>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Sair da sala atual"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => webrtcEngine.leaveRoom()}
                  >
                    <DoorOpen className="size-3.5" />
                  </Button>
                </div>

                <div className="rounded-xl border border-primary/30 bg-primary/8 p-2.5 space-y-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Hash className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {activeContext.name}
                      </p>
                      <p className="truncate text-micro font-mono text-muted-foreground">
                        #{activeContext.slug}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-border/40">
                    {uniqueParticipants.map((p) => {
                      const avatarUrl = p.isLocal
                        ? profiles.own.avatar
                        : p.profile?.avatar;
                      const rowContent = (
                        <div className="flex items-center gap-2 px-1 py-0.5 text-xs rounded hover:bg-accent/50 transition-colors w-full text-left">
                          <div
                            className={`size-5 rounded-full overflow-hidden flex items-center justify-center text-micro font-bold text-white shrink-0 ${
                              p.isSpeaking && !p.isMuted
                                ? "ring-1 ring-success"
                                : ""
                            }`}
                            style={{ backgroundColor: p.avatarColor }}
                          >
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt=""
                                className="size-full object-cover"
                              />
                            ) : (
                              p.nickname.slice(0, 1).toUpperCase()
                            )}
                          </div>
                          <span className="truncate flex-1 text-foreground/90">
                            {p.nickname}
                            {p.isLocal ? " (você)" : ""}
                          </span>
                          {p.inVoiceCall && (
                            <span
                              className={`text-micro ${p.isMuted ? "text-destructive" : "text-success"}`}
                              title={
                                p.isMuted ? "Microfone mutado" : "Na voz"
                              }
                            >
                              {p.isMuted ? (
                                <MicOff className="size-3" />
                              ) : (
                                <Mic className="size-3" />
                              )}
                            </span>
                          )}
                        </div>
                      );

                      if (p.isLocal) {
                        return (
                          <div key={p.clientId || p.peerId}>{rowContent}</div>
                        );
                      }

                      return (
                        <UserProfilePopover
                          key={p.clientId || p.peerId}
                          userId={p.clientId}
                          nickname={p.nickname}
                          avatarColor={p.avatarColor}
                          avatarUrl={avatarUrl}
                          customStatus={p.profile?.status}
                        >
                          <button type="button" className="w-full text-left">
                            {rowContent}
                          </button>
                        </UserProfilePopover>
                      );
                    })}
                  </div>

                  {!inVoiceCall && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void webrtcEngine.joinRoomVoiceCall(false)}
                      className="w-full h-7 text-xs gap-1.5"
                    >
                      <PhoneCall className="size-3.5 text-success" />
                      <span>Entrar na Voz</span>
                    </Button>
                  )}
                </div>
              </section>
            )}

            <section aria-label="Salas Recentes" className="space-y-1">
              <h2 className="section-eyebrow px-2 py-1">Salas Recentes</h2>
              {recentRooms.map((slug) => {
                const isCurrent =
                  activeContext?.type === "room" &&
                  activeContext.slug === slug;
                return (
                  <div
                    key={slug}
                    className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${
                      isCurrent
                        ? "bg-primary/12 text-foreground"
                        : "hover:bg-accent/50 text-foreground/85"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void handleJoinRoom(slug)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      <Hash className="size-3.5 text-primary shrink-0" />
                      <span className="truncate text-xs font-medium">
                        {slug}
                      </span>
                    </button>
                    {!isCurrent && (
                      <button
                        type="button"
                        aria-label={`Remover sala ${slug}`}
                        onClick={() => removeRecentRoom(slug)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-opacity"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              {recentRooms.length === 0 && (
                <div className="px-2 py-4 text-center space-y-1.5">
                  <Hash className="size-4 text-primary mx-auto opacity-80" />
                  <p className="text-2xs text-muted-foreground leading-relaxed">
                    Crie uma sala acima ou cole um código para chamadas em
                    grupo.
                  </p>
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      )}

      {inVoiceCall && (
        <section className="sidebar-voice-panel" aria-label="Painel de voz">
          <div className="flex items-center gap-2 min-w-0">
            <Signal
              className={`size-4 shrink-0 ${
                signaling === "offline" ? "text-warning" : "text-success"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p role="status" className="text-xs font-semibold text-success">
                <LocalConnectionBadge />
              </p>
              <p className="truncate text-caption text-muted-foreground">
                {activeCallLabel}
              </p>
            </div>
            <VoiceAction
              label="Desconectar voz"
              onClick={() => webrtcEngine.leaveVoiceCall()}
            >
              <PhoneOff className="size-4 text-destructive" />
            </VoiceAction>
          </div>
          {Object.values(participants)
            .filter((p) => !p.isLocal && p.inVoiceCall)
            .map((p) => (
              <div
                key={p.peerId}
                className="text-micro mt-1 flex gap-1 items-center min-w-0"
              >
                <span className="truncate" title={p.nickname}>
                  {p.nickname}
                </span>
                <CallQualityBadge peerId={p.peerId} />
              </div>
            ))}
          <div className="flex gap-1 mt-2">
            <VoiceAction
              label={
                isScreenSharing
                  ? "Parar compartilhamento"
                  : "Compartilhar tela"
              }
              pressed={isScreenSharing}
              disabled={screenBusy}
              onClick={() =>
                isScreenSharing
                  ? webrtcEngine.stopScreenShare()
                  : useHubStore.getState().setIsScreenPickerOpen(true)
              }
            >
              {isScreenSharing ? (
                <MonitorStop className="size-4" />
              ) : (
                <MonitorUp className="size-4" />
              )}
            </VoiceAction>
            <VoiceAction
              label={isWebcamActive ? "Desligar câmera" : "Ligar câmera"}
              pressed={isWebcamActive}
              disabled={cameraBusy}
              onClick={() => void webrtcEngine.toggleWebcam()}
            >
              {isWebcamActive ? (
                <VideoOff className="size-4" />
              ) : (
                <Video className="size-4" />
              )}
            </VoiceAction>
            <VoiceAction
              label="Configurações de voz"
              onClick={() => openSettings("audio")}
            >
              <Sliders className="size-4" />
            </VoiceAction>
          </div>
        </section>
      )}

      <div className="local-user-panel">
        <div className="flex items-center gap-1 min-w-0">
          <Popover
            open={profileMenuOpen}
            onOpenChange={(open) => {
              setProfileMenuOpen(open);
              if (open) setNickDraft(nickname);
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Editar status e perfil"
                className="flex items-center gap-2 min-w-0 flex-1 rounded-md p-1 hover:bg-accent/50 transition-colors text-left"
              >
                <div className="relative shrink-0">
                  <div
                    className={`size-7 rounded-full overflow-hidden flex items-center justify-center text-2xs font-bold text-white transition-shadow ${
                      isLocalSpeaking && !isMuted
                        ? "ring-2 ring-success ring-offset-1 ring-offset-surface"
                        : ""
                    }`}
                    style={{ backgroundColor: avatarColor }}
                  >
                    {profiles.own.avatar ? (
                      <img
                        src={profiles.own.avatar}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      nickname.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface ${selfStatusMeta.dot}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    {nickname}
                  </p>
                  <p className="truncate text-micro text-muted-foreground">
                    {inVoiceCall
                      ? ptt
                        ? `PTT · ${talkKey}`
                        : "Na chamada"
                      : selfStatusMeta.label}
                  </p>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-64 p-0 overflow-hidden">
              <div className="relative">
                <div
                  className="h-14 w-full bg-secondary overflow-hidden"
                  style={{
                    background: profiles.own.appearance.useGradient
                      ? `linear-gradient(135deg,${profiles.own.appearance.color},${profiles.own.appearance.gradient})`
                      : profiles.own.appearance.color,
                  }}
                >
                  {profiles.own.banner && (
                    <img
                      src={profiles.own.banner}
                      alt=""
                      className="size-full object-cover"
                    />
                  )}
                </div>
                <div className="px-3 pb-2.5">
                  <div className="flex items-end justify-between -mt-6 mb-1.5">
                    <div
                      className="size-12 rounded-full overflow-hidden border-2 border-popover bg-card flex items-center justify-center text-xs font-bold text-white shrink-0 shadow"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {profiles.own.avatar ? (
                        <img
                          src={profiles.own.avatar}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        nickname.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        profiles.edit();
                      }}
                      className="h-6 px-2 text-micro font-medium"
                    >
                      Editar Perfil & Foto
                    </Button>
                  </div>
                  <p className="truncate text-xs font-semibold text-foreground">
                    {nickname}
                  </p>
                </div>
              </div>
              <div className="p-3 pt-2 border-t border-border/60 space-y-3">
              <form onSubmit={handleSaveNickname} className="space-y-1.5">
                <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Editar Nickname
                </label>
                <div className="flex gap-1.5">
                  <Input
                    value={nickDraft}
                    onChange={(e) => setNickDraft(e.target.value)}
                    maxLength={32}
                    className="h-7 text-xs"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={savingNick || nickDraft.trim().length < 2}
                    className="h-7 px-2 text-xs"
                  >
                    Salvar
                  </Button>
                </div>
              </form>

              <div className="space-y-1">
                <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Status
                </span>
                {(["online", "idle", "invisible"] as DbOnlineStatus[]).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        void webrtcEngine.updateCloudProfile({
                          online_status: st,
                        });
                      }}
                      className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                        onlineStatus === st
                          ? "bg-primary/15 text-foreground font-medium"
                          : "hover:bg-accent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${SELF_STATUS_META[st].dot}`}
                      />
                      <span className="flex-1 text-left">
                        {SELF_STATUS_META[st].label}
                      </span>
                      {onlineStatus === st && (
                        <Check className="size-3.5 text-primary" />
                      )}
                    </button>
                  ),
                )}
              </div>

              <div className="pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleLogout()}
                  className="w-full justify-start gap-2 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="size-3.5" />
                  <span>Sair da conta (Logout)</span>
                </Button>
              </div>
              </div>
            </PopoverContent>
          </Popover>

          <VoiceAction
            label={isMuted ? "Ativar microfone" : "Silenciar microfone"}
            pressed={isMuted}
            onClick={() => webrtcEngine.toggleMute()}
          >
            {isMuted ? (
              <MicOff className="size-4 text-destructive" />
            ) : (
              <Mic className="size-4" />
            )}
          </VoiceAction>
          <VoiceAction
            label={isDeafened ? "Ativar áudio" : "Silenciar áudio"}
            pressed={isDeafened}
            onClick={() => webrtcEngine.toggleDeafen()}
          >
            <Headphones
              className={`size-4 ${isDeafened ? "text-destructive" : ""}`}
            />
          </VoiceAction>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsSettingsOpen(true)}
                aria-label="Configurações"
              >
                <Settings2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Configurações</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}

function VoiceAction({
  label,
  onClick,
  children,
  pressed,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
