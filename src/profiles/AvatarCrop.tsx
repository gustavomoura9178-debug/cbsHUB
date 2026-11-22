import { useEffect, useRef, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Slider } from "../components/ui/slider";
import { compressCanvasImage } from "./repository";

function formatKb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function AvatarCrop({
  file,
  sourceDataUrl,
  kind = "avatar",
  onSave,
  onClose,
}: {
  file?: File | null;
  sourceDataUrl?: string | null;
  kind?: "avatar" | "banner";
  onSave: (data: string) => void;
  onClose: () => void;
}) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [url, setUrl] = useState("");
  const [originalBytes, setOriginalBytes] = useState<number>(0);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [error, setError] = useState("");
  const [compressedBytes, setCompressedBytes] = useState<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const isOpen = Boolean(file || sourceDataUrl);

  useEffect(() => {
    if (!file && !sourceDataUrl) return;
    let active = true;
    let image: ImageBitmap | null = null;
    let objectUrl = "";
    setError("");
    setZoom(1);
    setX(50);
    setY(50);
    setCompressedBytes(null);

    (async () => {
      let sourceBlob: Blob;
      if (file) {
        if (
          file.size > 25 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(file.type)
        ) {
          throw Error("Use PNG, JPEG ou WebP de até 25 MB.");
        }
        const data = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        if (
          !(
            (data[0] === 255 && data[1] === 216) ||
            (data[0] === 137 && data[1] === 80) ||
            (String.fromCharCode(...data.slice(0, 4)) === "RIFF" &&
              String.fromCharCode(...data.slice(8, 12)) === "WEBP")
          )
        ) {
          throw Error("Conteúdo de imagem inválido.");
        }
        sourceBlob = file;
        setOriginalBytes(file.size);
      } else {
        const res = await fetch(sourceDataUrl!);
        sourceBlob = await res.blob();
        setOriginalBytes(sourceBlob.size);
      }

      image = await createImageBitmap(sourceBlob);
      if (!active) {
        image.close();
        return;
      }
      if (
        image.width * image.height > 40_000_000 ||
        image.width > 10_000 ||
        image.height > 10_000
      ) {
        throw Error("Limite de 40 megapixels e 10000 px por lado.");
      }
      objectUrl = URL.createObjectURL(sourceBlob);
      setBitmap(image);
      setUrl(objectUrl);
    })().catch((e) => {
      image?.close();
      image = null;
      if (active) setError((e as Error).message);
    });

    return () => {
      active = false;
      image?.close();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBitmap(null);
      setUrl("");
    };
  }, [file, sourceDataUrl]);

  const targetAspect = kind === "avatar" ? 1 : 3;
  const frameW = kind === "avatar" ? 256 : 384;
  const frameH = kind === "avatar" ? 256 : 128;

  const computeCrop = () => {
    if (!bitmap) return { sx: 0, sy: 0, sw: 1, sh: 1 };
    const baseW =
      bitmap.width / bitmap.height >= targetAspect
        ? bitmap.height * targetAspect
        : bitmap.width;
    const baseH =
      bitmap.width / bitmap.height >= targetAspect
        ? bitmap.height
        : bitmap.width / targetAspect;
    const sw = baseW / zoom;
    const sh = baseH / zoom;
    const sx = ((bitmap.width - sw) * x) / 100;
    const sy = ((bitmap.height - sh) * y) / 100;
    return { sx, sy, sw, sh };
  };

  useEffect(() => {
    if (!bitmap) return;
    const timer = window.setTimeout(() => {
      try {
        const crop = computeCrop();
        const encoded = compressCanvasImage(bitmap, kind, crop);
        const rawBase64 = encoded.split(",")[1] || "";
        setCompressedBytes(Math.round((rawBase64.length * 3) / 4));
      } catch {
        setCompressedBytes(null);
      }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [bitmap, kind, zoom, x, y]);

  function save() {
    try {
      if (!bitmap) return;
      const crop = computeCrop();
      const data = compressCanvasImage(bitmap, kind, crop);
      onSave(data);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const crop = computeCrop();
  const previewScale = frameW / Math.max(1, crop.sw);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: x,
      startY: y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !bitmap) return;
    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;
    const availW = Math.max(1, bitmap.width - crop.sw);
    const availH = Math.max(1, bitmap.height - crop.sh);
    const nextX =
      dragRef.current.startX - ((dx / previewScale) / availW) * 100;
    const nextY =
      dragRef.current.startY - ((dy / previewScale) / availH) * 100;
    setX(Math.min(100, Math.max(0, nextX)));
    setY(Math.min(100, Math.max(0, nextY)));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const title =
    kind === "avatar" ? "Editor de Foto de Perfil" : "Editor de Banner de Capa";
  const subtitle =
    kind === "avatar"
      ? "Arraste para enquadrar ou use o scroll para ampliar. Exportado e comprimido em 192×192 WebP."
      : "Arraste para enquadrar (proporção 3:1). Exportado e comprimido em 720×240 WebP.";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <div className="flex items-start justify-between gap-2 pr-6">
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{subtitle}</DialogDescription>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-micro font-mono text-primary shrink-0">
            <Sparkles className="size-3" />
            {kind === "avatar" ? "192×192" : "720×240"} WebP
          </span>
        </div>

        <div className="space-y-3">
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          {bitmap && (
            <>
              <div
                className={`relative overflow-hidden mx-auto bg-secondary border border-border cursor-grab active:cursor-grabbing touch-none shadow-inner ${
                  kind === "avatar" ? "rounded-2xl" : "rounded-xl"
                }`}
                style={{ width: frameW, height: frameH }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={(e) => {
                  e.preventDefault();
                  setZoom((prev) =>
                    Math.min(
                      4,
                      Math.max(1, Number((prev - e.deltaY * 0.0015).toFixed(2))),
                    ),
                  );
                }}
              >
                <img
                  alt="Prévia do recorte"
                  src={url}
                  draggable={false}
                  className="absolute max-w-none pointer-events-none select-none"
                  style={{
                    width: bitmap.width * previewScale,
                    height: bitmap.height * previewScale,
                    left: -crop.sx * previewScale,
                    top: -crop.sy * previewScale,
                  }}
                />
                {kind === "avatar" && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-primary/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.48)]"
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg bg-background/70 border border-border/60 px-3 py-1.5 text-2xs text-muted-foreground">
                <span>
                  Entrada: {formatKb(originalBytes)} ({bitmap.width}×
                  {bitmap.height})
                </span>
                <span className="text-primary font-semibold tabular-nums">
                  {compressedBytes !== null
                    ? `Saída WebP: ${formatKb(compressedBytes)}`
                    : "Comprimindo…"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  Zoom rápido:
                </span>
                <div className="flex items-center gap-1">
                  {[1, 1.5, 2, 3].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setZoom(preset)}
                      className={`px-2 py-0.5 rounded text-2xs font-mono border transition-colors ${
                        Math.abs(zoom - preset) < 0.06
                          ? "bg-primary text-primary-foreground border-primary font-semibold"
                          : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                      }`}
                    >
                      {preset}×
                    </button>
                  ))}
                </div>
              </div>

              {[
                ["Zoom", zoom, setZoom, 1, 4],
                ["Posição horizontal", x, setX, 0, 100],
                ["Posição vertical", y, setY, 0, 100],
              ].map(([label, value, set, min, max]) => (
                <label key={String(label)} className="block text-xs space-y-1.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{String(label)}</span>
                    <span className="tabular-nums font-mono">
                      {label === "Zoom"
                        ? `${Number(value).toFixed(2)}×`
                        : `${Math.round(Number(value))}%`}
                    </span>
                  </div>
                  <Slider
                    aria-label={String(label)}
                    min={Number(min)}
                    max={Number(max)}
                    step={0.05}
                    value={[Number(value)]}
                    onValueChange={([v]) => (set as (v: number) => void)(v)}
                  />
                </label>
              ))}
            </>
          )}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!bitmap}
              onClick={() => {
                setZoom(1);
                setX(50);
                setY(50);
              }}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="size-3.5" />
              <span>Centralizar</span>
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                Cancelar recorte
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!bitmap || !!error}
                onClick={save}
              >
                Aplicar recorte
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
