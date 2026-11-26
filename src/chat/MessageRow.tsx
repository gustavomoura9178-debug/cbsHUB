import { useShallow } from "zustand/react/shallow";
import { useMessageIdentity } from "./viewState";
import { useStudio } from "../studio/StudioProvider";
import { contrast } from "../studio/theme";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Copy,
  Download,
  Eye,
  File as FileIcon,
  FileCode,
  FileText,
  Hash,
  Loader2,
  LogIn,
  MoreHorizontal,
  Pause,
  Pencil,
  Pin,
  Play,
  RefreshCw,
  Reply,
  Trash2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import { EmojiPickerPopover } from "../components/EmojiPickerPopover";
import { ParticipantAvatar } from "../components/ParticipantAvatar";
import { SafeMarkdown, LinkPreview } from "./SafeMarkdown";
import { webrtcEngine } from "../lib/webrtcEngine";
import { useHubStore } from "../store/useHubStore";
import type { ChatMessage } from "../types/cbshub";

const ROOM_INVITE_RE = /convite:\/\/sala\/([a-z0-9-]{1,48})/i;

interface Props {
  message: ChatMessage;
  grouped: boolean;
  own: boolean;
  replied?: ChatMessage;
  mentions: { username: string; clientId: string }[];
  onMention: (id: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
  onReact: (emoji: string) => void;
  compact: boolean;
  onReplay?: () => void;
}

const TEXT_CODE_EXTS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "py",
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "scss",
  "html",
  "sql",
  "yml",
  "yaml",
  "xml",
  "csv",
  "log",
  "sh",
  "ps1",
  "env",
  "rs",
  "go",
  "c",
  "cpp",
  "h",
]);

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatRate(bps: number): string {
  if (!bps || bps <= 0) return "0 KB/s";
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

function fileExtension(name?: string | null): string {
  if (!name) return "";
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MessageRow({
  message: m,
  grouped,
  own,
  replied,
  mentions,
  onMention,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReact,
  compact,
  onReplay,
}: Props) {
  const { showAvatars, colorNames } = useMessageIdentity(
    useShallow((s) => ({
      showAvatars: s.showAvatars,
      colorNames: s.colorNames,
    })),
  );
  const { theme } = useStudio();
  const authorColor =
    colorNames &&
    /^#[0-9a-f]{6}$/i.test(m.authorAvatarColor) &&
    contrast(m.authorAvatarColor, theme.colors.messages) >= 4.5
      ? m.authorAvatarColor
      : undefined;

  const [copy, setCopy] = useState("Copiar conteúdo");
  const [menuOpen, setMenuOpen] = useState(false);

  const hasAttachment = Boolean(m.fileUrl || m.fileName);
  const isDefaultFileCaption =
    hasAttachment && m.fileName && m.content.trim() === m.fileName.trim();
  const inviteMatch = !m.deleted ? ROOM_INVITE_RE.exec(m.content || "") : null;
  const inviteSlug = inviteMatch?.[1]?.toLowerCase() ?? null;

  return (
    <article
      onContextMenu={(event) => {
        if (!m.deleted) {
          event.preventDefault();
          setMenuOpen(true);
        }
      }}
      id={`message-${m.id}`}
      className={`chat-message-row ${grouped || compact ? "chat-message-compact" : ""} ${m.type === "soundboard" ? "chat-sound-event" : ""}`}
      data-message-id={m.id}
    >
      {!grouped && !compact && showAvatars && (
        <ParticipantAvatar
          clientId={m.authorClientId}
          name={m.authorNickname}
          color={m.authorAvatarColor}
        />
      )}
      <div className="min-w-0 flex-1">
        <header className="chat-message-meta">
          {(!grouped || compact) && (
            <strong style={{ color: authorColor }}>{m.authorNickname}</strong>
          )}
          <time
            dateTime={new Date(m.createdAt).toISOString()}
            title={new Date(m.createdAt).toLocaleString()}
          >
            {new Date(m.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
          {m.editedAt && !m.deleted && <span>editada</span>}
          {m.pinned && !m.deleted && (
            <span className="chat-pinned-label">
              <Pin className="size-3" />
              Fixada
            </span>
          )}
          {own && (
            <span
              aria-label="Estado de envio"
              className={m.delivery === "error" ? "text-destructive font-medium" : undefined}
            >
              {m.delivery === "error"
                ? "Falha ao enviar"
                : m.delivery === "queued"
                  ? "Enviando..."
                  : "Enviada"}
            </span>
          )}
        </header>

        {m.replyTo && (
          <div className="chat-reply-preview">
            <Reply className="size-3" />
            <span>
              {replied && !replied.deleted
                ? `${replied.authorNickname}: ${replied.content.slice(0, 120)}`
                : "Mensagem original indisponível"}
            </span>
          </div>
        )}

        {m.deleted ? (
          <p className="text-sm text-muted-foreground italic">
            Mensagem excluída
          </p>
        ) : m.type === "soundboard" ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{m.soundMeta?.emoji || "♫"}</span>
            <span>{m.content}</span>
            {onReplay && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReplay}
                aria-label="Tocar som novamente"
              >
                Ouvir
              </Button>
            )}
          </div>
        ) : (
          <>
            {m.content && !isDefaultFileCaption && (
              <>
                <SafeMarkdown
                  content={m.content}
                  mentions={mentions}
                  onMention={onMention}
                />
                {inviteSlug ? (
                  <RoomInviteCard slug={inviteSlug} />
                ) : (
                  <LinkPreview content={m.content} />
                )}
              </>
            )}

            {m.uploadProgress && (
              <div className="mt-1.5 max-w-xs rounded-xl border border-border bg-card p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium text-foreground pr-2">
                    {m.fileName || "Enviando arquivo..."}
                  </span>
                  <span className="font-mono text-2xs text-primary shrink-0">
                    {m.uploadProgress.percent}% ·{" "}
                    {formatRate(m.uploadProgress.bytesPerSecond)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-150"
                    style={{ width: `${m.uploadProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {!m.uploadProgress && (m.fileUrl || m.fileName) && (
              <AttachmentRenderer message={m} />
            )}
          </>
        )}

        {!m.deleted && (
          <div className="chat-reactions">
            {Object.values(m.reactions).map((r) => (
              <button
                key={r.emoji}
                title={Object.values(r.reactorNicknames).join(", ")}
                aria-label={`Reagir ${r.emoji}`}
                onClick={() => onReact(r.emoji)}
              >
                {r.emoji} {r.reactorClientIds.length}
              </button>
            ))}
          </div>
        )}
      </div>

      {!m.deleted && (
        <div className="chat-message-tools">
          <EmojiPickerPopover
            onSelectEmoji={onReact}
            trigger={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Reagir à mensagem de ${m.authorNickname}`}
              >
                ☺
              </Button>
            }
          />
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Opções da mensagem de ${m.authorNickname}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onReply}>
                <Reply className="size-4 mr-2" />
                Responder
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      m.content || m.fileUrl || "",
                    );
                    setCopy("Copiado");
                  } catch {
                    setCopy("Falha ao copiar");
                  }
                }}
              >
                <Copy className="size-4 mr-2" />
                {copy}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onReact("👍")}>
                👍 Reagir à mensagem
              </DropdownMenuItem>
              {own && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onEdit}>
                    <Pencil className="size-4 mr-2" />
                    Editar mensagem
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onPin}>
                    <Pin className="size-4 mr-2" />
                    {m.pinned ? "Desafixar mensagem" : "Fixar mensagem"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={onDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="size-4 mr-2" />
                    Excluir mensagem
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </article>
  );
}

function AttachmentRenderer({ message }: { message: ChatMessage }) {
  const name = message.fileName || "arquivo";
  const type = message.fileType || "";
  const size = message.fileSize;

  const [resolveState, setResolveState] = useState<
    "loading" | "ready" | "missing" | "offline"
  >("loading");
  const [url, setUrl] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [purging, setPurging] = useState(false);

  const [lightbox, setLightbox] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerContent, setViewerContent] = useState("");
  const [viewerError, setViewerError] = useState("");
  const [playbackRate, setPlaybackRate] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeUrlRef = useRef("");

  const isExplicitPurged = Boolean(
    message.fileUrl?.startsWith("local://purged/"),
  );

  useEffect(() => {
    let active = true;
    const isQueued = Boolean(message.uploadProgress);
    if (isQueued) {
      setResolveState("loading");
      return () => {
        active = false;
      };
    }

    if (isExplicitPurged) {
      if (activeUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = "";
      }
      setUrl("");
      setResolveState("missing");
      return () => {
        active = false;
      };
    }

    // Se o blob local já está pronto e só chegou UPDATE trocando para local://stored/, preserva-o
    if (
      activeUrlRef.current &&
      message.fileUrl?.startsWith("local://stored/")
    ) {
      setResolveState("ready");
      return () => {
        active = false;
      };
    }

    setResolveState("loading");
    void webrtcEngine
      .resolveAttachmentBlobUrl(message)
      .then((res) => {
        if (!active) {
          if (res.status === "ready" && res.url.startsWith("blob:")) {
            URL.revokeObjectURL(res.url);
          }
          return;
        }
        if (res.status === "ready") {
          if (
            activeUrlRef.current &&
            activeUrlRef.current !== res.url &&
            activeUrlRef.current.startsWith("blob:")
          ) {
            URL.revokeObjectURL(activeUrlRef.current);
          }
          activeUrlRef.current = res.url;
          setUrl(res.url);
          setResolveState("ready");
        } else {
          setUrl("");
          setResolveState(res.status);
        }
      })
      .catch(() => {
        if (active) {
          setUrl("");
          setResolveState("missing");
        }
      });

    return () => {
      active = false;
    };
  }, [
    message.id,
    isExplicitPurged,
    Boolean(message.uploadProgress),
    message.fileUrl?.startsWith("http") ? message.fileUrl : "local",
    retryToken,
  ]);

  useEffect(() => {
    return () => {
      if (activeUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = "";
      }
    };
  }, [message.id]);

  const handleDeleteLocal = async () => {
    if (purging) return;
    setPurging(true);
    try {
      await webrtcEngine.deleteAttachmentFromLocalMemory(message);
      if (activeUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = "";
      }
      setUrl("");
      setLightbox(false);
      setViewerOpen(false);
      setResolveState("missing");
    } finally {
      setPurging(false);
    }
  };

  const ext = fileExtension(name);
  const isImage =
    type.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext);
  const isVideo =
    type.startsWith("video/") || ["mp4", "webm", "mov", "mkv"].includes(ext);
  const isAudio =
    type.startsWith("audio/") ||
    ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext);
  const isTextPreviewable =
    type.startsWith("text/") ||
    type === "application/json" ||
    TEXT_CODE_EXTS.has(ext);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const openDocumentPreview = async () => {
    setViewerOpen(true);
    if (viewerContent) return;
    setViewerLoading(true);
    setViewerError("");
    try {
      const content = await webrtcEngine.readAttachmentText(message);
      setViewerContent(content);
    } catch (err) {
      setViewerError(
        err instanceof Error
          ? err.message
          : "Esse item não foi encontrado na memoria, peça para o usuario enviar novamente",
      );
    } finally {
      setViewerLoading(false);
    }
  };

  if (resolveState === "loading") {
    return (
      <div className="mt-1.5 inline-flex items-center gap-2.5 rounded-xl border border-border bg-card/80 px-3 py-2 max-w-sm">
        <Loader2 className="size-4 animate-spin text-primary shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">{name}</p>
          <p className="text-micro text-muted-foreground">
            Sincronizando para memória local… · {formatBytes(size)}
          </p>
        </div>
      </div>
    );
  }

  if (resolveState === "offline") {
    return (
      <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-warning/40 bg-card px-3 py-2.5 max-w-md">
        <AlertCircle className="size-4 text-warning shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{name}</p>
          <p className="text-2xs text-muted-foreground">
            Sem conexão para baixar agora. Conecte-se e tente novamente.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setRetryToken((n) => n + 1)}
          className="h-7 px-2 text-xs gap-1 shrink-0"
        >
          <RefreshCw className="size-3.5" />
          <span>Tentar</span>
        </Button>
      </div>
    );
  }

  if (resolveState === "missing" || !url) {
    return (
      <div className="mt-1.5 flex items-start gap-2.5 rounded-xl border border-border/80 bg-card/60 px-3 py-2.5 max-w-md">
        <AlertCircle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-xs font-medium text-foreground">
            {name}{" "}
            <span className="font-normal text-muted-foreground">
              ({formatBytes(size)})
            </span>
          </p>
          <p className="text-2xs text-warning leading-relaxed">
            Esse item não foi encontrado na memoria, peça para o usuario enviar novamente
          </p>
        </div>
      </div>
    );
  }

  if (isImage) {
    return (
      <>
        <div className="mt-1.5 inline-flex flex-col gap-1 max-w-sm">
          <button
            type="button"
            onClick={() => setLightbox(true)}
            className="block rounded-xl overflow-hidden border border-border bg-card text-left group"
            aria-label={`Ampliar imagem ${name}`}
          >
            <img
              src={url}
              alt={name}
              onLoad={() => setImgLoaded(true)}
              className={`max-h-72 w-auto object-contain transition-opacity duration-300 ${
                imgLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          </button>
          <div className="flex items-center justify-between px-1 text-micro text-muted-foreground">
            <span className="truncate pr-2">
              {name} · {formatBytes(size)}
            </span>
            <button
              type="button"
              disabled={purging}
              onClick={() => void handleDeleteLocal()}
              title="Apagar cópia da memória local deste dispositivo"
              className="inline-flex items-center gap-1 hover:text-destructive transition-colors shrink-0"
            >
              <Trash2 className="size-3" />
              <span>Apagar local</span>
            </button>
          </div>
        </div>

        <Dialog open={lightbox} onOpenChange={setLightbox}>
          <DialogContent className="max-w-4xl bg-background/95 border-border p-3">
            <DialogTitle className="text-xs font-medium text-muted-foreground truncate pr-8">
              {name} ({formatBytes(size)})
            </DialogTitle>
            <DialogDescription className="sr-only">
              Visualização em tela cheia da imagem {name}
            </DialogDescription>
            <div className="flex items-center justify-center max-h-[78dvh] overflow-hidden rounded-lg bg-black/50">
              <img
                src={url}
                alt={name}
                className="max-h-[75dvh] max-w-full object-contain"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={purging}
                onClick={() => void handleDeleteLocal()}
                className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" />
                <span>Apagar da memória local</span>
              </Button>
              <a
                href={url}
                download={name}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <Download className="size-3.5" />
                <span>Baixar original</span>
              </a>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (isVideo) {
    return (
      <div className="mt-1.5 max-w-md rounded-xl border border-border bg-card overflow-hidden">
        <video
          ref={videoRef}
          src={url}
          controls
          preload="metadata"
          className="w-full max-h-72 bg-black"
        />
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-2xs text-muted-foreground border-t border-border/60">
          <span className="truncate pr-2">
            {name} · {formatBytes(size)}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <span>Vel:</span>
            {[0.5, 1, 1.5, 2].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setPlaybackRate(r)}
                className={`px-1.5 py-0.5 rounded ${
                  playbackRate === r
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "hover:bg-accent"
                }`}
              >
                {r}x
              </button>
            ))}
            <button
              type="button"
              disabled={purging}
              onClick={() => void handleDeleteLocal()}
              title="Apagar da memória local"
              className="ml-1 p-1 rounded hover:text-destructive transition-colors"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isAudio) {
    return (
      <SlimAudioPlayer
        url={url}
        name={name}
        size={size}
        onDeleteLocal={() => void handleDeleteLocal()}
      />
    );
  }

  const Icon = isTextPreviewable ? FileCode : FileText;

  return (
    <>
      <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 max-w-md">
        <div className="size-9 rounded-lg bg-secondary flex items-center justify-center text-primary shrink-0">
          {ext === "pdf" ? (
            <FileIcon className="size-4" />
          ) : (
            <Icon className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{name}</p>
          <p className="text-2xs text-muted-foreground">
            {ext ? ext.toUpperCase() : "ARQUIVO"} · {formatBytes(size)}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isTextPreviewable && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 px-2.5 text-xs gap-1"
              onClick={() => void openDocumentPreview()}
            >
              <Eye className="size-3.5" />
              <span>Visualizar</span>
            </Button>
          )}
          <a
            href={url}
            download={name}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-accent transition-colors"
            title="Baixar arquivo"
          >
            <Download className="size-3.5" />
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={purging}
            onClick={() => void handleDeleteLocal()}
            aria-label="Apagar da memória local"
            title="Apagar da memória local"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-3xl max-h-[85dvh] flex flex-col">
          <DialogTitle className="truncate pr-8">{name}</DialogTitle>
          <DialogDescription>
            Visualização somente leitura · {formatBytes(size)}
          </DialogDescription>
          <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-border bg-background p-4">
            {viewerLoading ? (
              <p className="text-xs text-muted-foreground">
                Carregando conteúdo…
              </p>
            ) : viewerError ? (
              <p className="text-xs text-destructive">{viewerError}</p>
            ) : ext === "md" || ext === "markdown" ? (
              <SafeMarkdown content={viewerContent} />
            ) : (
              <SafeMarkdown
                content={`\`\`\`${ext || "txt"}\n${viewerContent}\n\`\`\``}
              />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <a
              href={url}
              download={name}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Download className="size-3.5" />
              <span>Baixar</span>
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SlimAudioPlayer({
  url,
  name,
  size,
  onDeleteLocal,
}: {
  url: string;
  name: string;
  size?: number | null;
  onDeleteLocal: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      void el.play().catch(() => {});
    }
  };

  return (
    <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 max-w-sm">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() =>
          setDuration(audioRef.current?.duration || 0)
        }
      />
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        onClick={toggle}
        aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}
        className="shrink-0 rounded-full"
      >
        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </Button>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between text-2xs">
          <span className="truncate font-medium text-foreground pr-2">
            {name}
          </span>
          <span className="font-mono text-muted-foreground shrink-0">
            {formatTime(current)} / {formatTime(duration)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={current}
          aria-label="Progresso do áudio"
          onChange={(e) => {
            const val = Number(e.target.value);
            if (audioRef.current) audioRef.current.currentTime = val;
            setCurrent(val);
          }}
          className="w-full h-1 accent-primary cursor-pointer"
        />
      </div>
      <a
        href={url}
        download={name}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
        title={`Baixar (${formatBytes(size)})`}
      >
        <Download className="size-3.5" />
      </a>
      <button
        type="button"
        onClick={onDeleteLocal}
        title="Apagar da memória local"
        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function RoomInviteCard({ slug }: { slug: string }) {
  const activeContext = useHubStore((s) => s.activeContext);
  const [joining, setJoining] = useState(false);
  const alreadyHere =
    activeContext?.type === "room" && activeContext.slug === slug;

  const handleJoin = async () => {
    if (joining || alreadyHere) return;
    setJoining(true);
    try {
      await webrtcEngine.createOrJoinRoom(slug);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-card/90 px-3.5 py-2.5 max-w-sm">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="size-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Hash className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-micro uppercase tracking-wider font-semibold text-primary">
            Convite para Sala
          </p>
          <p className="truncate text-xs font-semibold text-foreground">
            #{slug}
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant={alreadyHere ? "secondary" : "default"}
        disabled={joining || alreadyHere}
        onClick={() => void handleJoin()}
        className="h-7 px-2.5 text-xs gap-1 shrink-0"
      >
        <LogIn className="size-3.5" />
        <span>
          {alreadyHere
            ? "Na sala"
            : joining
              ? "Entrando..."
              : "Entrar na Sala"}
        </span>
      </Button>
    </div>
  );
}
