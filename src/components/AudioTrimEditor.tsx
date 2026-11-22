import { useHubStore } from "../store/useHubStore";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Scissors } from "lucide-react";
import { decodeEditableAudio, trimWav, waveform } from "../lib/audioTrim";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function formatSec(n: number): string {
  return `${Math.max(0, n).toFixed(2)}s`;
}

export function AudioTrimEditor({
  source,
  onApply,
  initialStart = 0,
  initialEnd,
  onPendingChange,
}: {
  source: Blob;
  initialStart?: number;
  initialEnd?: number;
  onPendingChange?: () => void;
  onApply: (blob: Blob, duration: number, start: number, end: number) => void;
}) {
  const deafened = useHubStore((s) => s.isDeafened);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const player = useRef<HTMLAudioElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pendingSeekOffsetRef = useRef<number | null>(null);
  const previewStartSecRef = useRef(0);

  useEffect(() => {
    let active = true;
    setBuffer(null);
    setError("");
    void decodeEditableAudio(source)
      .then((data) => {
        if (active) {
          setBuffer(data);
          const initS = Number.isFinite(initialStart)
            ? round2(Math.max(0, Math.min(initialStart, data.duration - 0.05)))
            : 0;
          const initE = Number.isFinite(initialEnd)
            ? round2(Math.min(data.duration, Math.max(0.05, initialEnd!)))
            : round2(data.duration);
          setStart(initS);
          setEnd(initE);
          setPlayheadSec(initS);
        }
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [source]);

  useEffect(() => {
    const audio = player.current;
    return () => {
      audio?.pause();
      audio?.removeAttribute("src");
      audio?.load();
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    if (deafened) {
      player.current?.pause();
      setIsPlaying(false);
    }
  }, [deafened]);

  useEffect(() => {
    player.current?.pause();
    setIsPlaying(false);
    setPreview("");
  }, [start, end, source]);

  // Loop de playhead em tempo real durante reprodução
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const step = () => {
      if (player.current && !player.current.paused) {
        const nextPos = Math.min(
          end,
          previewStartSecRef.current + player.current.currentTime,
        );
        setPlayheadSec(round2(nextPos));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, end]);

  const peaks = useMemo(() => (buffer ? waveform(buffer, 140) : []), [buffer]);

  const produce = (apply: boolean, startOverride?: number) => {
    try {
      if (!buffer || (!apply && deafened)) return;
      const clampedStart = round2(
        Math.max(0, Math.min(start, buffer.duration - 0.05)),
      );
      const clampedEnd = round2(
        Math.min(buffer.duration, Math.max(clampedStart + 0.05, end)),
      );
      const blob = trimWav(buffer, clampedStart, clampedEnd);
      setError("");
      if (apply) {
        onApply(
          blob,
          round2(clampedEnd - clampedStart),
          clampedStart,
          clampedEnd,
        );
      } else {
        player.current?.pause();
        setIsPlaying(false);
        previewStartSecRef.current = clampedStart;
        const requestedAbsolute =
          typeof startOverride === "number" ? startOverride : playheadSec;
        const clampedAbs = Math.min(
          clampedEnd - 0.02,
          Math.max(clampedStart, requestedAbsolute),
        );
        pendingSeekOffsetRef.current = Math.max(0, clampedAbs - clampedStart);
        setPreview(URL.createObjectURL(blob));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const clientXToSeconds = (clientX: number): number => {
    if (!svgRef.current || !buffer) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)),
    );
    return round2(ratio * buffer.duration);
  };

  const startHandleDrag = (
    handle: "start" | "end",
    e: React.PointerEvent<SVGGElement>,
  ) => {
    if (!buffer) return;
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      const sec = clientXToSeconds(moveEvent.clientX);
      const minGap = Math.min(0.2, Math.max(0.05, buffer.duration * 0.25));
      if (handle === "start") {
        const nextStart = round2(
          Math.max(0, Math.min(sec, Math.max(0, end - minGap))),
        );
        setStart(nextStart);
        setPlayheadSec((prev) =>
          prev < nextStart || prev > end ? nextStart : prev,
        );
        onPendingChange?.();
      } else {
        const nextEnd = round2(
          Math.min(
            buffer.duration,
            Math.max(sec, Math.min(buffer.duration, start + minGap)),
          ),
        );
        setEnd(nextEnd);
        setPlayheadSec((prev) =>
          prev > nextEnd || prev < start ? start : prev,
        );
        onPendingChange?.();
      }
    };

    const onUp = (upEvent: PointerEvent) => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      if (target.hasPointerCapture?.(upEvent.pointerId)) {
        target.releasePointerCapture(upEvent.pointerId);
      }
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  const handleWaveformPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!buffer) return;
    const svg = e.currentTarget;
    svg.setPointerCapture(e.pointerId);

    const movePlayhead = (clientX: number) => {
      const sec = clientXToSeconds(clientX);
      const clamped = round2(Math.min(end, Math.max(start, sec)));
      setPlayheadSec(clamped);
      if (player.current && preview) {
        const offset = Math.max(0, clamped - previewStartSecRef.current);
        if (Number.isFinite(offset)) {
          player.current.currentTime = offset;
        }
      }
      return clamped;
    };

    movePlayhead(e.clientX);

    const onMove = (moveEvent: PointerEvent) => {
      movePlayhead(moveEvent.clientX);
    };

    const onUp = (upEvent: PointerEvent) => {
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointercancel", onUp);
      if (svg.hasPointerCapture?.(upEvent.pointerId)) {
        svg.releasePointerCapture(upEvent.pointerId);
      }
    };

    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
  };

  const selectedDuration = Math.max(0, end - start);
  const startPct = buffer ? (start / buffer.duration) * 100 : 0;
  const endPct = buffer ? (end / buffer.duration) * 100 : 100;
  const playPct = buffer
    ? Math.min(100, Math.max(0, (playheadSec / buffer.duration) * 100))
    : 0;
  const startX = (startPct / 100) * 320;
  const endX = (endPct / 100) * 320;
  const playX = (playPct / 100) * 320;

  const estWavKb = buffer
    ? Math.round(
        (selectedDuration *
          buffer.sampleRate *
          Math.min(2, buffer.numberOfChannels) *
          2) /
          1024,
      )
    : 0;

  return (
    <section
      aria-label="Editor de corte de áudio"
      className="space-y-3 border border-border rounded-xl bg-surface/60 p-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Scissors className="size-3.5 text-primary" />
            <span>Cortar áudio</span>
          </h3>
          <p className="text-2xs text-muted-foreground">
            Arraste as alças verdes (Início/Fim) ou clique na onda para mover a
            agulha ({formatSec(playheadSec)}).
          </p>
        </div>
        {buffer && (
          <div className="text-right shrink-0">
            <span className="inline-flex items-center rounded-md bg-primary/15 px-2 py-0.5 text-2xs font-mono font-semibold text-primary">
              {formatSec(selectedDuration)} / {formatSec(buffer.duration)}
            </span>
            <p className="text-micro text-muted-foreground mt-0.5 font-mono">
              ~{estWavKb} KB WAV
            </p>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {!buffer && !error && (
        <p role="status" className="text-xs text-muted-foreground">
          Analisando áudio…
        </p>
      )}

      {buffer && (
        <>
          <div className="relative rounded-lg border border-border/80 bg-background/80 p-1.5 select-none">
            <svg
              ref={svgRef}
              viewBox="0 0 320 72"
              className="w-full h-22 cursor-pointer touch-none overflow-visible"
              role="img"
              aria-label="Forma de onda do áudio"
              onPointerDown={handleWaveformPointerDown}
            >
              {/* Regiões inativas (esquerda e direita) */}
              <rect
                x={0}
                y={0}
                width={Math.max(0, startX)}
                height={72}
                fill="rgba(0,0,0,0.28)"
              />
              <rect
                x={endX}
                y={0}
                width={Math.max(0, 320 - endX)}
                height={72}
                fill="rgba(0,0,0,0.28)"
              />

              {/* Faixa selecionada */}
              <rect
                x={startX}
                y={0}
                width={Math.max(2, endX - startX)}
                height={72}
                fill="hsl(var(--primary) / 0.14)"
                rx={2}
              />

              {/* Barras da forma de onda */}
              {peaks.map((peak, i) => {
                const posRatio = i / Math.max(1, peaks.length - 1);
                const inSelection =
                  posRatio >= start / buffer.duration &&
                  posRatio <= end / buffer.duration;
                const xPos = posRatio * 316 + 2;
                const barH = Math.max(2, peak * 28);
                return (
                  <line
                    key={i}
                    x1={xPos}
                    x2={xPos}
                    y1={36 - barH}
                    y2={36 + barH}
                    stroke={inSelection ? "var(--primary)" : "currentColor"}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    opacity={inSelection ? 0.95 : 0.25}
                  />
                );
              })}

              {/* Playhead manipulável */}
              <line
                x1={playX}
                x2={playX}
                y1={0}
                y2={72}
                stroke="#ffffff"
                strokeWidth="2"
                pointerEvents="none"
              />
              <polygon
                points={`${playX - 4},0 ${playX + 4},0 ${playX},6`}
                fill="#ffffff"
                pointerEvents="none"
              />

              {/* Alça independente de Início */}
              <g
                role="slider"
                aria-label="Alça de início do corte"
                aria-valuenow={start}
                className="cursor-ew-resize"
                onPointerDown={(e) => startHandleDrag("start", e)}
              >
                <rect
                  x={startX - 8}
                  y={0}
                  width={16}
                  height={72}
                  fill="transparent"
                />
                <line
                  x1={startX}
                  x2={startX}
                  y1={0}
                  y2={72}
                  stroke="var(--primary)"
                  strokeWidth="2.5"
                />
                <rect
                  x={startX - 5}
                  y={4}
                  width={10}
                  height={14}
                  rx={3}
                  fill="var(--primary)"
                />
              </g>

              {/* Alça independente de Fim */}
              <g
                role="slider"
                aria-label="Alça de fim do corte"
                aria-valuenow={end}
                className="cursor-ew-resize"
                onPointerDown={(e) => startHandleDrag("end", e)}
              >
                <rect
                  x={endX - 8}
                  y={0}
                  width={16}
                  height={72}
                  fill="transparent"
                />
                <line
                  x1={endX}
                  x2={endX}
                  y1={0}
                  y2={72}
                  stroke="var(--primary)"
                  strokeWidth="2.5"
                />
                <rect
                  x={endX - 5}
                  y={54}
                  width={10}
                  height={14}
                  rx={3}
                  fill="var(--primary)"
                />
              </g>
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground block">Início (s)</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="outline"
                  aria-label="Diminuir início"
                  onClick={() => {
                    const next = round2(Math.max(0, start - 0.1));
                    setStart(next);
                    setPlayheadSec((prev) =>
                      prev < next || prev > end ? next : prev,
                    );
                    onPendingChange?.();
                  }}
                >
                  -
                </Button>
                <Input
                  aria-label="Início do corte"
                  type="number"
                  min={0}
                  max={round2(buffer.duration)}
                  step={0.05}
                  value={round2(start)}
                  className="h-8 text-xs font-mono"
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    const safe = Number.isFinite(next) ? round2(next) : 0;
                    setStart(safe);
                    setPlayheadSec((prev) =>
                      prev < safe || prev > end ? safe : prev,
                    );
                    onPendingChange?.();
                  }}
                />
                <Button
                  type="button"
                  size="icon-xs"
                  variant="outline"
                  aria-label="Aumentar início"
                  onClick={() => {
                    const next = round2(Math.min(end - 0.05, start + 0.1));
                    setStart(next);
                    setPlayheadSec((prev) =>
                      prev < next || prev > end ? next : prev,
                    );
                    onPendingChange?.();
                  }}
                >
                  +
                </Button>
              </div>
            </label>

            <label className="text-xs space-y-1">
              <span className="text-muted-foreground block">Fim (s)</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="outline"
                  aria-label="Diminuir fim"
                  onClick={() => {
                    const next = round2(Math.max(start + 0.05, end - 0.1));
                    setEnd(next);
                    setPlayheadSec((prev) =>
                      prev > next || prev < start ? start : prev,
                    );
                    onPendingChange?.();
                  }}
                >
                  -
                </Button>
                <Input
                  aria-label="Fim do corte"
                  type="number"
                  min={0}
                  max={round2(buffer.duration)}
                  step={0.05}
                  value={round2(end)}
                  className="h-8 text-xs font-mono"
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    const safe = Number.isFinite(next) ? round2(next) : 0;
                    setEnd(safe);
                    setPlayheadSec((prev) =>
                      prev > safe || prev < start ? start : prev,
                    );
                    onPendingChange?.();
                  }}
                />
                <Button
                  type="button"
                  size="icon-xs"
                  variant="outline"
                  aria-label="Aumentar fim"
                  onClick={() => {
                    const next = round2(
                      Math.min(buffer.duration, end + 0.1),
                    );
                    setEnd(next);
                    setPlayheadSec((prev) =>
                      prev > next || prev < start ? start : prev,
                    );
                    onPendingChange?.();
                  }}
                >
                  +
                </Button>
              </div>
            </label>
          </div>

          <p className="sr-only">
            Duração selecionada: {selectedDuration.toFixed(2)} s
          </p>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setStart(0);
                setEnd(round2(buffer.duration));
                setPlayheadSec(0);
                onPendingChange?.();
              }}
              className="h-8 px-2.5 text-xs gap-1 text-muted-foreground"
            >
              <RotateCcw className="size-3.5" />
              <span>Tudo</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={deafened}
                onClick={() => produce(false, playheadSec)}
                className="h-8 gap-1.5 text-xs"
              >
                {isPlaying ? (
                  <Pause className="size-3.5" />
                ) : (
                  <Play className="size-3.5" />
                )}
                <span>Prévia do corte</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => produce(true)}
                className="h-8 gap-1.5 text-xs"
              >
                <Scissors className="size-3.5" />
                <span>Aplicar corte</span>
              </Button>
            </div>
          </div>

          {preview && (
            <audio
              ref={player}
              controls
              muted={deafened}
              autoPlay
              src={preview}
              onLoadedMetadata={() => {
                if (
                  player.current &&
                  pendingSeekOffsetRef.current !== null &&
                  Number.isFinite(pendingSeekOffsetRef.current)
                ) {
                  player.current.currentTime = pendingSeekOffsetRef.current;
                  pendingSeekOffsetRef.current = null;
                }
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => {
                setIsPlaying(false);
                setPlayheadSec(round2(start));
              }}
              className="w-full h-9"
              aria-label="Prévia local do corte"
            />
          )}
        </>
      )}
    </section>
  );
}
