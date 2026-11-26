import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileAudio, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import { EmojiPickerPopover } from "./EmojiPickerPopover";
import { AudioTrimEditor } from "./AudioTrimEditor";
import { soundboardEngine } from "../lib/soundboardEngine";

function formatKb(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function AddSoundDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [file, setFile] = useState<File | null>(null);
  const [edited, setEdited] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🔊");
  const [volume, setVolume] = useState(0.85);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setEdited(null);
      setError("");
      setName("");
      setEmoji("🔊");
      setVolume(0.85);
    }
  }, [open]);

  const choose = (next?: File) => {
    if (!next) return;
    if (next.size > 5 * 1024 * 1024) {
      setError("Use áudio de até 5 MB.");
      return;
    }
    setFile(next);
    setEdited(null);
    setName(next.name.replace(/\.[^.]+$/, "").slice(0, 60));
    setError("");
  };

  const save = async () => {
    if (!file || !edited || !name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await soundboardEngine.saveCustomSoundToCloud({
        id: crypto.randomUUID(),
        name: name.trim(),
        emoji,
        volume,
        isBuiltIn: false,
        isFavorite: false,
        createdAt: Date.now(),
        audioBlob: edited,
        originalAudioBlob: file,
        durationSec: duration,
        trimStartSec: range.start,
        trimEndSec: range.end,
      });
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent className="max-w-lg max-h-[88dvh] overflow-y-auto space-y-3">
        <div>
          <DialogTitle>Adicionar Efeito Sonoro</DialogTitle>
          <DialogDescription>
            Importe áudio de até 5 MB e 120s, selecione o trecho e aplique o
            corte antes de salvar.
          </DialogDescription>
        </div>

        <div
          className="rounded-xl border border-dashed border-border bg-background/50 p-3 transition-colors hover:border-primary/60"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            choose(e.dataTransfer.files[0]);
          }}
        >
          <input
            ref={inputRef}
            id="add-sound-file"
            type="file"
            aria-label="Arquivo de áudio"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
            className="sr-only"
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {file ? (
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <FileAudio className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {file.name}
                </p>
                <p className="text-micro text-muted-foreground">
                  {formatKb(file.size)}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
                className="h-7 px-2.5 text-xs shrink-0"
              >
                Trocar áudio
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full py-3 flex flex-col items-center justify-center gap-1.5 text-center"
            >
              <Upload className="size-5 text-primary" />
              <span className="text-xs font-medium text-foreground">
                Clique ou arraste um arquivo de áudio aqui
              </span>
              <span className="text-micro text-muted-foreground">
                MP3, WAV, OGG, M4A ou WebM · máx. 5 MB
              </span>
            </button>
          )}
        </div>

        {file && (
          <div className="space-y-3">
            <AudioTrimEditor
              source={file}
              onPendingChange={() => setEdited(null)}
              onApply={(blob, seconds, start, end) => {
                setRange({ start, end });
                setEdited(blob);
                setDuration(seconds);
              }}
            />

            <div className="flex items-end gap-2.5">
              <label className="flex-1 text-xs space-y-1">
                <span className="text-muted-foreground block">
                  Nome do efeito
                </span>
                <Input
                  aria-label="Nome do efeito"
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9"
                />
              </label>
              <div className="space-y-1 shrink-0">
                <span className="text-xs text-muted-foreground block">
                  Ícone
                </span>
                <EmojiPickerPopover
                  onSelectEmoji={setEmoji}
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      aria-label="Escolher emoji do efeito"
                      className="size-9 p-0 text-lg"
                    >
                      {emoji}
                    </Button>
                  }
                />
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/40 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Volume padrão</span>
                <span className="font-mono font-semibold text-foreground">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              <Slider
                aria-label="Volume padrão do efeito"
                min={0}
                max={1.5}
                step={0.05}
                value={[volume]}
                onValueChange={([value]) => setVolume(value)}
              />
            </div>

            {edited ? (
              <p
                role="status"
                className="flex items-center gap-1.5 text-xs text-success bg-success/10 border border-success/30 rounded-lg px-2.5 py-1.5"
              >
                <CheckCircle2 className="size-3.5 shrink-0" />
                <span>
                  Corte aplicado: {duration.toFixed(2)}s pronto para salvar.
                </span>
              </p>
            ) : (
              <p className="text-2xs text-muted-foreground">
                Clique em <strong>Aplicar corte</strong> acima para habilitar o
                salvamento.
              </p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!edited || !name.trim() || busy}
            onClick={() => void save()}
          >
            {busy ? "Salvando…" : "Salvar efeito"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
