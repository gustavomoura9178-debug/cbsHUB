import {useStudio} from "../studio/StudioProvider";
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription} from "./ui/alert-dialog";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Hash,
  Headphones,
  Mic,
  MicOff,
  MoreHorizontal,
  Plus,
  Settings2,
  Signal,
  Sparkles,
} from "lucide-react";
import { useHubStore } from "../store/useHubStore";
import { webrtcEngine } from "../lib/webrtcEngine";
import { ParticipantAvatar } from "./ParticipantAvatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

import { useProfiles } from "../profiles/ProfileProvider";

export function LeftSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const {
    roomId,
    recentRooms,
    nickname,
    avatarColor,
    isMuted,
    isDeafened,
    isLocalSpeaking,
    inVoiceCall,
    isConnected,
    setIsSettingsOpen,
  } = useHubStore();
  const profiles = useProfiles();
  const studio=useStudio();
  const participants=useHubStore(s=>s.participants);
  const [removing,setRemoving] = useState<string|null>(null);
  const [removed,setRemoved] = useState<string|null>(null);
  const [slug, setSlug] = useState("");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const rooms = [...new Set([roomId, ...recentRooms])].filter(Boolean).filter((room) =>
    room.includes(query.toLowerCase()),
  );
  const join = async (room: string) => {
    if (!room.trim()) return;
    await webrtcEngine.joinRoom(room);
    setSlug("");
    onNavigate?.();
  };
  const createRoom = () =>
    join(`encontro-${Math.random().toString(36).slice(2, 8)}`);
  const copyRoom = async (room: string) => {
    try {
      await navigator.clipboard.writeText(room);
      setCopied(room);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };
  return (
    <aside id="room-navigation" className="room-navigation" aria-label="Salas">
      <div className="navigation-heading">
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <span className="status-dot" />
          Seu espaço
        </div>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-lg font-semibold tracking-tight">Conversas</h1>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={createRoom}
                aria-label="Criar sala"
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Criar uma sala</TooltipContent>
          </Tooltip>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Um lugar para estar perto.
        </p>
      </div>
      <form
        className="px-4 pb-4"
        onSubmit={(event) => {
          event.preventDefault();
          join(slug);
        }}
      >
        <label htmlFor="join-room" className="section-eyebrow block mb-2">
          Entrar em uma sala
        </label>
        <div className="flex gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              id="join-room"
              value={slug}
              onChange={(event) =>
                setSlug(
                  event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                )
              }
              placeholder="Código da sala"
              className="pl-8 bg-background/60"
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            variant="secondary"
            disabled={!slug.trim()}
            aria-label="Entrar na sala"
          >
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </form>
      <div className="navigation-section-label">
        <span className="section-eyebrow">Suas salas</span>
        <span className="text-caption text-muted-foreground">
          {new Set([roomId, ...recentRooms]).size}
        </span>
      </div>
      {recentRooms.length > 4 && (
        <div className="px-4 pb-2">
          <Input
            aria-label="Filtrar salas recentes"
            placeholder="Filtrar salas…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 bg-transparent"
          />
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 px-3 py-1">
          {rooms.map((room) => (
            <div key={room} className="room-item" data-active={room === roomId}>
              <button
                className="room-item-link"
                onClick={() => join(room)}
                aria-current={room === roomId ? "page" : undefined}
              >
                <span className="room-icon">
                  <Hash className="size-4" />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium">
                    {room}
                  </span>
                  <span className="block text-caption text-muted-foreground">
                    {room === roomId
                      ? inVoiceCall
                        ? "Chamada em andamento"
                        : "Conversa atual"
                      : "Sala recente"}
                  </span>
                </span>
                {room === roomId && isConnected && (
                  <span className="status-dot" />
                )}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Opções da sala ${room}`}
                    className="room-menu"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={()=>setRemoving(room)}>Remover sala deste dispositivo</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => join(room)}>
                    <Hash className="mr-2 size-4" />
                    Abrir sala
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => copyRoom(room)}>
                    {copied === room ? (
                      <Check className="mr-2 size-4" />
                    ) : (
                      <Copy className="mr-2 size-4" />
                    )}
                    Copiar código
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          {rooms.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">
              Nenhuma sala encontrada.
            </p>
          )}
        </div>
      {studio.theme.name === "Clássico" && <div className="px-3 py-4 border-t border-border"><p className="section-eyebrow mb-3">Na sala</p>{Object.values(participants).map(p=><div key={p.peerId} className="flex gap-2 items-center py-2"><ParticipantAvatar clientId={p.clientId} name={p.nickname} color={p.avatarColor} className="size-8"/><div className="text-xs"><p>{p.nickname}</p><span className="text-muted-foreground">{p.inVoiceCall?"Na voz":"No chat"}</span></div></div>)}</div>}
      </ScrollArea>
      {removed && <Button variant="ghost" onClick={()=>{useHubStore.getState().addRecentRoom(removed);setRemoved(null);}}>Restaurar sala removida</Button>}
      <AlertDialog open={!!removing} onOpenChange={open=>{if(!open)setRemoving(null);}}><AlertDialogContent><AlertDialogTitle>Remover sala deste dispositivo?</AlertDialogTitle><AlertDialogDescription>Remove apenas dos seus recentes e sai da sala atual. Os participantes, mensagens e arquivos são preservados. Você poderá restaurar ou entrar pelo código novamente.</AlertDialogDescription><Button data-alert-cancel variant="outline" onClick={()=>setRemoving(null)}>Cancelar</Button><Button variant="destructive" onClick={()=>{if(!removing)return;const room=removing;if(room===roomId){webrtcEngine.leaveRoom();localStorage.setItem("cbshub-room-removed-active","1");useHubStore.setState({roomId:""});}useHubStore.setState(s=>({recentRooms:s.recentRooms.filter(r=>r!==room)}));setRemoved(room);setRemoving(null);}}>Confirmar remoção local</Button></AlertDialogContent></AlertDialog>
      <div role="status" className="sr-only">
        {copyError
          ? "Não foi possível copiar o código."
          : copied
            ? `Código de ${copied} copiado.`
            : ""}
      </div>
      <div className="navigation-note">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <p>Compartilhe o código de uma sala e comece uma conversa.</p>
      </div>
      <div className="local-user-panel">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            aria-label="Editar meu perfil"
            onClick={() => profiles.view("self")}
          >
            <ParticipantAvatar
              clientId={profiles.own.ownerId}
              interactive={false}
              name={nickname}
              color={avatarColor}
              speaking={isLocalSpeaking && !isMuted}
            />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{nickname}</p>
            <p className="flex items-center gap-1 text-caption text-muted-foreground">
              <Signal className="size-3" />
              {inVoiceCall
                ? "Na chamada"
                : isConnected
                  ? "Disponível"
                  : "Offline"}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsSettingsOpen(true)}
                aria-label="Configurações do perfil"
              >
                <Settings2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Configurações</TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant={isMuted ? "destructive" : "secondary"}
            size="sm"
            title={isMuted ? "Ativar microfone" : "Silenciar microfone"}
            aria-pressed={isMuted}
            onClick={() => webrtcEngine.toggleMute()}
            className="gap-2"
          >
            {isMuted ? (
              <MicOff className="size-3.5" />
            ) : (
              <Mic className="size-3.5" />
            )}
            <span className="sr-only">{isMuted ? "Mutado" : "Microfone"}</span>
          </Button>
          <Button
            variant={isDeafened ? "destructive" : "secondary"}
            size="sm"
            title={isDeafened ? "Ativar áudio" : "Silenciar áudio"}
            aria-pressed={isDeafened}
            onClick={() => webrtcEngine.toggleDeafen()}
            className="gap-2"
          >
            <Headphones className="size-3.5" />
            <span className="sr-only">{isDeafened ? "Sem áudio" : "Áudio"}</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
