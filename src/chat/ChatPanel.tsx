import { useChatView, updateChatView, EMPTY_CHAT_VIEW } from "./viewState";
import { useActivities } from "./activities";
import { useShallow } from "zustand/react/shallow";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare,
  Plus,
  Search,
  SendHorizontal,
  Smile,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { useHubStore } from "../store/useHubStore";
import { useProfiles } from "../profiles/ProfileProvider";
import { webrtcEngine } from "../lib/webrtcEngine";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { SoundboardPopover } from "../components/SoundboardPopover";
import { EmojiPickerPopover } from "../components/EmojiPickerPopover";
import { MessageRow } from "./MessageRow";
import type { ChatMessage } from "../types/cbshub";

const MAX_FILE_SIZE_BYTES = 52_428_800; // 50 MB estrito

function draftKey(room: string) {
  return `cbshub-chat-draft:${room}`;
}
function readDraft(room: string) {
  if (!room) return "";
  try {
    return (localStorage.getItem(draftKey(room)) || "").slice(0, 8000);
  } catch {
    return "";
  }
}

export function ChatPanel() {
  const {
    messages,
    activeChannelId,
    activeFriend,
    activeContext,
    clientId,
    typingUsers,
    clearExpiredTyping,
    unreadCount,
    setUnreadCount,
    soundboardClips,
  } = useHubStore(
    useShallow((state) => ({
      messages: state.messages,
      activeChannelId: state.activeChannelId,
      activeFriend: state.activeFriend,
      activeContext: state.activeContext,
      clientId: state.clientId,
      typingUsers: state.typingUsers,
      clearExpiredTyping: state.clearExpiredTyping,
      unreadCount: state.unreadCount,
      setUnreadCount: state.setUnreadCount,
      soundboardClips: state.soundboardClips,
    })),
  );

  const isRoom = activeContext?.type === "room";
  const contextTargetId = isRoom ? activeContext.roomId : activeChannelId;
  const targetDisplayName = isRoom
    ? activeContext.name || activeContext.slug
    : activeFriend?.nickname || "Conversa";
  const roomId = contextTargetId || "global";

  const participantData = useHubStore((state) =>
    JSON.stringify(
      Object.values(state.participants).map((p) => ({
        username: p.profile?.username || p.nickname.replace(/\W/g, "_"),
        clientId: p.clientId,
        isLocal: p.isLocal,
      })),
    ),
  );
  const participants = useMemo(
    () =>
      JSON.parse(participantData) as {
        username: string;
        clientId: string;
        isLocal: boolean;
      }[],
    [participantData],
  );
  const profiles = useProfiles();

  const [text, setText] = useState(() => readDraft(roomId));
  const [end, setEnd] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reply, setReply] = useState<string | undefined>();
  const [edit, setEdit] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);
  const [nearBottom, setNearBottom] = useState(true);

  const soundEvents = useActivities((s) => s.events);
  const view = useChatView((state) => state.views[roomId] ?? EMPTY_CHAT_VIEW);
  const { query, pinned, activities, searchOpen } = view;
  const compact = useChatView((state) => state.compact);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const feed = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const lastRoom = useRef(roomId);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTyping = useRef(0);

  const closeSearch = () => {
    updateChatView(roomId, { searchOpen: false, query: "" });
    requestAnimationFrame(() => {
      (
        document.querySelector(
          '[aria-label="Pesquisar mensagens"]',
        ) as HTMLElement | null
      )?.focus();
    });
  };
  const setQuery = (query: string) => updateChatView(roomId, { query });
  const setPinned = (pinned: boolean) => updateChatView(roomId, { pinned });
  const setActivities = (activities: boolean) =>
    updateChatView(roomId, { activities });

  useEffect(() => {
    setEnd(null);
  }, [query, pinned]);

  useEffect(() => {
    if (lastRoom.current !== roomId) {
      lastRoom.current = roomId;
      setText(readDraft(roomId));
      setReply(undefined);
      setEnd(null);
      setQuery("");
      setPinned(false);
      setUnreadCount(0);
    }
  }, [roomId, setUnreadCount]);

  useEffect(() => {
    if (lastRoom.current !== roomId || !contextTargetId) return;
    try {
      localStorage.setItem(draftKey(roomId), text);
    } catch {
      setError("Não foi possível salvar o rascunho neste dispositivo.");
    }
  }, [text, roomId, contextTargetId]);

  useEffect(() => {
    const timer = setInterval(clearExpiredTyping, 1000);
    return () => clearInterval(timer);
  }, [clearExpiredTyping]);

  useEffect(
    () => () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    },
    [],
  );

  useEffect(() => {
    if (composer.current) {
      composer.current.style.height = "auto";
      composer.current.style.height = `${Math.min(144, composer.current.scrollHeight)}px`;
    }
  }, [text]);

  useEffect(() => {
    if (nearBottom && end === null) {
      feed.current?.scrollTo({ top: feed.current.scrollHeight });
      setUnreadCount(0);
    }
  }, [messages.length, nearBottom, end, setUnreadCount]);

  const mentions = useMemo(
    () =>
      participants.map((p) => ({
        username: p.isLocal ? profiles.own.username : p.username,
        clientId: p.clientId,
      })),
    [participants, profiles.own.username],
  );

  const visible = useMemo(
    () =>
      messages.filter(
        (m) =>
          !profiles.blocked.includes(m.authorClientId) &&
          m.type !== "soundboard" &&
          (!pinned || m.pinned) &&
          (!query ||
            `${m.content} ${m.fileName || ""} ${m.authorNickname}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [messages, profiles.blocked, pinned, query],
  );

  const limit = Math.min(end ?? visible.length, visible.length);
  const start = Math.max(0, limit - 100);
  const windowMessages = visible.slice(start, limit);
  const typing = Object.entries(typingUsers).filter(
    ([id]) => id !== clientId && !profiles.blocked.includes(id),
  );
  const mentionTail = text.match(/@([a-zA-Z0-9_]*)$/)?.[1];
  const suggestions =
    mentionTail === undefined
      ? []
      : mentions
          .filter(
            (m) =>
              m.clientId !== clientId &&
              m.username.toLowerCase().startsWith(mentionTail.toLowerCase()),
          )
          .slice(0, 5);

  async function action(task: () => Promise<unknown>) {
    setError("");
    try {
      await task();
      return true;
    } catch (e) {
      setError(
        (e as Error).message || "Não foi possível concluir. Tente novamente.",
      );
      return false;
    }
  }

  async function send() {
    if (!text.trim() || busy || !contextTargetId) return;
    setBusy(true);
    const content = text;
    if (await action(() => webrtcEngine.sendChatMessage(content, reply))) {
      setText("");
      setReply(undefined);
      setEnd(null);
      setNearBottom(true);
      webrtcEngine.sendTypingState(false);
    }
    setBusy(false);
  }

  async function handleFiles(fileList: FileList | File[]) {
    if (!contextTargetId) {
      setError(
        "Selecione um amigo ou entre em uma sala antes de enviar arquivos.",
      );
      return;
    }
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setBusy(true);
    setError("");
    const errors: string[] = [];
    try {
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          errors.push(
            `Arquivo "${file.name}" excede o limite estrito de 50 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
          );
          continue;
        }
        try {
          await webrtcEngine.sendFileMessage(file);
        } catch (err) {
          errors.push(
            err instanceof Error
              ? err.message
              : `Falha ao enviar "${file.name}".`,
          );
        }
      }
      if (errors.length > 0) {
        setError(errors.join(" | "));
      }
    } finally {
      setBusy(false);
    }
  }

  const scrollLatest = () => {
    setEnd(null);
    setNearBottom(true);
    setUnreadCount(0);
    requestAnimationFrame(() =>
      feed.current?.scrollTo({
        top: feed.current.scrollHeight,
        behavior: "smooth",
      }),
    );
  };

  function changeText(value: string) {
    setText(value);
    const now = Date.now();
    if (now - lastTyping.current > 2000) {
      webrtcEngine.sendTypingState(true);
      lastTyping.current = now;
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(
      () => webrtcEngine.sendTypingState(false),
      2500,
    );
  }

  function insertEmoji(emoji: string) {
    const el = composer.current;
    const a = el?.selectionStart ?? text.length;
    const b = el?.selectionEnd ?? text.length;
    setText((text.slice(0, a) + emoji + text.slice(b)).slice(0, 8000));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(a + emoji.length, a + emoji.length);
    });
  }

  const date = (time: number) =>
    new Date(time).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  if (!contextTargetId || (!activeFriend && !isRoom)) {
    return (
      <section className="chat-panel relative items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-2">
          <MessageSquare className="size-10 text-primary mx-auto opacity-85" />
          <h3 className="text-sm font-semibold text-foreground">
            Nenhuma conversa aberta
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Selecione um amigo para conversar em DM 1:1 ou abra a aba Salas
            para criar e entrar em chamadas em grupo.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="chat-panel relative"
      aria-label={
        isRoom
          ? `Conversa na sala ${targetDisplayName}`
          : `Conversa direta com ${targetDisplayName}`
      }
      onDragEnter={(e) => {
        e.preventDefault();
        dragCounter.current += 1;
        if (e.dataTransfer?.types?.includes("Files")) {
          setDragging(true);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragCounter.current = Math.max(0, dragCounter.current - 1);
        if (dragCounter.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragCounter.current = 0;
        setDragging(false);
        if (e.dataTransfer?.files?.length) {
          void handleFiles(e.dataTransfer.files);
        }
      }}
    >
      {dragging && (
        <div className="absolute inset-3 z-40 rounded-2xl border-2 border-dashed border-primary bg-surface/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2 pointer-events-none">
          <Upload className="size-8 text-primary animate-bounce" />
          <p className="text-sm font-semibold text-foreground">
            Solte o arquivo para enviar para {targetDisplayName}
          </p>
          <p className="text-xs text-muted-foreground">
            Limite máximo: 50 MB por arquivo
          </p>
        </div>
      )}

      {searchOpen && (
        <div
          className="chat-search"
          role="search"
          aria-label="Pesquisa de mensagens"
        >
          <Search className="size-4" />
          <Input
            autoFocus
            aria-label="Buscar no histórico"
            placeholder="Buscar nas mensagens desta conversa…"
            value={query}
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") closeSearch();
            }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Fechar pesquisa"
            onClick={closeSearch}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {pinned && (
        <div className="chat-filter-status">
          <span>Mensagens fixadas</span>
          <Button variant="ghost" size="sm" onClick={() => setPinned(false)}>
            Mostrar todas as mensagens
          </Button>
        </div>
      )}

      <div
        className="chat-feed"
        ref={feed}
        role="log"
        aria-label="Mensagens da conversa"
        aria-live="polite"
        onScroll={() => {
          const el = feed.current;
          if (el)
            setNearBottom(
              el.scrollHeight - el.scrollTop - el.clientHeight < 120,
            );
        }}
      >
        {start > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="chat-history-button"
            onClick={() => {
              setEnd(limit - 50);
              setNearBottom(false);
            }}
          >
            Carregar mensagens anteriores
          </Button>
        )}

        {!windowMessages.length && (
          <div className="chat-empty">
            <MessageSquare className="size-8 text-primary" />
            <h3>
              {query
                ? "Nenhum resultado"
                : pinned
                  ? "Nenhuma mensagem fixada"
                  : isRoom && activeContext?.type === "room"
                    ? `Bem-vindo à sala #${activeContext.slug}`
                    : `Início da conversa com ${targetDisplayName}`}
            </h3>
            <p>
              {query
                ? "Tente outro termo na conversa."
                : isRoom
                  ? "Envie mensagens, arquivos ou entre na chamada de voz em grupo."
                  : "Envie mensagens, arquivos ou faça uma ligação direta 1:1."}
            </p>
          </div>
        )}

        {windowMessages.map((m, index) => {
          const prev = windowMessages[index - 1];
          const newDate =
            !prev ||
            new Date(prev.createdAt).toDateString() !==
              new Date(m.createdAt).toDateString();
          const grouped =
            !newDate &&
            prev.authorClientId === m.authorClientId &&
            prev.type === m.type &&
            m.createdAt - prev.createdAt < 300000;
          return (
            <div key={m.id}>
              {newDate && (
                <div className="chat-date-separator">
                  <span>{date(m.createdAt)}</span>
                </div>
              )}
              <MessageRow
                message={m}
                grouped={grouped}
                compact={compact}
                own={m.authorClientId === clientId}
                replied={messages.find(
                  (x) =>
                    x.id === m.replyTo &&
                    !profiles.blocked.includes(x.authorClientId),
                )}
                mentions={mentions}
                onMention={profiles.view}
                onReply={() => {
                  setReply(m.id);
                  composer.current?.focus();
                }}
                onEdit={() => {
                  setEdit(m);
                  setEditText(m.content);
                }}
                onDelete={() => setDeleting(m)}
                onPin={() =>
                  void action(() =>
                    webrtcEngine.mutateChat(m.id, "pin", { active: !m.pinned }),
                  )
                }
                onReact={(emoji) =>
                  void action(() =>
                    webrtcEngine.toggleMessageReaction(m.id, emoji),
                  )
                }
                onReplay={
                  m.type === "soundboard"
                    ? () => {
                        const clip = soundboardClips.find(
                          (c) => c.name === m.soundMeta?.soundName,
                        );
                        if (clip)
                          void action(() =>
                            webrtcEngine.triggerSoundboardClip(clip),
                          );
                      }
                    : undefined
                }
              />
            </div>
          );
        })}

        {limit < visible.length && (
          <Button
            variant="outline"
            size="sm"
            className="chat-history-button"
            onClick={() => setEnd(Math.min(visible.length, limit + 50))}
          >
            Carregar mensagens seguintes
          </Button>
        )}
      </div>

      {(!nearBottom || end !== null) && (
        <Button
          variant="secondary"
          size="sm"
          className="chat-latest"
          onClick={scrollLatest}
        >
          {unreadCount > 0
            ? `${unreadCount} novas mensagens`
            : "Voltar às recentes"}
        </Button>
      )}

      <div className="chat-typing" role="status">
        {typing.length
          ? `${typing.map(([, v]) => v.nickname).join(", ")} ${typing.length === 1 ? "está digitando" : "estão digitando"}…`
          : ""}
      </div>

      {reply && (
        <div className="chat-replying">
          <ReplyLabel />
          Respondendo a{" "}
          {messages.find((m) => m.id === reply)?.authorNickname ?? "mensagem"}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Cancelar resposta"
            onClick={() => setReply(undefined)}
          >
            <X className="size-3" />
          </Button>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="chat-mention-options" aria-label="Sugestões de menção">
          {suggestions.map((m) => (
            <Button
              key={m.clientId}
              variant="ghost"
              size="sm"
              onClick={() => {
                setText(text.replace(/@[a-zA-Z0-9_]*$/, `@${m.username} `));
                composer.current?.focus();
              }}
            >
              @{m.username}
            </Button>
          ))}
        </div>
      )}

      <div className="chat-composer">
        <div className="chat-composer-row">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                void handleFiles(e.target.files);
              }
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Anexar arquivo (máx 50 MB)"
            title="Enviar arquivo (máx 50 MB)"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0"
          >
            <Plus className="size-4" />
          </Button>

          <textarea
            id="message-composer"
            ref={composer}
            aria-label={
              isRoom && activeContext?.type === "room"
                ? `Mensagem para #${activeContext.slug}`
                : `Mensagem para ${targetDisplayName}`
            }
            placeholder={
              isRoom && activeContext?.type === "room"
                ? `Conversar em #${activeContext.slug}...`
                : `Conversar com ${targetDisplayName}...`
            }
            className="chat-input"
            value={text}
            maxLength={8000}
            rows={1}
            onChange={(e) => changeText(e.target.value)}
            onPaste={(e) => {
              const items = e.clipboardData?.files;
              if (items && items.length > 0) {
                e.preventDefault();
                void handleFiles(items);
              }
            }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <SoundboardPopover
            side="top"
            align="end"
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Abrir soundboard"
              >
                <Volume2 className="size-4" />
              </Button>
            }
          />
          <EmojiPickerPopover
            onSelectEmoji={insertEmoji}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label="Inserir emoji">
                <Smile className="size-4" />
              </Button>
            }
          />
          <Button
            size="icon-sm"
            aria-label="Enviar mensagem"
            disabled={!text.trim() || busy}
            onClick={() => void send()}
          >
            <SendHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      <div className="composer-hint">
        <span>
          {busy
            ? "Enviando…"
            : "Arraste arquivos, cole imagens (Ctrl+V) ou use Markdown · máx. 50 MB"}
        </span>
        <span>{text.length}/8000</span>
      </div>

      {error && (
        <div className="chat-error" role="alert">
          {error}
          <Button variant="ghost" size="sm" onClick={() => setError("")}>
            Fechar
          </Button>
        </div>
      )}

      <Dialog
        open={!!edit}
        onOpenChange={(open) => {
          if (!open) setEdit(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Editar mensagem</DialogTitle>
          <DialogDescription>
            Somente o autor pode editar o conteúdo.
          </DialogDescription>
          <textarea
            aria-label="Editar conteúdo"
            className="chat-edit-input"
            maxLength={8000}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (
                  edit &&
                  (await action(() =>
                    webrtcEngine.mutateChat(edit.id, "edit", {
                      content: editText,
                    }),
                  ))
                )
                  setEdit(null);
              }}
            >
              Salvar edição
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Excluir mensagem?</DialogTitle>
          <DialogDescription>
            A mensagem será removida permanentemente para ambos os participantes.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (
                  deleting &&
                  (await action(() =>
                    webrtcEngine.mutateChat(deleting.id, "delete"),
                  ))
                )
                  setDeleting(null);
              }}
            >
              Confirmar exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activities} onOpenChange={setActivities}>
        <DialogContent className="chat-activities">
          <DialogTitle>Atividades de Efeitos Sonoros</DialogTitle>
          <DialogDescription>
            Os últimos 50 eventos disponíveis.
          </DialogDescription>
          {[...messages, ...soundEvents]
            .filter(
              (m) =>
                m.type === "soundboard" &&
                m.roomId === roomId &&
                !profiles.blocked.includes(m.authorClientId),
            )
            .slice(-50)
            .reverse()
            .map((m) => (
              <div className="chat-activity" key={m.id}>
                <span>
                  {m.soundMeta?.emoji} {m.authorNickname}
                </span>
                <p>{m.deleted ? "Evento excluído" : m.content}</p>
                <time>{new Date(m.createdAt).toLocaleTimeString()}</time>
              </div>
            ))}
        </DialogContent>
      </Dialog>
    </section>
  );
}
function ReplyLabel() {
  return <span aria-hidden="true">↩</span>;
}
